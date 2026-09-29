import { assertValidModelInput, assertValidModelOutput } from './validation.mjs';

function buildTaskInstruction(input){
  return [
    `ConsciOS inference task: ${input.inferenceType}.`,
    'Use only the explicitly declared context artifacts and conversation turns supplied by the host.',
    'Respond naturally to the current user turn while preserving relevant conversational continuity.',
    'Do not claim access to undeclared context, hidden system state, repository state, credentials, or cognitive authority.'
  ].join(' ');
}

function explicitUserTurn(input){
  for(const artifact of input.contextManifest||[]){
    const content=artifact?.content;
    if(!content||typeof content!=='object'||Array.isArray(content))continue;
    for(const key of ['userText','text']){
      const value=content[key];
      if(typeof value==='string'&&value.trim())return {text:value.trim(),artifactId:artifact.artifactId};
    }
  }
  return null;
}

function oneShotHostContext(input,explicitTurn){
  if(!explicitTurn)return input.contextManifest;
  return input.contextManifest.filter(artifact=>{
    if(artifact.artifactId===explicitTurn.artifactId)return false;
    if(typeof artifact.artifactId==='string'&&artifact.artifactId.endsWith(':parameters'))return false;
    return true;
  });
}

function providerFromHost(host){
  const provenance=host.provenance();
  return {
    kind:'browser-transformers-local',name:`${provenance.modelId} via ${provenance.runtime}`,hiddenState:'none',
    modelId:provenance.modelId,revision:provenance.revision,runtime:provenance.runtime,device:provenance.device,dtype:provenance.dtype,
    inferenceLocation:provenance.inferenceLocation,remoteInference:provenance.remoteInference
  };
}

export class BrowserTransformersCognitiveModel {
  constructor({host,onText=null}={}){
    if(!host||typeof host.generate!=='function'||typeof host.provenance!=='function')throw new TypeError('host with generate() and provenance() is required');
    if(onText!=null&&typeof onText!=='function')throw new TypeError('onText must be a function when provided');
    this.host=host;this.onText=onText;
  }
  async load(){return this.host.load?.()}
  cancel(){return this.host.cancel?.()}
  async infer(input){
    assertValidModelInput(input);const provider=providerFromHost(this.host);
    try{
      const hasConversation=Array.isArray(input.conversationMessages)&&input.conversationMessages.length>0;
      const explicitTurn=hasConversation?null:explicitUserTurn(input);
      const messages=hasConversation
        ?[{role:'system',content:buildTaskInstruction(input)},...input.conversationMessages]
        :explicitTurn
          ?[{role:'system',content:buildTaskInstruction(input)},{role:'user',content:explicitTurn.text}]
          :null;
      const hostContextManifest=oneShotHostContext(input,explicitTurn);
      const result=await this.host.generate({userText:messages?undefined:buildTaskInstruction(input),messages,contextManifest:hostContextManifest,maxNewTokens:input.maxResponseUnits,doSample:false,onText:this.onText||undefined});
      const cancelled=result.status==='cancelled';
      const accessibleArtifactIds=[...(explicitTurn?[explicitTurn.artifactId]:[]),...hostContextManifest.map(artifact=>artifact.artifactId)];
      return assertValidModelOutput({requestId:input.requestId,provider,status:cancelled?'cancelled':'ok',content:cancelled?null:{inferenceType:input.inferenceType,requestingModule:input.requestingModule,accessibleArtifactIds,conversationMessageCount:hasConversation?input.conversationMessages.length:0,text:result.text,confidenceBasis:'uncalibrated-generative-output'},confidence:cancelled?0:null,causalSourceIds:[...input.causalSourceIds],timing:{elapsedMs:result.telemetry?.elapsedMs??0,ttftMs:result.telemetry?.ttftMs??null,streamed:Boolean(result.telemetry?.streamed)},failure:cancelled?'cancelled by caller':null,epistemicStatus:cancelled?'error':input.expectedEpistemicStatus});
    }catch(error){
      return assertValidModelOutput({requestId:input.requestId,provider,status:'error',content:null,confidence:0,causalSourceIds:[...input.causalSourceIds],timing:{elapsedMs:0,ttftMs:null,streamed:false},failure:String(error?.message||error),epistemicStatus:'error'});
    }
  }
}
export function createBrowserTransformersCognitiveModel(options){return new BrowserTransformersCognitiveModel(options)}
