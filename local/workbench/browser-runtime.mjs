import {detectBrowserAICapabilities,chooseBrowserExecution} from '../../runtime/models/browser-capabilities.mjs';
import {getCompactModel} from '../../runtime/models/compact-models.mjs';
import {createBrowserTransformersHost} from '../../runtime/models/browser-transformers-host.mjs';

const instruction='Answer the current user message directly using only the visible conversation and declared context. Do not claim hidden access, credentials, repository access, or external authority.';

function browserProvider(host,label){
  const base=()=>{const p=host.provenance();return {kind:'browser-transformers-local',name:label,modelId:p.modelId,revision:p.revision,runtime:p.runtime,device:p.device,dtype:p.dtype,inferenceLocation:'browser-local',remoteInference:false,hiddenState:'none'}};
  return {
    id:'browser-local',provenance:base,cancel:()=>host.cancel(),
    async infer(input,{onText=()=>{}}={}){
      const provider=base();
      try{
        const messages=[{role:'system',content:instruction},...(input.conversationMessages??[])];
        const result=await host.generate({messages,contextManifest:input.contextManifest??[],maxNewTokens:input.maxResponseUnits??256,onText,doSample:false,measureBoundary:false});
        const cancelled=result.status==='cancelled';
        return {requestId:input.requestId,provider,status:cancelled?'cancelled':'ok',content:cancelled?null:{text:result.text},causalSourceIds:[...(input.causalSourceIds??[])],timing:{elapsedMs:result.telemetry?.elapsedMs??0,ttftMs:result.telemetry?.ttftMs??null,streamed:Boolean(result.telemetry?.streamed)},failure:cancelled?'cancelled by caller':null};
      }catch(error){
        return {requestId:input.requestId,provider,status:'error',content:null,causalSourceIds:[...(input.causalSourceIds??[])],timing:{elapsedMs:0,ttftMs:null,streamed:false},failure:String(error?.message||error)};
      }
    }
  };
}

export async function loadBrowserProvider({modelId,onProgress=()=>{}}={}){
  const manifest=getCompactModel(modelId);if(!manifest)throw new Error('Select a browser model.');
  const capabilities=await detectBrowserAICapabilities(),execution=chooseBrowserExecution(capabilities,{prefer:'webgpu'});
  const host=createBrowserTransformersHost({manifest,device:execution.device,dtype:execution.dtype,onProgress});
  await host.load();
  return {provider:browserProvider(host,manifest.label),manifest,execution,capabilities};
}
