import {assertValidModelInput,assertValidModelOutput} from './validation.mjs';
import {assertInferenceProvider,createProviderRecord,declaredContextText,normalizeHttpEndpoint} from './inference-provider.mjs';

function countCollection(value){
  if(Array.isArray(value))return value.length;
  if(value&&typeof value==='object')return Object.keys(value).length;
  return 0;
}

function byteValue(value){
  if(typeof value==='number'&&Number.isFinite(value))return value;
  if(value&&typeof value==='object'){
    const nested=value.inBytes??value.in_bytes??value.bytes;
    if(typeof nested==='number'&&Number.isFinite(nested))return nested;
  }
  return null;
}

function runtimeNodes(state){
  const topology=state?.topology;
  const topologyIds=Array.isArray(topology?.nodes)?topology.nodes:Array.isArray(topology?.nodeIds)?topology.nodeIds:Array.isArray(topology?.node_ids)?topology.node_ids:[];
  const identities=state?.nodeIdentities??state?.node_identities??{};
  const ids=[...new Set([...topologyIds,...Object.keys(identities)])];
  return ids.map(id=>{
    const identity=identities?.[id]??{};
    const memory=(state?.nodeMemory??state?.node_memory??{})?.[id]??{};
    const system=(state?.nodeSystem??state?.node_system??{})?.[id]??{};
    const disk=(state?.nodeDisk??state?.node_disk??{})?.[id]??{};
    return {
      id:String(id),
      name:identity.friendlyName??identity.friendly_name??String(id),
      model:identity.modelId??identity.model_id??null,
      chip:identity.chipId??identity.chip_id??null,
      osVersion:identity.osVersion??identity.os_version??null,
      ramTotalBytes:byteValue(memory.ramTotal??memory.ram_total),
      ramAvailableBytes:byteValue(memory.ramAvailable??memory.ram_available),
      swapTotalBytes:byteValue(memory.swapTotal??memory.swap_total),
      swapAvailableBytes:byteValue(memory.swapAvailable??memory.swap_available),
      gpuUsage:typeof system.gpuUsage==='number'?system.gpuUsage:typeof system.gpu_usage==='number'?system.gpu_usage:null,
      cpuUsage:typeof system.pcpuUsage==='number'||typeof system.ecpuUsage==='number'?(Number(system.pcpuUsage??0)+Number(system.ecpuUsage??0)):typeof system.cpuUsage==='number'?system.cpuUsage:null,
      temperatureC:typeof system.temp==='number'?system.temp:typeof system.temperature==='number'?system.temperature:null,
      systemPowerW:typeof system.sysPower==='number'?system.sysPower:typeof system.sys_power==='number'?system.sys_power:null,
      diskTotalBytes:byteValue(disk.total),
      diskAvailableBytes:byteValue(disk.available)
    };
  });
}

function summarizeState(state){
  const nodes=runtimeNodes(state);
  const sum=key=>nodes.reduce((total,node)=>total+(typeof node[key]==='number'?node[key]:0),0);
  return {
    nodeCount:nodes.length||countCollection(state?.topology?.nodes)||countCollection(state?.nodeIdentities)||countCollection(state?.node_identities),
    instanceCount:countCollection(state?.instances),
    taskCount:countCollection(state?.tasks),
    lastEventAppliedIndex:state?.lastEventAppliedIdx??state?.last_event_applied_idx??null,
    memory:{totalBytes:sum('ramTotalBytes'),availableBytes:sum('ramAvailableBytes')},
    disk:{totalBytes:sum('diskTotalBytes'),availableBytes:sum('diskAvailableBytes')},
    nodes
  };
}

function modelRows(payload){return Array.isArray(payload?.data)?payload.data:Array.isArray(payload)?payload:[]}
function modelIds(payload){return modelRows(payload).map(row=>typeof row==='string'?row:row?.id??row?.model_id).filter(value=>typeof value==='string'&&value.length>0)}
function modelDescriptor(row,downloaded,active){
  const source=typeof row==='string'?{id:row}:row??{},id=source.id??source.model_id;
  if(typeof id!=='string'||!id)return null;
  const storageSizeBytes=byteValue(source.storage_size??source.storageSize??source.storage);
  return {id,name:source.name??id,storageSizeBytes,family:source.family??'',quantization:source.quantization??'',contextLength:Number(source.context_length??source.contextLength??0)||0,supportsTensor:Boolean(source.supports_tensor??source.supportsTensor),tasks:Array.isArray(source.tasks)?source.tasks:[],backends:Array.isArray(source.backends)?source.backends:[],isCustom:Boolean(source.is_custom??source.isCustom),downloaded:downloaded.has(id),active:active.has(id)};
}
function previewNodeCount(preview){return Object.values(preview?.memory_delta_by_node??{}).filter(value=>Number(value)>0).length}

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

async function streamChatResponse(response,{onText,started}){
  if(!response.ok){
    const text=await response.text().catch(()=> '');
    throw new Error(`exo chat completion failed with HTTP ${response.status}${text?`: ${text.slice(0,240)}`:''}`);
  }
  let text='',firstChunkAt=null,buffer='',finishReason=null;
  const handle=block=>{
    for(const line of block.split(/\r?\n/)){
      if(!line.startsWith('data:'))continue;
      const data=line.slice(5).trim();if(!data||data==='[DONE]')continue;
      const payload=JSON.parse(data);
      if(payload?.error)throw new Error(payload.error.message||'exo streaming error');
      const choice=payload?.choices?.[0],chunk=choice?.delta?.content;
      if(choice?.finish_reason)finishReason=choice.finish_reason;
      if(typeof chunk==='string'&&chunk){
        if(firstChunkAt===null)firstChunkAt=performance.now();
        text+=chunk;onText(chunk);
      }
    }
  };
  const drain=(final=false)=>{
    for(;;){
      const match=buffer.match(/\r?\n\r?\n/);
      if(!match)break;
      const index=match.index??0;handle(buffer.slice(0,index));buffer=buffer.slice(index+match[0].length);
    }
    if(final&&buffer.trim())handle(buffer);
  };
  const reader=response.body?.getReader?.();
  if(reader){
    const decoder=new TextDecoder();
    for(;;){
      const {done,value}=await reader.read();
      if(done)break;buffer+=decoder.decode(value,{stream:true});drain();
    }
    buffer+=decoder.decode();drain(true);
  }else{buffer=await response.text();drain(true)}
  return {text,ttftMs:firstChunkAt===null?null:Math.max(0,firstChunkAt-started),streamed:Boolean(reader),finishReason};
}

export class ExoInferenceProvider{
  constructor({endpoint,modelId=null,fetchImpl=globalThis.fetch,label='exo cluster'}={}){
    if(typeof fetchImpl!=='function')throw new TypeError('fetch implementation is required');
    this.id='exo';this.label=label;this.endpoint=normalizeHttpEndpoint(endpoint);this.modelId=modelId;this.fetchImpl=(...args)=>fetchImpl(...args);
    this.capabilities=null;this._abortController=null;this._readyModels=new Set();
    assertInferenceProvider(this);
  }
  record(){return createProviderRecord({id:this.id,label:this.label,kind:'exo-cluster',location:'lan-cluster',remote:true})}
  setModel(modelId){if(typeof modelId!=='string'||modelId.length===0)throw new TypeError('exo modelId must be a non-empty string');this.modelId=modelId;return this.modelId}
  async connect(){return this.refreshRuntime()}
  async refreshRuntime(){
    const [stateResponse,catalogResponse,downloadedResponse]=await Promise.all([
      this.fetchImpl(`${this.endpoint}/state`,{headers:{Accept:'application/json'}}),
      this.fetchImpl(`${this.endpoint}/v1/models`,{headers:{Accept:'application/json'}}),
      this.fetchImpl(`${this.endpoint}/v1/models?status=downloaded`,{headers:{Accept:'application/json'}})
    ]);
    const state=await responseJson(stateResponse,'exo state request'),catalog=await responseJson(catalogResponse,'exo model catalog request'),downloadedPayload=await responseJson(downloadedResponse,'exo downloaded-model request');
    const downloaded=new Set(modelIds(downloadedPayload));this._readyModels=instanceModelIds(state);
    const catalogRows=modelRows(catalog),catalogIds=modelIds(catalog),fallbackRows=catalogRows.length?catalogRows:modelRows(downloadedPayload);
    const modelCatalog=fallbackRows.map(row=>modelDescriptor(row,downloaded,this._readyModels)).filter(Boolean).sort((a,b)=>Number(b.downloaded)-Number(a.downloaded)||a.id.localeCompare(b.id));
    const availableModels=catalogIds.length?catalogIds:[...downloaded];
    this.capabilities={status:'ready',provider:this.record(),endpoint:this.endpoint,models:[...downloaded],downloadedModels:[...downloaded],availableModels,modelCatalog,activeModels:[...this._readyModels],cluster:summarizeState(state),observedAt:new Date().toISOString()};
    if(this.modelId===null&&downloaded.size===1)this.modelId=[...downloaded][0];
    return this.capabilities;
  }
  provenance(){return {kind:'exo-cluster',name:this.label,hiddenState:'none',modelId:this.modelId??'unselected',endpoint:this.endpoint,runtime:'exo-openai-compatible',inferenceLocation:'lan-cluster',remoteInference:true,clusterNodeCount:this.capabilities?.cluster?.nodeCount??null}}
  cancel(){this._abortController?.abort();this._abortController=null}
  async previewPlacements(modelId=this.modelId){
    if(!modelId)throw new Error('exo model is not selected');
    const response=await this.fetchImpl(`${this.endpoint}/instance/previews?model_id=${encodeURIComponent(modelId)}`,{headers:{Accept:'application/json'}});
    const payload=await responseJson(response,'exo placement preview'),previews=Array.isArray(payload?.previews)?payload.previews:[];
    return previews.map(preview=>({...preview,nodeCount:previewNodeCount(preview),valid:!preview?.error&&Boolean(preview?.instance)}));
  }
  async launchPlacement(preview){
    if(!preview?.instance||preview?.error)throw new Error(preview?.error||'invalid exo placement preview');
    const modelId=preview.model_id??this.modelId;if(!modelId)throw new Error('exo placement is missing model id');
    if(this._readyModels.has(modelId))throw new Error('model already has an active instance; stop it in native exo before forcing a pooled placement');
    const response=await this.fetchImpl(`${this.endpoint}/instance`,{method:'POST',headers:{'Content-Type':'application/json',Accept:'application/json'},body:JSON.stringify({instance:preview.instance})});
    await responseJson(response,'exo exact placement');
    const awaited=await this.fetchImpl(`${this.endpoint}/instance/await?model_id=${encodeURIComponent(modelId)}&timeout_seconds=300`,{headers:{Accept:'text/event-stream'}});
    const text=await responseText(awaited,'exo instance wait');
    if(!/"type"\s*:\s*"ready"/.test(text))throw new Error(/"type"\s*:\s*"timeout"/.test(text)?`exo timed out while launching ${modelId}`:`exo did not report a ready instance for ${modelId}`);
    this.modelId=modelId;this._readyModels.add(modelId);if(this.capabilities)this.capabilities={...this.capabilities,activeModels:[...this._readyModels],modelCatalog:(this.capabilities.modelCatalog??[]).map(model=>model.id===modelId?{...model,active:true}:model)};return {status:'ready',modelId,nodeCount:previewNodeCount(preview),sharding:preview.sharding??null,runtime:preview.instance_meta??null};
  }
  async benchmark({modelId=this.modelId,prompt='Reply with the single word READY.',maxTokens=32}={}){
    if(!modelId)throw new Error('exo model is not selected');
    const response=await this.fetchImpl(`${this.endpoint}/bench/chat/completions`,{method:'POST',headers:{'Content-Type':'application/json',Accept:'application/json'},body:JSON.stringify({model:modelId,messages:[{role:'user',content:prompt}],max_tokens:maxTokens,stream:false,temperature:0,enable_thinking:false})});
    return responseJson(response,'exo benchmark');
  }
  async testPooling(modelId=this.modelId){
    if(!modelId)throw new Error('exo model is not selected');
    const capabilities=await this.refreshRuntime();
    if(capabilities.cluster.nodeCount<2)return {status:'needs-second-worker',nodeCount:capabilities.cluster.nodeCount,modelId};
    if(this._readyModels.has(modelId))return {status:'active-instance-exists',nodeCount:capabilities.cluster.nodeCount,modelId};
    const previews=await this.previewPlacements(modelId),valid=previews.filter(preview=>preview.valid),multi=valid.filter(preview=>preview.nodeCount>1).sort((a,b)=>b.nodeCount-a.nodeCount);
    if(!multi.length)return {status:'no-multi-node-placement',nodeCount:capabilities.cluster.nodeCount,modelId,previews:valid};
    const selected=multi[0],placement=await this.launchPlacement(selected),bench=await this.benchmark({modelId,maxTokens:32});
    return {status:'pooled',modelId,placement,benchmark:bench,preview:selected};
  }
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
  async infer(input,{onText=null}={}){
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
        'Do not claim access to undeclared context, hidden state, repository state, credentials, or cognitive authority.',
        /Qwen3/i.test(this.modelId)?'/no_think':''
      ].join(' ');
      const messages=[{role:'system',content:taskInstruction}];
      const hasConversation=Array.isArray(input.conversationMessages)&&input.conversationMessages.length>0;
      if(hasConversation){
        if(input.contextManifest.length)messages.push({role:'system',content:`Declared ConsciOS context artifacts (and only these artifacts):\n${declaredContextText(input)}`});
        messages.push(...input.conversationMessages.map(message=>({role:message.role,content:message.content})));
      }else messages.push({role:'user',content:declaredContextText(input)});
      const wantsStream=typeof onText==='function';
      const response=await this.fetchImpl(`${this.endpoint}/v1/chat/completions`,{
        method:'POST',signal:this._abortController.signal,headers:{'Content-Type':'application/json',Accept:wantsStream?'text/event-stream':'application/json'},
        body:JSON.stringify({model:this.modelId,temperature:0,max_tokens:input.maxResponseUnits,messages,stream:wantsStream})
      });
      let text,ttftMs=null,streamed=false,finishReason=null;
      if(wantsStream){
        const stream=await streamChatResponse(response,{onText,started});text=stream.text;ttftMs=stream.ttftMs;streamed=stream.streamed;finishReason=stream.finishReason;
      }else{
        const payload=await responseJson(response,'exo chat completion');text=payload?.choices?.[0]?.message?.content;finishReason=payload?.choices?.[0]?.finish_reason??null;
      }
      if(typeof text!=='string')throw new Error('exo response did not contain assistant text');
      const elapsedMs=Math.max(0,performance.now()-started);
      const conversationMessageCount=hasConversation?input.conversationMessages.length:0;
      return assertValidModelOutput({requestId:input.requestId,provider:this.provenance(),status:'ok',content:{inferenceType:input.inferenceType,requestingModule:input.requestingModule,accessibleArtifactIds:input.contextManifest.map(item=>item.artifactId),conversationMessageCount,text,confidenceBasis:'uncalibrated-generative-output'},confidence:null,causalSourceIds:[...input.causalSourceIds],timing:{elapsedMs,ttftMs,streamed,finishReason},failure:null,epistemicStatus:input.expectedEpistemicStatus});
    }catch(error){
      const cancelled=error?.name==='AbortError';
      return assertValidModelOutput({requestId:input.requestId,provider,status:cancelled?'cancelled':'error',content:null,confidence:0,causalSourceIds:[...input.causalSourceIds],timing:{elapsedMs:Math.max(0,performance.now()-started),ttftMs:null,streamed:false},failure:cancelled?'cancelled by caller':String(error?.message||error),epistemicStatus:'error'});
    }finally{this._abortController=null}
  }
}

export function createExoInferenceProvider(options){return new ExoInferenceProvider(options)}
