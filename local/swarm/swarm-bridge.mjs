import {SWARM_PROTOCOL} from './swarm-protocol.mjs';
import {BROWSER_COMPUTE_PROTOCOL} from './swarm-compute.mjs';

export const SWARM_BRIDGE_PROTOCOL='conscios-swarm-bridge/v1';
export const SWARM_BRIDGE_CHANNEL='conscios-browser-compute-v1';

export class BrowserSwarmBridge{
  constructor({peer,channelFactory=name=>new BroadcastChannel(name),windowLike=globalThis.window}={}){
    if(!peer)throw new TypeError('swarm peer is required');
    this.peer=peer;this.bridgeId=crypto.randomUUID();this.remoteCapability=null;this.channel=channelFactory(SWARM_BRIDGE_CHANNEL);this.window=windowLike;
    const fragment=new URLSearchParams(String(windowLike?.location?.hash??'').replace(/^#/,'')),query=new URLSearchParams(windowLike?.location?.search??'');this.bridgeToken=fragment.get('bridge')||query.get('bridge')||null;this.openerOrigin=fragment.get('openerOrigin')||query.get('openerOrigin')||null;
    this._onLocal=event=>this._handleLocal(event.data).catch(()=>{});
    this._onWindow=event=>{if(!this.bridgeToken||event.source!==this.window?.opener||event.origin!==this.openerOrigin)return;const data=event.data;if(data?.bridgeToken!==this.bridgeToken)return;this._handleLocal(data).catch(()=>{})};
    this._onPeerMessage=event=>this._handlePeer(event.detail?.message);
    this._onPeerState=()=>this.broadcastStatus();
    this.channel.addEventListener('message',this._onLocal);this.window?.addEventListener?.('message',this._onWindow);
    peer.addEventListener('message',this._onPeerMessage);peer.addEventListener('verification',this._onPeerState);peer.addEventListener('state',this._onPeerState);peer.addEventListener('rtt',this._onPeerState);
    queueMicrotask(()=>this.broadcastStatus());
  }
  available(){return Boolean(this.peer.safetyConfirmed&&this.peer.remoteVerified&&this.remoteCapability?.enabled)}
  status(requestId=null){return {type:'bridge-status',bridgeProtocol:SWARM_BRIDGE_PROTOCOL,bridgeId:this.bridgeId,bridgeToken:this.bridgeToken,requestId,available:this.available(),capability:this.remoteCapability,peerName:this.peer.remoteNickname??null,sessionId:this.peer.sessionId??null,rttMs:this.peer.lastRttMs??null,transport:this.peer.transportInfo??null}}
  _sendLocal(message){
    this.channel.postMessage(message);
    if(this.bridgeToken&&this.openerOrigin&&this.window?.opener&&!this.window.opener.closed)this.window.opener.postMessage({...message,bridgeToken:this.bridgeToken},this.openerOrigin);
  }
  broadcastStatus(requestId=null){this._sendLocal(this.status(requestId))}
  async _handleLocal(message){
    if(!message||message.bridgeProtocol!==SWARM_BRIDGE_PROTOCOL)return;
    if(message.type==='bridge-discover'){this.broadcastStatus(message.requestId??null);return}
    if(message.bridgeId!==this.bridgeId)return;
    if(message.type==='bridge-compute-request'){
      if(!this.available()){this._sendLocal({type:'bridge-compute-error',bridgeProtocol:SWARM_BRIDGE_PROTOCOL,bridgeId:this.bridgeId,id:message.id,error:'paired browser compute worker is unavailable'});return}
      await this.peer.send({protocol:SWARM_PROTOCOL,computeProtocol:BROWSER_COMPUTE_PROTOCOL,type:'compute-request',id:message.id,input:message.input});return;
    }
    if(message.type==='bridge-compute-cancel')await this.peer.send({protocol:SWARM_PROTOCOL,computeProtocol:BROWSER_COMPUTE_PROTOCOL,type:'compute-cancel',id:message.id});
  }
  _handlePeer(message){
    if(!message||message.protocol!==SWARM_PROTOCOL||message.computeProtocol!==BROWSER_COMPUTE_PROTOCOL)return;
    if(message.type==='compute-capability'){this.remoteCapability=message.capability??null;this.broadcastStatus();return}
    if(['compute-chunk','compute-result','compute-error'].includes(message.type))this._sendLocal({type:`bridge-${message.type}`,bridgeProtocol:SWARM_BRIDGE_PROTOCOL,bridgeId:this.bridgeId,id:message.id,...(message.chunk!==undefined?{chunk:message.chunk}:{}),...(message.result!==undefined?{result:message.result}:{}),...(message.error!==undefined?{error:message.error}:{})});
  }
  dispose(){
    this.channel.removeEventListener('message',this._onLocal);this.channel.close?.();this.window?.removeEventListener?.('message',this._onWindow);
    this.peer.removeEventListener('message',this._onPeerMessage);this.peer.removeEventListener('verification',this._onPeerState);this.peer.removeEventListener('state',this._onPeerState);this.peer.removeEventListener('rtt',this._onPeerState);
  }
}
export function createBrowserSwarmBridge(options){return new BrowserSwarmBridge(options)}
