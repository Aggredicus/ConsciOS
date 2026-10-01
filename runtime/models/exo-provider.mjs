import {assertValidModelInput,assertValidModelOutput} from './validation.mjs';
import {assertInferenceProvider,createProviderRecord,declaredContextText,normalizeHttpEndpoint} from './inference-provider.mjs';

function countCollection(value){
  if(Array.isArray(value))return value.length;
  if(value&&typeof value==='object')return Object.keys(value).length;
  return 0;
}

function summarizeState(state){
  const topology=state?.topology;
  const nodes=topology?.nodes??topology?.nodeIds??topology?.node_ids??null;
  return {
    nodeCount:countCollection(nodes)||countCollection(state?.nodeIdentities)||countCollection(state?.node_identities),
    instanceCount:countCollection(state?.instances),
    taskCount:countCollection(state?.tasks),
    lastEventAppliedIndex:state?.lastEventAppliedIdx??state?.last_event_applied_idx??null
  };
}

function modelIds(payload){
  const rows=Array.isArray(payload?.data)?payload.data:Array.isArray(payload)?payload:[];
  return rows.map(row=>typeof row==='string'?row:row?.id).filter(value=>typeof value==='string'&&value.length>0);
}

function instanceModelIds(state){
  const ids=new Set();
  const visit=value=>{
    if(!value||typeof value!=='object')return;
    if(typeof value.modelId==='string')ids.add(value.modelId);
    if(typeof value.model_id==='string')ids.add(value.model_id);
    for(const nested of Object.values(value))visit(nested);
  };
  visit(state?.instances);
  return ids;
}

async function responseJson(response,label){
  if(!response.ok){
    const text=await response.text().catch(()=> '');
    throw new Error(`${label} failed with HTTP ${response.status}${text?`: ${text.slice(0,240)}`:''}`);
  }
  return response.json();
}

async function responseText(response,label){
  if(!response.ok){
    const text=await response.text().catch(()=> '');
    throw new Error(`${label} failed with HTTP ${response.status}${text?`: ${text.slice(0,240)}`:''}`);
  }
  return response.text();
}

export class ExoInferenceProvider{
  constructor({endpoint,modelId=null,fetchImpl=globalThis.fetch,label='exo cluster'}={}){
    if(typeof fetchImpl!=='function')throw new TypeError('fetch implementation is required');
    this.id='exo';this.label=label;this.endpoint=normalizeHttpEndpoint(endpoint);this.modelId=modelId;this.fetchImpl=fetchImpl;
    this.capabilities=null;this._abortController=null;this._readyModels=new Set();
    assertInferenceProvider(this);
  }
  record(){return createProviderRecord({id:this.id,label:this.label,kind:'exo-cluster',location:'lan-cluster',remote:true})}
  setModel(modelId){if(typeof modelId!=='string'||modelId.length===0)throw new TypeError('exo modelId must be a non-empty string');this.modelId=modelId;return this.modelId}
  async connect(){
    const [stateResponse,modelsResponse]=await Promise.all([
      this.fetchImpl(`${this.endpoint}/state`,{headers:{Accept:'application/json'}}),
      this.fetchImpl(`${this.endpoint}/v1/models?status=downloaded`,{headers:{Accept:'application/json'}})
    ]);
    const state=await responseJson(stateResponse,'exo state request');
    const models=await responseJson(modelsResponse,'exo downloaded-model request');
    const ids=modelIds(models);
    this._readyModels=instanceModelIds(state);
    this.capabilities={status:'ready',provider:this.record(),endpoint:this.endpoint,models:ids,downloadedModels:ids,activeModels:[...this._readyModels],cluster:summarizeState(state)};
    if(this.modelId===null&&ids.length===1)this.modelId=ids[0];
    return this.capabilities;
  }
  provenance(){return {kind:'exo-cluster',name:this.label,hiddenState:'none',modelId:this.modelId??'unselected',endpoint:this.endpoint,runtime:'exo-openai-compatible',inferenceLocation:'lan-cluster',remoteInference:true,clusterNodeCount:this.capabilities?.cluster?.nodeCount??null}}
  cancel(){this._abortController?.abort();this._abortController=null}
  async ensureModelInstance(modelId=this.modelId){
    if(!modelId)throw new Error('exo model is not selected');
    if(this._readyModels.has(modelId))return {status:'ready',modelId,placed:false};

    const stateResponse=await this.fetchImpl(`${this.endpoint}/state`,{headers:{Accept:'application/json'}});
    const state=await responseJson(stateResponse,'exo state request');
    const active=instanceModelIds(state);
    this._readyModels=active;
    if(active.has(modelId))return {status:'ready',modelId,placed:false};

    const placeResponse=await this.fetchImpl(`${this.endpoint}/place_instance`,{
      method:'POST',
      headers:{'Content-Type':'application/json',Accept:'application/json'},
      body:JSON.stringify({model_id:modelId})
    });
    await responseJson(placeResponse,'exo model placement');

    const awaitResponse=await this.fetchImpl(`${this.endpoint}/instance/await?model_id=${encodeURIComponent(modelId)}&timeout_seconds=180`,{headers:{Accept:'text/event-stream'}});
    const streamText=await responseText(awaitResponse,'exo instance wait');
    if(!/"type"\s*:\s*"ready"/.test(streamText)){
      const timedOut=/"type"\s*:\s*"timeout"/.test(streamText);
      throw new Error(timedOut?`exo timed out while placing ${modelId}`:`exo did not report a ready instance for ${modelId}`);
    }
    this._readyModels.add(modelId);
    if(this.capabilities)this.capabilities={...this.capabilities,activeModels:[...this._readyModels]};
    return {status:'ready',modelId,placed:true};
  }
  async infer(input){
    assertValidModelInput(input);
    const provider=this.provenance();
    if(!this.modelId)return assertValidModelOutput({requestId:input.requestId,provider,status:'error',content:null,confidence:0,causalSourceIds:[...input.causalSourceIds],timing:{elapsedMs:0,ttftMs:null,streamed:false},failure:'exo model is not selected',epistemicStatus:'error'});
    const started=performance.now();
    this._abortController=new AbortController();
    try{
      await this.ensureModelInstance(this.modelId);
      const taskInstruction=[
        `ConsciOS inference task: ${input.inferenceType}.`,
        `Requesting module: ${input.requestingModule}.`,
        'Use only the declared context artifacts and conversation turns supplied in this request.',
        'Respond naturally to the current user turn while preserving relevant conversational continuity.',
        'Do not claim access to undeclared context, hidden state, repository state, credentials, or cognitive authority.'
      ].join(' ');
      const messages=[{role:'system',content:taskInstruction}];
      const hasConversation=Array.isArray(input.conversationMessages)&&input.conversationMessages.length>0;
      if(hasConversation){
        if(input.contextManifest.length)messages.push({role:'system',content:`Declared ConsciOS context artifacts (and only these artifacts):\n${declaredContextText(input)}`});
        messages.push(...input.conversationMessages.map(message=>({role:message.role,content:message.content})));
      }else messages.push({role:'user',content:declaredContextText(input)});
      const response=await this.fetchImpl(`${this.endpoint}/v1/chat/completions`,{
        method:'POST',signal:this._abortController.signal,headers:{'Content-Type':'application/json',Accept:'application/json'},
        body:JSON.stringify({model:this.modelId,temperature:0,max_tokens:input.maxResponseUnits,messages})
      });
      const payload=await responseJson(response,'exo chat completion');
      const text=payload?.choices?.[0]?.message?.content;
      if(typeof text!=='string')throw new Error('exo response did not contain choices[0].message.content');
      const elapsedMs=Math.max(0,performance.now()-started);
      const conversationMessageCount=hasConversation?input.conversationMessages.length:0;
      return assertValidModelOutput({requestId:input.requestId,provider:this.provenance(),status:'ok',content:{inferenceType:input.inferenceType,requestingModule:input.requestingModule,accessibleArtifactIds:input.contextManifest.map(item=>item.artifactId),conversationMessageCount,text,confidenceBasis:'uncalibrated-generative-output'},confidence:null,causalSourceIds:[...input.causalSourceIds],timing:{elapsedMs,ttftMs:null,streamed:false},failure:null,epistemicStatus:input.expectedEpistemicStatus});
    }catch(error){
      const cancelled=error?.name==='AbortError';
      return assertValidModelOutput({requestId:input.requestId,provider,status:cancelled?'cancelled':'error',content:null,confidence:0,causalSourceIds:[...input.causalSourceIds],timing:{elapsedMs:Math.max(0,performance.now()-started),ttftMs:null,streamed:false},failure:cancelled?'cancelled by caller':String(error?.message||error),epistemicStatus:'error'});
    }finally{this._abortController=null}
  }
}

export function createExoInferenceProvider(options){return new ExoInferenceProvider(options)}
