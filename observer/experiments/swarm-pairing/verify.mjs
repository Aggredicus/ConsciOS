import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {SWARM_PROTOCOL,decodeEnvelope,displayCode,encodeEnvelope,makeAnswerEnvelope,makeOfferEnvelope,normalizeExoEndpoint,shareUrl} from '../../../local/swarm/swarm-protocol.mjs';
import {buildRtcConfiguration,DEFAULT_STUN_URL,normalizeCredentialEndpoint,sanitizeDescriptionForMode} from '../../../local/swarm/swarm-network.mjs';
import {createEphemeralIdentity,decryptApplicationMessage,deriveSessionCrypto,encryptApplicationMessage} from '../../../local/swarm/swarm-crypto.mjs';
import {mintCoturnCredential} from '../../../infrastructure/turn-credentials/worker.mjs';
import {BROWSER_COMPUTE_PROTOCOL,createBrowserSwarmComputeWorker} from '../../../local/swarm/swarm-compute.mjs';
import {SWARM_BRIDGE_PROTOCOL,createBrowserSwarmBridge} from '../../../local/swarm/swarm-bridge.mjs';

const now=Date.now();const hostKey='A'.repeat(87);const guestKey='B'.repeat(87);
const offer=makeOfferEnvelope({sessionId:'ABCDEFGH1234',nickname:'Host phone',exoEndpoint:'http://192.168.1.10:52415/',cryptoPublicKey:hostKey,connectionMode:'internet-reliable',stunUrls:[DEFAULT_STUN_URL],turnCredentialEndpoint:'https://turn-creds.example.test/',createdAt:now,expiresAt:now+60000,description:{type:'offer',sdp:'v=0\r\na=fake-offer\r\n'}});
const encodedOffer=await encodeEnvelope(offer);const decodedOffer=await decodeEnvelope(encodedOffer);assert.equal(decodedOffer.protocol,SWARM_PROTOCOL);assert.equal(decodedOffer.kind,'offer');assert.equal(decodedOffer.exoEndpoint,'http://192.168.1.10:52415');assert.equal(decodedOffer.connectionMode,'internet-reliable');assert.equal(decodedOffer.turnCredentialEndpoint,'https://turn-creds.example.test/');assert.equal(decodedOffer.cryptoPublicKey,hostKey);assert.equal(displayCode('ABCDEFGH1234'),'ABCD-EFGH');
const url=shareUrl('offer',encodedOffer,{baseUrl:'https://example.test/local/swarm/'});assert.ok(url.startsWith('https://example.test/local/swarm/#offer='));assert.ok(!url.includes('192.168.1.10'),'compressed invitation should not expose endpoint in clear URL text');
const answer=makeAnswerEnvelope({sessionId:'ABCDEFGH1234',nickname:'Guest phone',cryptoPublicKey:guestKey,description:{type:'answer',sdp:'v=0\r\na=fake-answer\r\n'}});assert.equal((await decodeEnvelope(await encodeEnvelope(answer))).cryptoPublicKey,guestKey);
assert.equal(normalizeExoEndpoint('https://host.example:52415///'),'https://host.example:52415');assert.throws(()=>normalizeExoEndpoint('file:///tmp/exo'),/http or https/);assert.throws(()=>normalizeCredentialEndpoint('http://remote.example/'),/https/);assert.equal(normalizeCredentialEndpoint('http://127.0.0.1:8787/'),'http://127.0.0.1:8787/');

const local=await buildRtcConfiguration({mode:'local'});assert.deepEqual(local.configuration,{iceServers:[],iceTransportPolicy:'all'});
const direct=await buildRtcConfiguration({mode:'internet-direct'});assert.equal(direct.configuration.iceServers[0].urls,DEFAULT_STUN_URL);assert.equal(direct.configuration.iceTransportPolicy,'all');
const fakeFetch=async()=>new Response(JSON.stringify({iceServers:[{urls:['turn:relay.example:3478?transport=udp','turns:relay.example:5349?transport=tcp'],username:'temporary-user',credential:'temporary-password'}],expiresAt:now+600000}),{status:200,headers:{'Content-Type':'application/json'}});
const reliable=await buildRtcConfiguration({mode:'internet-reliable',turnCredentialEndpoint:'https://creds.example/',fetchImpl:fakeFetch});assert.equal(reliable.configuration.iceServers.length,2);assert.equal(reliable.configuration.iceTransportPolicy,'all');assert.equal(reliable.credentialExpiresAt,now+600000);
const privateMode=await buildRtcConfiguration({mode:'internet-private',turnCredentialEndpoint:'https://creds.example/',fetchImpl:fakeFetch});assert.equal(privateMode.configuration.iceTransportPolicy,'relay');assert.ok(privateMode.configuration.iceServers.some(server=>String(Array.isArray(server.urls)?server.urls[0]:server.urls).startsWith('turn')));await assert.rejects(()=>buildRtcConfiguration({mode:'internet-private'}),/credential endpoint is required/);
const privateSdp=sanitizeDescriptionForMode({type:'offer',sdp:'v=0\r\na=candidate:1 1 UDP 1 10.0.0.2 5000 typ host\r\na=candidate:2 1 UDP 2 198.51.100.3 6000 typ srflx\r\na=candidate:3 1 UDP 3 203.0.113.9 7000 typ relay raddr 0.0.0.0 rport 0\r\na=end-of-candidates\r\n'},'internet-private');assert.ok(!privateSdp.sdp.includes('typ host'));assert.ok(!privateSdp.sdp.includes('typ srflx'));assert.ok(privateSdp.sdp.includes('typ relay'));assert.ok(privateSdp.sdp.includes('end-of-candidates'));

const alice=await createEphemeralIdentity();const bob=await createEphemeralIdentity();const sessionId='CRYPTOSESSION123';const aliceCrypto=await deriveSessionCrypto({privateKey:alice.privateKey,localPublicKeyEncoded:alice.publicKeyEncoded,remotePublicKeyEncoded:bob.publicKeyEncoded,sessionId});const bobCrypto=await deriveSessionCrypto({privateKey:bob.privateKey,localPublicKeyEncoded:bob.publicKeyEncoded,remotePublicKeyEncoded:alice.publicKeyEncoded,sessionId});assert.equal(aliceCrypto.safetyCode,bobCrypto.safetyCode);assert.match(aliceCrypto.safetyCode,/^[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{4}$/);
const wire=await encryptApplicationMessage(aliceCrypto.key,{type:'reactive-test',value:42},{sessionId});assert.deepEqual(await decryptApplicationMessage(bobCrypto.key,wire,{sessionId}),{type:'reactive-test',value:42});const tampered=JSON.parse(wire);tampered.ct=tampered.ct.slice(0,-2)+(tampered.ct.endsWith('AA')?'BB':'AA');await assert.rejects(()=>decryptApplicationMessage(bobCrypto.key,JSON.stringify(tampered),{sessionId}));

const credential=await mintCoturnCredential({secret:'test-secret-not-production',userId:'peer-a',ttlSeconds:600,nowSeconds:1000});assert.match(credential.username,/^1600:peer-a-/);assert.equal(credential.expiresAt,1600000);assert.ok(credential.credential.length>20);


function peerMessage(peer,message){const event=new Event('message');Object.defineProperty(event,'detail',{value:{message}});peer.dispatchEvent(event)}
class FakePeer extends EventTarget{
  constructor(){super();this.safetyConfirmed=true;this.remoteVerified=true;this.remoteNickname='Remote browser';this.sessionId='COMPUTESESSION';this.lastRttMs=12;this.sent=[]}
  async send(message){this.sent.push(message)}
}
const computePeer=new FakePeer();
let cancelled=false,disposed=false;
const fakeLoaded={manifest:{id:'qwen3-0.6b',label:'Qwen3 test',model:'onnx-community/Qwen3-test'},execution:{device:'webgpu',dtype:'q4f16'},provider:{provenance:()=>({modelId:'onnx-community/Qwen3-test',device:'webgpu',dtype:'q4f16',executionThread:'dedicated-worker'}),cancel:()=>{cancelled=true},dispose:()=>{disposed=true},infer:async(input,{onText}={})=>{assert.ok(input.maxResponseUnits<=4096);assert.equal(input.hiddenContextPolicy,'none');onText?.('REMOTE_');return {status:'ok',content:{text:'REMOTE_OK'},timing:{elapsedMs:20,ttftMs:5,streamed:true,outputTokenCount:2},provider:{kind:'browser-transformers-local'},failure:null}}}};
const compute=createBrowserSwarmComputeWorker({peer:computePeer,loadProvider:async()=>fakeLoaded});
const computeCapability=await compute.start('qwen3-0.6b');assert.equal(computeCapability.enabled,true);assert.equal(computeCapability.device,'webgpu');assert.ok(computePeer.sent.some(message=>message.type==='compute-capability'&&message.computeProtocol===BROWSER_COMPUTE_PROTOCOL));
peerMessage(computePeer,{protocol:SWARM_PROTOCOL,computeProtocol:BROWSER_COMPUTE_PROTOCOL,type:'compute-request',id:'job-1',input:{requestId:'job-1',requestingModule:'Expression',inferenceType:'conversation',contextManifest:[],causalSourceIds:[],conversationMessages:[{role:'user',content:'Reply briefly.'}],maxResponseUnits:8192,expectedEpistemicStatus:'inference',hiddenContextPolicy:'none'}});
for(let i=0;i<50&&!computePeer.sent.some(message=>message.type==='compute-result');i++)await new Promise(resolve=>setTimeout(resolve,2));
assert.ok(computePeer.sent.some(message=>message.type==='compute-chunk'&&message.chunk==='REMOTE_'),'browser compute must stream encrypted-task chunks');
assert.equal(computePeer.sent.find(message=>message.type==='compute-result')?.result?.content?.text,'REMOTE_OK');
await compute.stop();assert.equal(disposed,true);compute.dispose();

class FakeBridgeChannel extends EventTarget{
  constructor(){super();this.posts=[]}
  postMessage(message){this.posts.push(message)}
  emit(data){this.dispatchEvent(new MessageEvent('message',{data}))}
  close(){}
}
const bridgePeer=new FakePeer(),bridgeChannel=new FakeBridgeChannel(),bridge=createBrowserSwarmBridge({peer:bridgePeer,channelFactory:()=>bridgeChannel,windowLike:null});
peerMessage(bridgePeer,{protocol:SWARM_PROTOCOL,computeProtocol:BROWSER_COMPUTE_PROTOCOL,type:'compute-capability',capability:{enabled:true,modelId:'phone-model',webgpu:true,secureContext:true}});
assert.equal(bridge.available(),true);
bridgeChannel.emit({type:'bridge-discover',bridgeProtocol:SWARM_BRIDGE_PROTOCOL,requestId:'discover-1'});
assert.ok(bridgeChannel.posts.some(message=>message.type==='bridge-status'&&message.requestId==='discover-1'&&message.available===true));
bridgeChannel.emit({type:'bridge-compute-request',bridgeProtocol:SWARM_BRIDGE_PROTOCOL,bridgeId:bridge.bridgeId,id:'bridge-job',input:{requestId:'bridge-job'}});
await new Promise(resolve=>setTimeout(resolve,0));
assert.ok(bridgePeer.sent.some(message=>message.type==='compute-request'&&message.id==='bridge-job'),'bridge must forward only addressed compute requests to the verified peer');
bridge.dispose();

const html=readFileSync('local/swarm/index.html','utf8');const ui=readFileSync('local/swarm/swarm-ui.mjs','utf8');const peer=readFileSync('local/swarm/swarm-peer.mjs','utf8');const network=readFileSync('local/swarm/swarm-network.mjs','utf8');const computeSource=readFileSync('local/swarm/swarm-compute.mjs','utf8');const bridgeSource=readFileSync('local/swarm/swarm-bridge.mjs','utf8');const worker=readFileSync('infrastructure/turn-credentials/worker.mjs','utf8');
assert.ok(html.includes('No signaling server'));assert.ok(html.includes('Internet · private relay'));assert.ok(html.includes('Verify the connection'));assert.ok(html.includes('Share browser compute'));assert.ok(ui.includes('BroadcastChannel'));assert.ok(ui.includes('confirmSafetyCode'));assert.ok(computeSource.includes('compute-request')&&computeSource.includes('compute-result'));assert.ok(bridgeSource.includes('bridge-compute-request')&&bridgeSource.includes('openerOrigin'));assert.ok(peer.includes('encryptApplicationMessage'));assert.ok(peer.includes('sanitizeDescriptionForMode'));assert.ok(network.includes("iceTransportPolicy:'relay'"));assert.ok(worker.includes('TURN_SHARED_SECRET'));assert.ok(!worker.includes('REPLACE_WITH_LONG_RANDOM_SECRET'));
for(const forbidden of ['wss://','ws://','socket.io','firebase','supabase'])assert.ok(!peer.includes(forbidden)&&!ui.includes(forbidden),`unexpected signaling dependency: ${forbidden}`);for(const forbiddenSecret of ['TURN_SHARED_SECRET =','static-auth-secret=actual','Bearer ey'])assert.ok(!peer.includes(forbiddenSecret)&&!ui.includes(forbiddenSecret)&&!html.includes(forbiddenSecret),`browser surface contains suspicious persistent secret material: ${forbiddenSecret}`);
console.log('Secure swarm verification passed: encrypted pairing, explicit browser-compute consent, bounded remote inference, bridge routing, and no signaling dependency.');
