import {SWARM_PROTOCOL,capabilityManifest,createSessionId,decodeEnvelope,encodeEnvelope,makeAnswerEnvelope,makeOfferEnvelope,normalizeExoEndpoint,shareUrl,waitForIceComplete} from './swarm-protocol.mjs';
import {buildRtcConfiguration,CONNECTION_MODES,DEFAULT_STUN_URL} from './swarm-network.mjs';
import {createEphemeralIdentity,decryptApplicationMessage,deriveSessionCrypto,encryptApplicationMessage} from './swarm-crypto.mjs';

export class QrSwarmPeer extends EventTarget{
  constructor({role,nickname='Peer',fetchImpl=globalThis.fetch}={}){
    super();if(!['host','guest'].includes(role))throw new TypeError('role must be host or guest');
    this.role=role;this.nickname=nickname;this.fetchImpl=fetchImpl;this.sessionId=null;this.exoEndpoint=null;this.peer=null;this.channel=null;this.remoteCapabilities=null;this.remoteNickname=null;this.lastRttMs=null;
    this.connectionMode='local';this.networkConfig=null;this.credentialExpiresAt=null;this.identity=null;this.remotePublicKey=null;this.sessionKey=null;this.safetyCode=null;this.safetyConfirmed=false;this.remoteVerified=false;this.transportInfo=null;
    this._pingStarted=new Map();this._pendingMessages=[];this._helloSent=false;
  }
  _emit(type,detail={}){this.dispatchEvent(new CustomEvent(type,{detail}))}
  async _identity(){if(!this.identity)this.identity=await createEphemeralIdentity();return this.identity}
  async _configureCrypto(remotePublicKey){
    const identity=await this._identity();this.remotePublicKey=remotePublicKey;
    const cryptoState=await deriveSessionCrypto({privateKey:identity.privateKey,localPublicKeyEncoded:identity.publicKeyEncoded,remotePublicKeyEncoded:remotePublicKey,sessionId:this.sessionId});
    this.sessionKey=cryptoState.key;this.safetyCode=cryptoState.safetyCode;this._emit('safety-code',{safetyCode:this.safetyCode,requiresConfirmation:this.connectionMode!=='local'});
    if(this.connectionMode==='local')this.confirmSafetyCode({automatic:true});
  }
  async _newPeer(network){
    const resolved=await buildRtcConfiguration({...network,fetchImpl:this.fetchImpl});this.networkConfig=resolved.configuration;this.credentialExpiresAt=resolved.credentialExpiresAt;
    const peer=new RTCPeerConnection(resolved.configuration);
    const state=()=>this._emit('state',{connectionState:peer.connectionState,iceConnectionState:peer.iceConnectionState});peer.addEventListener('connectionstatechange',()=>{state();if(peer.connectionState==='connected')this._emitSelectedTransport().catch(()=>{})});peer.addEventListener('iceconnectionstatechange',state);
    this.peer=peer;return peer;
  }
  async _emitSelectedTransport(){
    if(!this.peer)return;const stats=await this.peer.getStats();let pair=null;for(const report of stats.values())if(report.type==='candidate-pair'&&report.state==='succeeded'&&report.nominated){pair=report;break}if(!pair)return;
    const local=stats.get(pair.localCandidateId);const remote=stats.get(pair.remoteCandidateId);this.transportInfo={localCandidateType:local?.candidateType??null,remoteCandidateType:remote?.candidateType??null,protocol:local?.protocol??null,relayProtocol:local?.relayProtocol??null};this._emit('transport',this.transportInfo);
  }
  _bindChannel(channel){
    this.channel=channel;channel.addEventListener('open',()=>{this._emit('channel-open');this._maybeSendHello().catch(error=>this._emit('error',{message:error.message}))});
    channel.addEventListener('close',()=>this._emit('channel-close'));channel.addEventListener('error',event=>this._emit('error',{message:event?.error?.message||'WebRTC data channel error'}));channel.addEventListener('message',event=>this._handleWire(event.data).catch(error=>this._emit('error',{message:`Encrypted peer message rejected: ${error.message}`})));
  }
  async _handleWire(raw){
    const message=await decryptApplicationMessage(this.sessionKey,raw,{sessionId:this.sessionId});if(message?.protocol!==SWARM_PROTOCOL)throw new Error('peer protocol mismatch');
    if(!this.safetyConfirmed){this._pendingMessages.push(message);return}this._handleMessage(message);
  }
  _handleMessage(message){
    if(message.type==='verified'){this.remoteVerified=true;this._emit('verification',{local:true,remote:true,safetyCode:this.safetyCode});return}
    if(message.type==='hello'){this.remoteNickname=String(message.nickname||'Peer').slice(0,40);this.remoteCapabilities=message.capabilities??null;if(!this.exoEndpoint&&message.exoEndpoint)this.exoEndpoint=normalizeExoEndpoint(message.exoEndpoint);this._emit('peer',{nickname:this.remoteNickname,capabilities:this.remoteCapabilities,exoEndpoint:this.exoEndpoint});return}
    if(message.type==='ping'){this._sendEncrypted({type:'pong',protocol:SWARM_PROTOCOL,id:message.id}).catch(()=>{});return}
    if(message.type==='pong'){const started=this._pingStarted.get(message.id);if(started!==undefined){this._pingStarted.delete(message.id);this.lastRttMs=Math.max(0,performance.now()-started);this._emit('rtt',{rttMs:this.lastRttMs})}return}
    if(message.type==='exo-endpoint'){this.exoEndpoint=normalizeExoEndpoint(message.endpoint);this._emit('exo-endpoint',{exoEndpoint:this.exoEndpoint});return}this._emit('message',{message});
  }
  async _sendEncrypted(message){if(!this.channel||this.channel.readyState!=='open')throw new Error('swarm data channel is not open');if(!this.sessionKey)throw new Error('session encryption is not ready');this.channel.send(await encryptApplicationMessage(this.sessionKey,message,{sessionId:this.sessionId}))}
  async _maybeSendHello(){if(!this.safetyConfirmed||this._helloSent||this.channel?.readyState!=='open')return;this._helloSent=true;await this._sendEncrypted({type:'verified',protocol:SWARM_PROTOCOL});await this._sendEncrypted({type:'hello',protocol:SWARM_PROTOCOL,nickname:this.nickname,capabilities:capabilityManifest(),exoEndpoint:this.exoEndpoint})}
  confirmSafetyCode({automatic=false}={}){
    if(!this.sessionKey||!this.safetyCode)throw new Error('safety code is not ready');this.safetyConfirmed=true;const pending=this._pendingMessages.splice(0);for(const message of pending)this._handleMessage(message);this._maybeSendHello().catch(error=>this._emit('error',{message:error.message}));this._emit('verification',{local:true,remote:this.remoteVerified,safetyCode:this.safetyCode,automatic});return this.safetyCode;
  }
  async send(message){if(!this.safetyConfirmed)throw new Error('confirm the safety code before sending swarm data');await this._sendEncrypted(message)}
  async ping(){if(!this.safetyConfirmed)throw new Error('confirm the safety code first');const id=crypto.randomUUID();this._pingStarted.set(id,performance.now());await this._sendEncrypted({type:'ping',protocol:SWARM_PROTOCOL,id});return id}
  async setExoEndpoint(endpoint,{broadcast=true}={}){this.exoEndpoint=normalizeExoEndpoint(endpoint);if(broadcast&&this.channel?.readyState==='open')await this.send({type:'exo-endpoint',protocol:SWARM_PROTOCOL,endpoint:this.exoEndpoint});return this.exoEndpoint}
  async createOffer({exoEndpoint=null,connectionMode='local',stunUrls=[DEFAULT_STUN_URL],turnCredentialEndpoint=null}={}){
    if(this.role!=='host')throw new Error('only the host can create an offer');this.sessionId=createSessionId();this.exoEndpoint=normalizeExoEndpoint(exoEndpoint);this.connectionMode=connectionMode;const identity=await this._identity();
    const peer=await this._newPeer({mode:connectionMode,stunUrls,turnCredentialEndpoint});const channel=peer.createDataChannel('conscios-swarm',{ordered:true});this._bindChannel(channel);const offer=await peer.createOffer();await peer.setLocalDescription(offer);await waitForIceComplete(peer);
    const envelope=makeOfferEnvelope({sessionId:this.sessionId,description:peer.localDescription,cryptoPublicKey:identity.publicKeyEncoded,exoEndpoint:this.exoEndpoint,nickname:this.nickname,connectionMode,stunUrls,turnCredentialEndpoint});const encoded=await encodeEnvelope(envelope);return {envelope,encoded,url:shareUrl('offer',encoded)};
  }
  async acceptOffer(encoded){
    if(this.role!=='guest')throw new Error('only a guest can accept an offer');const offer=await decodeEnvelope(encoded);if(offer.kind!=='offer')throw new Error('expected offer envelope');
    this.sessionId=offer.sessionId;this.exoEndpoint=offer.exoEndpoint??null;this.remoteNickname=offer.nickname??'Host';this.connectionMode=offer.connectionMode;const identity=await this._identity();
    const peer=await this._newPeer({mode:offer.connectionMode,stunUrls:offer.stunUrls,turnCredentialEndpoint:offer.turnCredentialEndpoint});peer.addEventListener('datachannel',event=>this._bindChannel(event.channel),{once:true});await this._configureCrypto(offer.cryptoPublicKey);
    await peer.setRemoteDescription(offer.description);const answer=await peer.createAnswer();await peer.setLocalDescription(answer);await waitForIceComplete(peer);const envelope=makeAnswerEnvelope({sessionId:this.sessionId,description:peer.localDescription,cryptoPublicKey:identity.publicKeyEncoded,nickname:this.nickname});const answerEncoded=await encodeEnvelope(envelope);return {offer,envelope,encoded:answerEncoded,url:shareUrl('answer',answerEncoded)};
  }
  async acceptAnswer(encoded){
    if(this.role!=='host')throw new Error('only the host can accept an answer');const answer=await decodeEnvelope(encoded);if(answer.kind!=='answer')throw new Error('expected answer envelope');if(answer.sessionId!==this.sessionId)throw new Error('answer belongs to a different swarm session');
    await this._configureCrypto(answer.cryptoPublicKey);await this.peer.setRemoteDescription(answer.description);this.remoteNickname=answer.nickname??'Guest';return answer;
  }
  close(){try{this.channel?.close()}catch{}try{this.peer?.close()}catch{}this._pingStarted.clear();this._pendingMessages=[];this.sessionKey=null;this.identity=null;this._emit('closed')}
}

export {CONNECTION_MODES};
