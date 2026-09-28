import {assertInferenceProvider,createProviderRecord} from './inference-provider.mjs';

export class BrowserLocalInferenceProvider{
  constructor({model,label='Browser local model'}={}){
    if(!model||typeof model.infer!=='function')throw new TypeError('CognitiveModel with infer() is required');
    this.id='browser-local';this.model=model;this.label=label;
    assertInferenceProvider(this);
  }
  record(){return createProviderRecord({id:this.id,label:this.label,kind:'browser-transformers-local',location:'browser-local',remote:false})}
  async connect(){return {status:'ready',provider:this.record(),provenance:this.provenance()}}
  provenance(){
    const host=this.model?.host;const p=host&&typeof host.provenance==='function'?host.provenance():{};
    return {kind:'browser-transformers-local',name:this.label,hiddenState:'none',modelId:p.modelId??'unloaded',revision:p.revision??null,runtime:p.runtime??'browser CognitiveModel',device:p.device??'wasm',dtype:p.dtype??'unknown',inferenceLocation:'browser-local',remoteInference:false};
  }
  infer(input){return this.model.infer(input)}
  cancel(){return this.model.cancel?.()}
}

export function createBrowserLocalInferenceProvider(options){return new BrowserLocalInferenceProvider(options)}
