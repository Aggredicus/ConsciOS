import {assertValidModelInput,assertValidModelOutput} from './validation.mjs';
import {assertInferenceProvider,createProviderRecord} from './inference-provider.mjs';

export const SWARM_BRIDGE_PROTOCOL='conscios-swarm-bridge/v1';
export const SWARM_BRIDGE_CHANNEL='conscios-browser-compute-v1';

export class BrowserSwarmProvider extends EventTarget{
  constructor({channelFactory=name=>new BroadcastChannel(name),windowLike=globalThis.window,label='paired browser worker'}={}){
    super();this.id='browser-swarm';this.label=label;this.window=windowLike;this.channel=channelFactory(SWARM_BRIDGE_CHANNEL);this.bridgeId=null;this.capability=null;this.peerName=null;this.sessionId=null;this.rttMs=null;this.bridgeWindow=null;this.bridgeOrigin=null;this.bridgeToken=null;this.activeId=null;this.pending=new Map();this.waiters=new Map();
    this._onChannel=event=>{if(!this.bridgeWindow)this._handle(event.data,{transport:'broadcast'})};
    this._onWindow=event=>{if(!this.bridgeWindow||event.source!==this.bridgeWindow||event.origin!==this.bridgeOrigin)return;if(event.data?.bridgeToken!==this.bridgeToken)return;this._handle(event.data,{transport:'window'})};
    this.channel.addEventListener('message',this._onChannel);this.window?.addEventListener?.('message',this._onWindow);assertInferenceProvider(this);
  }
  record(){return createProviderRecord({id:this.id,label:this.label,kind:'browser-swarm-peer',location:'encrypted-webrtc-peer',remote:true})}
  attachWindow(windowRef,{origin,token}={}){
    if(!windowRef||!origin||!token)throw new TypeError('swarm bridge window, origin, and token are required');
    this.bridgeWindow=windowRef;this.bridgeOrigin=origin;this.bridgeToken=token;return this;
  }
  provenance(){return {kind:'browser-swarm-peer',name:this.label,hiddenState:'none',modelId:this.capability?.modelId??'unselected',runtime:'Transformers.js over ConsciOS swarm',inferenceLocation:'encrypted-webrtc-peer',remoteInference:true,peerName:this.peerName,sessionId:this.sessionId,transport:'WebRTC DataChannel + AES-256-GCM',remoteDevice:this.capability?.device??null,remoteWebGPU:this.capability?.webgpu??null,remoteSecureContext:this.capability?.secureContext??null}}
  _send(message){
    this.channel.postMessage(message);
    if(this.bridgeWindow&&!this.bridgeWindow.closed)this.bridgeWindow.postMessage({...message,bridgeToken:this.bridgeToken},this.bridgeOrigin);
  }
  _discover(requestId){this._send({type:'bridge-discover',bridgeProtocol:SWARM_BRIDGE_PROTOCOL,requestId})}
  async connect({timeoutMs=1500}={}){
    if(this.capability?.enabled&&this.bridgeId)return {status:'ready',provider:this.record(),capability:this.capability,peerName:this.peerName,sessionId:this.sessionId,rttMs:this.rttMs};
    const requestId=crypto.randomUUID();
    return new Promise((resolve,reject)=>{
      const timer=setTimeout(()=>{this.waiters.delete(requestId);reject(new Error('No verified browser compute worker found. Keep the Swarm pairing tab open and enable compute sharing.'))},timeoutMs);
      this.waiters.set(requestId,{resolve:value=>{clearTimeout(timer);resolve(value)},reject});
      this._discover(requestId);
    });
  }
  async waitForWorker({timeoutMs=180000,pollMs=1200}={}){
    const started=performance.now();
    while(performance.now()-started<timeoutMs){
      try{return await this.connect({timeoutMs:Math.min(1000,pollMs)})}catch{}
      await new Promise(resolve=>setTimeout(resolve,pollMs));
    }
    throw new Error('Timed out waiting for a paired browser compute worker.');
  }
  _handle(message){
    if(!message||message.bridgeProtocol!==SWARM_BRIDGE_PROTOCOL)return;
    if(message.type==='bridge-status'){
      if(message.available&&message.capability?.enabled){
        this.bridgeId=message.bridgeId;this.capability=message.capability;this.peerName=message.peerName??null;this.sessionId=message.sessionId??null;this.rttMs=message.rttMs??null;
        const ready={status:'ready',provider:this.record(),capability:this.capability,peerName:this.peerName,sessionId:this.sessionId,rttMs:this.rttMs};
        const waiter=this.waiters.get(message.requestId);if(waiter){this.waiters.delete(message.requestId);waiter.resolve(ready)}
        this.dispatchEvent(new CustomEvent('status',{detail:ready}));
      }
      return;
    }
    if(message.bridgeId!==this.bridgeId)return;
    const entry=this.pending.get(message.id);if(!entry)return;
    if(message.type==='bridge-compute-chunk'){entry.onText?.(String(message.chunk??''));return}
    if(message.type==='bridge-compute-error'){this.pending.delete(message.id);entry.resolve(this._errorOutput(entry.input,message.error));return}
    if(message.type==='bridge-compute-result'){
      this.pending.delete(message.id);const remote=message.result??{},cancelled=remote.status==='cancelled';
      const text=remote.content?.text;
      entry.resolve(assertValidModelOutput({requestId:entry.input.requestId,provider:this.provenance(),status:cancelled?'cancelled':remote.status==='ok'?'ok':'error',content:remote.status==='ok'?{inferenceType:entry.input.inferenceType,requestingModule:entry.input.requestingModule,accessibleArtifactIds:entry.input.contextManifest.map(item=>item.artifactId),conversationMessageCount:entry.input.conversationMessages?.length??0,text:String(text??''),confidenceBasis:'uncalibrated-generative-output'}:null,confidence:null,causalSourceIds:[...entry.input.causalSourceIds],timing:{...(remote.timing??{}),transportRttMs:this.rttMs,pooledResource:'browser-swarm-peer'},failure:remote.failure??(remote.status==='ok'?null:'remote browser worker failed'),epistemicStatus:remote.status==='ok'?entry.input.expectedEpistemicStatus:'error'}));
    }
  }
  _errorOutput(input,error){return assertValidModelOutput({requestId:input.requestId,provider:this.provenance(),status:'error',content:null,confidence:0,causalSourceIds:[...input.causalSourceIds],timing:{elapsedMs:0,ttftMs:null,streamed:false,transportRttMs:this.rttMs},failure:String(error||'remote browser worker error'),epistemicStatus:'error'})}
  async infer(input,{onText=null}={}){
    assertValidModelInput(input);
    if(!this.bridgeId||!this.capability?.enabled)return this._errorOutput(input,'paired browser compute worker is not connected');
    if(this.activeId)return this._errorOutput(input,'paired browser compute worker already has an active task');
    const id=crypto.randomUUID();this.activeId=id;
    try{
      const result=await new Promise(resolve=>{this.pending.set(id,{resolve,onText,input});this._send({type:'bridge-compute-request',bridgeProtocol:SWARM_BRIDGE_PROTOCOL,bridgeId:this.bridgeId,id,input})});
      return result;
    }finally{this.pending.delete(id);if(this.activeId===id)this.activeId=null}
  }
  cancel(){if(this.activeId&&this.bridgeId)this._send({type:'bridge-compute-cancel',bridgeProtocol:SWARM_BRIDGE_PROTOCOL,bridgeId:this.bridgeId,id:this.activeId})}
  dispose(){this.cancel();this.channel.removeEventListener('message',this._onChannel);this.channel.close?.();this.window?.removeEventListener?.('message',this._onWindow);for(const entry of this.pending.values())entry.resolve(this._errorOutput(entry.input,'browser swarm provider disposed'));this.pending.clear()}
}
export function createBrowserSwarmProvider(options){return new BrowserSwarmProvider(options)}
