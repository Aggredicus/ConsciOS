import { assertValidModelInput, assertValidModelOutput } from './validation.mjs';

function buildTaskInstruction(input){
  return [
    `ConsciOS inference task: ${input.inferenceType}.`,
    'Use only the explicitly declared context artifacts supplied by the host.',
    'Return only the requested inference; do not claim access to undeclared context or system state.'
  ].join(' ');
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
      const result=await this.host.generate({userText:buildTaskInstruction(input),contextManifest:input.contextManifest,maxNewTokens:input.maxResponseUnits,doSample:false,onText:this.onText||undefined});
      const cancelled=result.status==='cancelled';
      return assertValidModelOutput({requestId:input.requestId,provider,status:cancelled?'cancelled':'ok',content:cancelled?null:{inferenceType:input.inferenceType,requestingModule:input.requestingModule,accessibleArtifactIds:[...result.contextArtifactIds],text:result.text,confidenceBasis:'uncalibrated-generative-output'},confidence:cancelled?0:null,causalSourceIds:[...input.causalSourceIds],timing:{elapsedMs:result.telemetry?.elapsedMs??0,ttftMs:result.telemetry?.ttftMs??null,streamed:Boolean(result.telemetry?.streamed)},failure:cancelled?'cancelled by caller':null,epistemicStatus:cancelled?'error':input.expectedEpistemicStatus});
    }catch(error){
      return assertValidModelOutput({requestId:input.requestId,provider,status:'error',content:null,confidence:0,causalSourceIds:[...input.causalSourceIds],timing:{elapsedMs:0,ttftMs:null,streamed:false},failure:String(error?.message||error),epistemicStatus:'error'});
    }
  }
}
export function createBrowserTransformersCognitiveModel(options){return new BrowserTransformersCognitiveModel(options)}
