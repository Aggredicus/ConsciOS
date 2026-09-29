export const SWARM_PROTOCOL='conscios-swarm/v1';
export const INVITE_TTL_MS=15*60*1000;

const textEncoder=new TextEncoder();
const textDecoder=new TextDecoder();

function bytesToBase64Url(bytes){
  let binary='';
  for(let i=0;i<bytes.length;i+=0x8000)binary+=String.fromCharCode(...bytes.subarray(i,i+0x8000));
  return btoa(binary).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
}
function base64UrlToBytes(value){
  const padded=value.replace(/-/g,'+').replace(/_/g,'/')+'==='.slice((value.length+3)%4);
  const binary=atob(padded);const bytes=new Uint8Array(binary.length);
  for(let i=0;i<binary.length;i++)bytes[i]=binary.charCodeAt(i);
  return bytes;
}
async function streamBytes(bytes,kind){
  if(typeof CompressionStream==='undefined'||typeof DecompressionStream==='undefined')return bytes;
  const transform=kind==='compress'?new CompressionStream('gzip'):new DecompressionStream('gzip');
  const writer=transform.writable.getWriter();writer.write(bytes);writer.close();
  return new Uint8Array(await new Response(transform.readable).arrayBuffer());
}

export async function encodeEnvelope(envelope){
  const json=JSON.stringify(envelope);const raw=textEncoder.encode(json);
  const compressed=await streamBytes(raw,'compress');
  const prefix=compressed.length<raw.length?'g':'r';
  return prefix+bytesToBase64Url(compressed.length<raw.length?compressed:raw);
}
export async function decodeEnvelope(encoded){
  if(typeof encoded!=='string'||encoded.length<2)throw new TypeError('invalid swarm envelope');
  const prefix=encoded[0];let bytes=base64UrlToBytes(encoded.slice(1));
  if(prefix==='g')bytes=await streamBytes(bytes,'decompress');else if(prefix!=='r')throw new TypeError('unknown swarm envelope encoding');
  const value=JSON.parse(textDecoder.decode(bytes));
  validateEnvelope(value);return value;
}

export function validateEnvelope(value){
  if(!value||value.protocol!==SWARM_PROTOCOL)throw new TypeError('unsupported swarm protocol');
  if(!['offer','answer'].includes(value.kind))throw new TypeError('swarm envelope kind must be offer or answer');
  if(typeof value.sessionId!=='string'||value.sessionId.length<8)throw new TypeError('swarm sessionId is invalid');
  if(!value.description||!['offer','answer'].includes(value.description.type)||typeof value.description.sdp!=='string')throw new TypeError('swarm session description is invalid');
  if(value.kind!==value.description.type)throw new TypeError('swarm envelope kind does not match SDP type');
  if(value.kind==='offer'){
    if(!Number.isFinite(value.expiresAt)||Date.now()>value.expiresAt)throw new Error('swarm invitation has expired');
    if(value.exoEndpoint!==null&&value.exoEndpoint!==undefined)normalizeExoEndpoint(value.exoEndpoint);
  }
  return value;
}

export function normalizeExoEndpoint(value){
  if(value===null||value===undefined||String(value).trim()==='')return null;
  const url=new URL(String(value).trim());
  if(url.protocol!=='http:'&&url.protocol!=='https:')throw new TypeError('exo endpoint must use http or https');
  url.hash='';url.search='';url.pathname=url.pathname.replace(/\/+$/,'');
  return url.toString().replace(/\/$/,'');
}

export function createSessionId(){
  const bytes=crypto.getRandomValues(new Uint8Array(9));
  return bytesToBase64Url(bytes).toUpperCase();
}
export function displayCode(sessionId){return `${sessionId.slice(0,4)}-${sessionId.slice(4,8)}`}
export function basePageUrl(locationLike=globalThis.location){
  const url=new URL(locationLike.href);url.hash='';url.search='';return url.toString();
}
export function shareUrl(kind,encoded,{baseUrl=basePageUrl()}={}){
  if(!['offer','answer'].includes(kind))throw new TypeError('share URL kind is invalid');
  const url=new URL(baseUrl);url.hash=`${kind}=${encoded}`;return url.toString();
}
export function pairingPayloadFromHash(hash=globalThis.location?.hash??''){
  const text=String(hash).replace(/^#/,'');if(!text)return null;
  const index=text.indexOf('=');if(index<1)return null;
  const kind=text.slice(0,index);if(!['offer','answer'].includes(kind))return null;
  return {kind,encoded:text.slice(index+1)};
}

export async function waitForIceComplete(peer,{timeoutMs=10000}={}){
  if(peer.iceGatheringState==='complete')return;
  await new Promise((resolve,reject)=>{
    const timeout=setTimeout(()=>{cleanup();reject(new Error('ICE gathering timed out'))},timeoutMs);
    const onState=()=>{if(peer.iceGatheringState==='complete'){cleanup();resolve()}};
    function cleanup(){clearTimeout(timeout);peer.removeEventListener('icegatheringstatechange',onState)}
    peer.addEventListener('icegatheringstatechange',onState);onState();
  });
}

export function capabilityManifest(){
  return {
    protocol:SWARM_PROTOCOL,
    webgpu:Boolean(navigator.gpu),
    wasm:true,
    secureContext:Boolean(globalThis.isSecureContext),
    runtime:'browser',
    visibility:document.visibilityState
  };
}

export function makeOfferEnvelope({sessionId,description,exoEndpoint=null,nickname='Host',createdAt=Date.now(),expiresAt=createdAt+INVITE_TTL_MS}){
  return {protocol:SWARM_PROTOCOL,kind:'offer',sessionId,createdAt,expiresAt,nickname:String(nickname).slice(0,40),exoEndpoint:normalizeExoEndpoint(exoEndpoint),description:{type:'offer',sdp:description.sdp}};
}
export function makeAnswerEnvelope({sessionId,description,nickname='Guest'}){
  return {protocol:SWARM_PROTOCOL,kind:'answer',sessionId,nickname:String(nickname).slice(0,40),description:{type:'answer',sdp:description.sdp}};
}
