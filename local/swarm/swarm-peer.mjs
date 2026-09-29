import {SWARM_PROTOCOL,capabilityManifest,createSessionId,decodeEnvelope,encodeEnvelope,makeAnswerEnvelope,makeOfferEnvelope,normalizeExoEndpoint,shareUrl,waitForIceComplete} from './swarm-protocol.mjs';

export class QrSwarmPeer extends EventTarget{
  constructor({role,nickname='Peer'}={}){
    super();
    if(!['host','guest'].includes(role))throw new TypeError('role must be host or guest');
    this.role=role;this.nickname=nickname;this.sessionId=null;this.exoEndpoint=null;this.peer=null;this.channel=null;this.remoteCapabilities=null;this.remoteNickname=null;this.lastRttMs=null;this._pingStarted=new Map();
  }
  _emit(type,detail={}){this.dispatchEvent(new CustomEvent(type,{detail}))}
  _newPeer(){
    const peer=new RTCPeerConnection({iceServers:[]});
    peer.addEventListener('connectionstatechange',()=>this._emit('state',{connectionState:peer.connectionState,iceConnectionState:peer.iceConnectionState}));
    peer.addEventListener('iceconnectionstatechange',()=>this._emit('state',{connectionState:peer.connectionState,iceConnectionState:peer.iceConnectionState}));
    this.peer=peer;return peer;
  }
  _bindChannel(channel){
    this.channel=channel;
    channel.addEventListener('open',()=>{
      this._emit('channel-open');
      this.send({type:'hello',protocol:SWARM_PROTOCOL,nickname:this.nickname,capabilities:capabilityManifest(),exoEndpoint:this.exoEndpoint});
    });
    channel.addEventListener('close',()=>this._emit('channel-close'));
    channel.addEventListener('error',event=>this._emit('error',{message:event?.error?.message||'WebRTC data channel error'}));
    channel.addEventListener('message',event=>this._handleMessage(event.data));
  }
  _handleMessage(raw){
    let message;try{message=JSON.parse(raw)}catch{return this._emit('error',{message:'Peer sent invalid JSON'})}
    if(message?.protocol&&message.protocol!==SWARM_PROTOCOL)return this._emit('error',{message:'Peer protocol mismatch'});
    if(message.type==='hello'){
      this.remoteNickname=String(message.nickname||'Peer').slice(0,40);this.remoteCapabilities=message.capabilities??null;
      if(!this.exoEndpoint&&message.exoEndpoint)this.exoEndpoint=normalizeExoEndpoint(message.exoEndpoint);
      this._emit('peer',{nickname:this.remoteNickname,capabilities:this.remoteCapabilities,exoEndpoint:this.exoEndpoint});return;
    }
    if(message.type==='ping'){this.send({type:'pong',protocol:SWARM_PROTOCOL,id:message.id});return}
    if(message.type==='pong'){
      const started=this._pingStarted.get(message.id);if(started!==undefined){this._pingStarted.delete(message.id);this.lastRttMs=Math.max(0,performance.now()-started);this._emit('rtt',{rttMs:this.lastRttMs})}return;
    }
    if(message.type==='exo-endpoint'){
      this.exoEndpoint=normalizeExoEndpoint(message.endpoint);this._emit('exo-endpoint',{exoEndpoint:this.exoEndpoint});return;
    }
    this._emit('message',{message});
  }
  send(message){
    if(!this.channel||this.channel.readyState!=='open')throw new Error('swarm data channel is not open');
    this.channel.send(JSON.stringify(message));
  }
  ping(){const id=crypto.randomUUID();this._pingStarted.set(id,performance.now());this.send({type:'ping',protocol:SWARM_PROTOCOL,id});return id}
  setExoEndpoint(endpoint,{broadcast=true}={}){
    this.exoEndpoint=normalizeExoEndpoint(endpoint);
    if(broadcast&&this.channel?.readyState==='open')this.send({type:'exo-endpoint',protocol:SWARM_PROTOCOL,endpoint:this.exoEndpoint});
    return this.exoEndpoint;
  }
  async createOffer({exoEndpoint=null}={}){
    if(this.role!=='host')throw new Error('only the host can create an offer');
    this.sessionId=createSessionId();this.exoEndpoint=normalizeExoEndpoint(exoEndpoint);
    const peer=this._newPeer();const channel=peer.createDataChannel('conscios-swarm',{ordered:true});this._bindChannel(channel);
    const offer=await peer.createOffer();await peer.setLocalDescription(offer);await waitForIceComplete(peer);
    const envelope=makeOfferEnvelope({sessionId:this.sessionId,description:peer.localDescription,exoEndpoint:this.exoEndpoint,nickname:this.nickname});
    const encoded=await encodeEnvelope(envelope);return {envelope,encoded,url:shareUrl('offer',encoded)};
  }
  async acceptOffer(encoded){
    if(this.role!=='guest')throw new Error('only a guest can accept an offer');
    const offer=await decodeEnvelope(encoded);if(offer.kind!=='offer')throw new Error('expected offer envelope');
    this.sessionId=offer.sessionId;this.exoEndpoint=offer.exoEndpoint??null;this.remoteNickname=offer.nickname??'Host';
    const peer=this._newPeer();peer.addEventListener('datachannel',event=>this._bindChannel(event.channel),{once:true});
    await peer.setRemoteDescription(offer.description);const answer=await peer.createAnswer();await peer.setLocalDescription(answer);await waitForIceComplete(peer);
    const envelope=makeAnswerEnvelope({sessionId:this.sessionId,description:peer.localDescription,nickname:this.nickname});
    const answerEncoded=await encodeEnvelope(envelope);return {offer,envelope,encoded:answerEncoded,url:shareUrl('answer',answerEncoded)};
  }
  async acceptAnswer(encoded){
    if(this.role!=='host')throw new Error('only the host can accept an answer');
    const answer=await decodeEnvelope(encoded);if(answer.kind!=='answer')throw new Error('expected answer envelope');
    if(answer.sessionId!==this.sessionId)throw new Error('answer belongs to a different swarm session');
    await this.peer.setRemoteDescription(answer.description);this.remoteNickname=answer.nickname??'Guest';return answer;
  }
  close(){
    try{this.channel?.close()}catch{}try{this.peer?.close()}catch{}
    this._pingStarted.clear();this._emit('closed');
  }
}
