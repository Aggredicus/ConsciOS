import {decodeEnvelope,displayCode,pairingPayloadFromHash} from './swarm-protocol.mjs';
import {QrSwarmPeer} from './swarm-peer.mjs';
import {renderQr,QR_MODULE_URL} from './qr.mjs';

const $=id=>document.getElementById(id);
const pairChannel=new BroadcastChannel('conscios-swarm-pairing-v1');
let activePeer=null;let pendingOffer=null;

function show(id,visible=true){$(id).classList.toggle('hidden',!visible)}
function setStatus(message,tone=''){$('globalStatus').textContent=message;$('globalStatus').className=`status ${tone}`}
function pretty(value){try{return JSON.stringify(value,null,2)}catch{return String(value)}}
function updateProvenance(extra={}){$('provenance').textContent=pretty({protocol:'conscios-swarm/v1',transport:'WebRTC DataChannel',signaling:'QR URL fragment / same-origin handoff only',iceServers:[],qrRenderer:QR_MODULE_URL,role:activePeer?.role??null,sessionId:activePeer?.sessionId??null,exoEndpoint:activePeer?.exoEndpoint??null,remoteNickname:activePeer?.remoteNickname??null,remoteCapabilities:activePeer?.remoteCapabilities??null,lastRttMs:activePeer?.lastRttMs??null,...extra})}
async function copyText(text){await navigator.clipboard.writeText(text);setStatus('Copied pairing link.','ok')}
function nickname(){return $('nickname').value.trim()||'Phone'}

function bindPeer(peer){
  activePeer=peer;
  peer.addEventListener('state',event=>{
    const state=event.detail.connectionState||event.detail.iceConnectionState||'connecting';$('connectionPill').textContent=state;
    if(state==='connected'){show('connectedCard');setStatus('Direct peer connection established.','ok')}
    updateProvenance({connectionState:state});
  });
  peer.addEventListener('peer',event=>{
    $('peerName').textContent=event.detail.nickname||'Peer';$('peerCapability').textContent=pretty(event.detail.capabilities);
    $('connectedExo').textContent=event.detail.exoEndpoint||peer.exoEndpoint||'No exo endpoint shared.';show('connectedCard');updateProvenance();
  });
  peer.addEventListener('exo-endpoint',event=>{$('connectedExo').textContent=event.detail.exoEndpoint||'No exo endpoint shared.';updateProvenance()});
  peer.addEventListener('rtt',event=>{$('rtt').textContent=`Round-trip: ${event.detail.rttMs.toFixed(1)} ms`;updateProvenance()});
  peer.addEventListener('channel-close',()=>setStatus('Peer data channel closed.','warn'));
  peer.addEventListener('error',event=>setStatus(event.detail.message||'Peer error.','bad'));
}

async function createHost(){
  cleanupPeer();const peer=new QrSwarmPeer({role:'host',nickname:nickname()});bindPeer(peer);
  setStatus('Creating local WebRTC offer…','warn');
  const result=await peer.createOffer({exoEndpoint:$('exoEndpoint').value.trim()||null});
  $('offerLink').value=result.url;$('offerCode').textContent=displayCode(peer.sessionId);show('inviteCard');show('joinCard',false);show('answerCard',false);
  $('hostStatus').textContent='Invite ready. Waiting for the guest answer QR.';
  const qrMeta=await renderQr($('offerQr'),result.url,{cellSize:3,margin:12});
  updateProvenance({pairing:'host-offer-ready',qrCharacters:qrMeta.characters,qrModules:qrMeta.moduleCount});
  setStatus('Invite ready. Let Phone B scan the QR.','ok');
}

async function loadOffer(encoded){
  const offer=await decodeEnvelope(encoded);if(offer.kind!=='offer')throw new Error('Expected a swarm offer.');pendingOffer={encoded,offer};
  $('joinHost').textContent=offer.nickname||'Host';$('joinCode').textContent=displayCode(offer.sessionId);$('joinExo').textContent=offer.exoEndpoint||'none';$('joinExpires').textContent=new Date(offer.expiresAt).toLocaleTimeString();
  show('modeCard',false);show('inviteCard',false);show('joinCard');show('answerCard',false);
  updateProvenance({pairing:'offer-loaded',sessionId:offer.sessionId,offerHost:offer.nickname,exoEndpoint:offer.exoEndpoint});setStatus('Invitation loaded. Review it, then tap Join.','warn');
}

async function joinOffer(){
  if(!pendingOffer)throw new Error('No invitation loaded.');cleanupPeer();const peer=new QrSwarmPeer({role:'guest',nickname:nickname()});bindPeer(peer);
  $('joinStatus').textContent='Creating direct WebRTC answer…';const result=await peer.acceptOffer(pendingOffer.encoded);
  $('answerLink').value=result.url;show('answerCard');$('joinStatus').textContent='Answer ready. Let the host scan the answer QR.';
  const qrMeta=await renderQr($('answerQr'),result.url,{cellSize:3,margin:12});updateProvenance({pairing:'guest-answer-ready',qrCharacters:qrMeta.characters,qrModules:qrMeta.moduleCount});setStatus('Joined locally. Host must scan the answer QR to complete pairing.','ok');
}

async function applyAnswer(encoded,{source='manual'}={}){
  const answer=await decodeEnvelope(encoded);if(answer.kind!=='answer')throw new Error('Expected a swarm answer.');
  if(!activePeer||activePeer.role!=='host'||activePeer.sessionId!==answer.sessionId){
    localStorage.setItem(`conscios-swarm-answer:${answer.sessionId}`,encoded);pairChannel.postMessage({type:'answer',sessionId:answer.sessionId,encoded});
    show('modeCard',false);show('inviteCard',false);show('joinCard',false);show('answerCard',false);$('globalStatus').textContent='Answer delivered to the original host tab if it is open. You may close this tab.';updateProvenance({pairing:'answer-relay',sessionId:answer.sessionId,source});return;
  }
  await activePeer.acceptAnswer(encoded);$('hostStatus').textContent='Answer accepted. Establishing direct peer link…';setStatus('Answer accepted. Connecting directly…','ok');updateProvenance({pairing:'answer-applied',source});
}

function cleanupPeer(){if(activePeer){activePeer.close();activePeer=null}show('connectedCard',false)}
function reset(){cleanupPeer();pendingOffer=null;history.replaceState(null,'',location.pathname+location.search);show('modeCard');show('inviteCard',false);show('joinCard',false);show('answerCard',false);setStatus('Ready.');updateProvenance()}

async function applyLink(text){
  const value=String(text||'').trim();if(!value)throw new Error('Paste a pairing link first.');const url=new URL(value,location.href);const payload=pairingPayloadFromHash(url.hash);if(!payload)throw new Error('This is not a ConsciOS swarm pairing link.');
  if(payload.kind==='offer')await loadOffer(payload.encoded);else await applyAnswer(payload.encoded,{source:'pasted-link'});
}

pairChannel.addEventListener('message',event=>{
  const msg=event.data;if(msg?.type!=='answer'||!activePeer||activePeer.role!=='host'||msg.sessionId!==activePeer.sessionId)return;
  applyAnswer(msg.encoded,{source:'broadcast-channel'}).catch(error=>setStatus(error.message,'bad'));
});
window.addEventListener('storage',event=>{
  if(!activePeer||activePeer.role!=='host'||event.key!==`conscios-swarm-answer:${activePeer.sessionId}`||!event.newValue)return;
  applyAnswer(event.newValue,{source:'storage-event'}).catch(error=>setStatus(error.message,'bad'));
});

$('createButton').addEventListener('click',()=>createHost().catch(error=>setStatus(error.message,'bad')));
$('joinButton').addEventListener('click',()=>joinOffer().catch(error=>setStatus(error.message,'bad')));
$('applyManual').addEventListener('click',()=>applyLink($('manualPayload').value).catch(error=>setStatus(error.message,'bad')));
$('copyOffer').addEventListener('click',()=>copyText($('offerLink').value).catch(error=>setStatus(error.message,'bad')));
$('copyAnswer').addEventListener('click',()=>copyText($('answerLink').value).catch(error=>setStatus(error.message,'bad')));
$('cancelHost').addEventListener('click',reset);$('leaveButton').addEventListener('click',reset);
$('pingButton').addEventListener('click',()=>{try{activePeer?.ping();$('rtt').textContent='Ping sent…'}catch(error){setStatus(error.message,'bad')}});
$('openWorkbench').addEventListener('click',()=>{
  const endpoint=activePeer?.exoEndpoint;if(endpoint)localStorage.setItem('conscios-exo-endpoint',endpoint);
  location.href='../workbench/';
});

const initial=pairingPayloadFromHash();
if(initial?.kind==='offer')loadOffer(initial.encoded).catch(error=>setStatus(error.message,'bad'));
else if(initial?.kind==='answer')applyAnswer(initial.encoded,{source:'scanned-answer'}).catch(error=>setStatus(error.message,'bad'));
else updateProvenance();
