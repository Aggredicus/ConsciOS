import {SWARM_PROTOCOL} from './swarm-protocol.mjs';

export const BROWSER_COMPUTE_PROTOCOL='conscios-browser-compute/v1';
export const COMPUTE_MODELS=Object.freeze([
  {id:'smollm2-135m-instruct',label:'SmolLM2 135M · 117 MB'},
  {id:'qwen3-0.6b',label:'Qwen3 0.6B · 570 MB'}
]);

const enc=new TextEncoder();
const bytes=value=>enc.encode(JSON.stringify(value??null)).byteLength;

function boundedInput(input){
  if(!input||typeof input!=='object')throw new TypeError('compute input is required');
  const messages=Array.isArray(input.conversationMessages)?input.conversationMessages:[];
  if(messages.length>9)throw new Error('remote compute context exceeds 9 messages');
  for(const message of messages)if(!['user','assistant'].includes(message?.role)||typeof message?.content!=='string')throw new Error('remote compute conversation is invalid');
  if(bytes(messages)>12000)throw new Error('remote compute context exceeds 12 KB');
  const max=Math.min(4096,Math.max(64,Number(input.maxResponseUnits)||512));
  return {...input,conversationMessages:messages,maxResponseUnits:max,contextManifest:Array.isArray(input.contextManifest)?input.contextManifest.slice(0,4):[],causalSourceIds:Array.isArray(input.causalSourceIds)?input.causalSourceIds.slice(0,16):[],hiddenContextPolicy:'none'};
}
function computeMessage(type,fields={}){return {protocol:SWARM_PROTOCOL,computeProtocol:BROWSER_COMPUTE_PROTOCOL,type,...fields}}

export class BrowserSwarmComputeWorker{
  constructor({peer,onStatus=()=>{},loadProvider=null}={}){
    if(!peer)throw new TypeError('swarm peer is required');
    this.peer=peer;this.onStatus=onStatus;this.loadProvider=loadProvider;this.provider=null;this.manifest=null;this.execution=null;this.busyId=null;this.enabled=false;this._send=Promise.resolve();
    this._onMessage=event=>this._handle(event.detail?.message).catch(error=>this.onStatus({state:'error',message:String(error?.message||error)}));
    peer.addEventListener('message',this._onMessage);
    peer.addEventListener('verification',event=>{if(this.enabled&&event.detail?.local&&event.detail?.remote)this.announce().catch(()=>{})});
  }
  capability(){
    if(!this.enabled||!this.provider)return {enabled:false,protocol:BROWSER_COMPUTE_PROTOCOL};
    const p=this.provider.provenance?.()??{};
    return {enabled:true,protocol:BROWSER_COMPUTE_PROTOCOL,modelId:p.modelId??this.manifest?.model??this.manifest?.id??'unknown',label:this.manifest?.label??'Browser model',device:p.device??this.execution?.device??'unknown',dtype:p.dtype??this.execution?.dtype??'unknown',executionThread:p.executionThread??'dedicated-worker',webgpu:Boolean(navigator.gpu),secureContext:Boolean(globalThis.isSecureContext),concurrency:1,maxResponseUnits:4096,maxContextMessages:9,maxContextBytes:12000};
  }
  _queue(message){this._send=this._send.catch(()=>{}).then(()=>this.peer.send(message));return this._send}
  async announce(){if(!this.peer.safetyConfirmed)return;await this._queue(computeMessage('compute-capability',{capability:this.capability()}))}
  async start(modelId,{onProgress=()=>{}}={}){
    this.onStatus({state:'loading',message:'Loading browser compute model…'});
    this.provider?.dispose?.();this.provider=null;this.manifest=null;this.execution=null;
    const loader=this.loadProvider??(await import('../workbench/browser-runtime.mjs')).loadBrowserProvider;
    const loaded=await loader({modelId,onProgress});
    this.provider=loaded.provider;this.manifest=loaded.manifest;this.execution=loaded.execution;this.enabled=true;
    await this.announce();
    const capability=this.capability();this.onStatus({state:'ready',message:`${capability.label} ready on ${capability.device}`,capability});return capability;
  }
  async stop(){
    this.enabled=false;this.provider?.cancel?.();this.provider?.dispose?.();this.provider=null;this.manifest=null;this.execution=null;this.busyId=null;
    await this.announce().catch(()=>{});this.onStatus({state:'off',message:'Browser compute sharing is off.'});
  }
  async _handle(message){
    if(!message||message.protocol!==SWARM_PROTOCOL||message.computeProtocol!==BROWSER_COMPUTE_PROTOCOL)return;
    if(message.type==='compute-cancel'&&message.id===this.busyId){this.provider?.cancel?.();return}
    if(message.type!=='compute-request')return;
    const id=String(message.id??'');if(!id)return;
    if(!this.enabled||!this.provider){await this._queue(computeMessage('compute-error',{id,error:'browser compute is not enabled'}));return}
    if(this.busyId){await this._queue(computeMessage('compute-error',{id,error:'browser compute worker is busy'}));return}
    this.busyId=id;const started=performance.now();this.onStatus({state:'busy',message:'Running remote swarm inference…',id});
    try{
      const input=boundedInput(message.input);
      const result=await this.provider.infer(input,{onText:chunk=>{if(chunk)this._queue(computeMessage('compute-chunk',{id,chunk:String(chunk)})).catch(()=>{})}});
      await this._send;
      await this._queue(computeMessage('compute-result',{id,result:{status:result.status,content:result.content,timing:{...result.timing,workerElapsedMs:Math.max(0,performance.now()-started)},provider:result.provider,failure:result.failure??null}}));
      this.onStatus({state:'ready',message:'Remote inference complete.',id,result});
    }catch(error){
      await this._queue(computeMessage('compute-error',{id,error:String(error?.message||error)})).catch(()=>{});
      this.onStatus({state:'error',message:String(error?.message||error),id});
    }finally{this.busyId=null}
  }
  dispose(){this.peer.removeEventListener('message',this._onMessage);this.provider?.dispose?.();this.provider=null;this.enabled=false}
}

export function createBrowserSwarmComputeWorker(options){return new BrowserSwarmComputeWorker(options)}
