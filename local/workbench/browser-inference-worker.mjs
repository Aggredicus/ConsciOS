import {detectBrowserAICapabilities,chooseBrowserExecution} from '../../runtime/models/browser-capabilities.mjs';
import {getCompactModel} from '../../runtime/models/compact-models.mjs';
import {createBrowserTransformersHost} from '../../runtime/models/browser-transformers-host.mjs';

const instruction='Answer the current user message directly using only the visible conversation and declared context. Do not claim hidden access, credentials, repository access, or external authority.';
let host=null,manifest=null,execution=null,capabilities=null,activeRequest=null;

const safeProgress=event=>({
  phase:event?.phase??null,status:event?.status??null,file:event?.file??null,name:event?.name??null,
  progress:Number.isFinite(Number(event?.progress))?Number(event.progress):null,
  loaded:Number.isFinite(Number(event?.loaded))?Number(event.loaded):null,
  total:Number.isFinite(Number(event?.total))?Number(event.total):null
});
const provider=()=>{const p=host?.provenance?.()??{};return {kind:'browser-transformers-local',name:manifest?.label??'Browser local model',modelId:p.modelId??manifest?.model??'unloaded',revision:p.revision??manifest?.revision??null,runtime:p.runtime??'Transformers.js worker',device:p.device??execution?.device??'unknown',dtype:p.dtype??execution?.dtype??'unknown',inferenceLocation:'browser-dedicated-worker',executionThread:'dedicated-worker',remoteInference:false,hiddenState:'none'}};
const send=(type,requestId,payload={})=>self.postMessage({type,requestId,...payload});
const fail=(requestId,error)=>send('error',requestId,{message:String(error?.message||error),stack:typeof error?.stack==='string'?error.stack:null});

async function load(requestId,modelId){
  const next=getCompactModel(modelId);if(!next)throw new Error('Select a browser model.');
  capabilities=await detectBrowserAICapabilities(globalThis);
  execution=chooseBrowserExecution(capabilities,{prefer:'webgpu'});
  const candidate=createBrowserTransformersHost({
    manifest:next,device:execution.device,dtype:execution.dtype,
    onProgress:event=>send('progress',requestId,{event:safeProgress(event)})
  });
  await candidate.load();
  host=candidate;manifest=next;
  send('ready',requestId,{manifest:{id:manifest.id,label:manifest.label,model:manifest.model},execution,capabilities,provenance:provider()});
}

async function infer(requestId,input){
  if(!host||!manifest)throw new Error('Browser model is not loaded.');
  if(activeRequest)throw new Error('Browser inference is already running.');
  activeRequest=requestId;
  const p=provider();
  try{
    const messages=[{role:'system',content:instruction},...(input?.conversationMessages??[])];
    const result=await host.generate({
      messages,contextManifest:input?.contextManifest??[],maxNewTokens:input?.maxResponseUnits??256,
      onText:chunk=>send('text',requestId,{chunk:String(chunk??'')}),doSample:false,measureBoundary:false
    });
    const cancelled=result.status==='cancelled';
    send('result',requestId,{result:{
      requestId:input?.requestId,provider:p,status:cancelled?'cancelled':'ok',
      content:cancelled?null:{text:result.text},causalSourceIds:[...(input?.causalSourceIds??[])],
      timing:{elapsedMs:result.telemetry?.elapsedMs??0,ttftMs:result.telemetry?.ttftMs??null,streamed:Boolean(result.telemetry?.streamed),executionThread:'dedicated-worker'},
      failure:cancelled?'cancelled by caller':null
    }});
  }finally{activeRequest=null}
}

self.onmessage=event=>{
  const message=event.data??{},requestId=message.requestId;
  if(message.type==='cancel'){host?.cancel?.();return}
  if(message.type==='dispose'){host?.cancel?.();host=null;manifest=null;execution=null;capabilities=null;activeRequest=null;send('disposed',requestId);return}
  Promise.resolve(message.type==='load'?load(requestId,message.modelId):message.type==='infer'?infer(requestId,message.input):Promise.reject(new Error(`Unknown worker message '${message.type}'`))).catch(error=>{if(activeRequest===requestId)activeRequest=null;fail(requestId,error)});
};
