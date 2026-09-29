import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {SWARM_PROTOCOL,decodeEnvelope,displayCode,encodeEnvelope,makeAnswerEnvelope,makeOfferEnvelope,normalizeExoEndpoint,shareUrl} from '../../../local/swarm/swarm-protocol.mjs';

const now=Date.now();
const offer=makeOfferEnvelope({sessionId:'ABCDEFGH1234',nickname:'Host phone',exoEndpoint:'http://192.168.1.10:52415/',createdAt:now,expiresAt:now+60000,description:{type:'offer',sdp:'v=0\r\na=fake-offer\r\n'}});
const encodedOffer=await encodeEnvelope(offer);const decodedOffer=await decodeEnvelope(encodedOffer);
assert.equal(decodedOffer.protocol,SWARM_PROTOCOL);assert.equal(decodedOffer.kind,'offer');assert.equal(decodedOffer.exoEndpoint,'http://192.168.1.10:52415');assert.equal(decodedOffer.description.type,'offer');
assert.equal(displayCode('ABCDEFGH1234'),'ABCD-EFGH');
const url=shareUrl('offer',encodedOffer,{baseUrl:'https://example.test/local/swarm/'});assert.ok(url.startsWith('https://example.test/local/swarm/#offer='));assert.ok(!url.includes('192.168.1.10'),'compressed invitation should not expose endpoint in clear URL text');

const answer=makeAnswerEnvelope({sessionId:'ABCDEFGH1234',nickname:'Guest phone',description:{type:'answer',sdp:'v=0\r\na=fake-answer\r\n'}});const encodedAnswer=await encodeEnvelope(answer);const decodedAnswer=await decodeEnvelope(encodedAnswer);assert.equal(decodedAnswer.kind,'answer');assert.equal(decodedAnswer.sessionId,offer.sessionId);
assert.equal(normalizeExoEndpoint('https://host.example:52415///'),'https://host.example:52415');assert.throws(()=>normalizeExoEndpoint('file:///tmp/exo'),/http or https/);

const html=readFileSync('local/swarm/index.html','utf8');const ui=readFileSync('local/swarm/swarm-ui.mjs','utf8');const peer=readFileSync('local/swarm/swarm-peer.mjs','utf8');
assert.ok(html.includes('No signaling server'));assert.ok(html.includes('Join local swarm?'));assert.ok(ui.includes('BroadcastChannel'));assert.ok(ui.includes('localStorage.setItem(`conscios-swarm-answer:'));assert.ok(peer.includes('iceServers:[]'));assert.ok(peer.includes("createDataChannel('conscios-swarm'"));assert.ok(peer.includes("type:'hello'"));assert.ok(peer.includes("type:'ping'"));
for(const forbidden of ['wss://','ws://','socket.io','firebase','supabase'])assert.ok(!peer.includes(forbidden)&&!ui.includes(forbidden),`unexpected signaling dependency: ${forbidden}`);

console.log('Serverless swarm protocol verification passed: QR envelopes, exo endpoint normalization, no signaling dependency, direct WebRTC contract.');