const te=new TextEncoder();
const td=new TextDecoder();
const INFO=te.encode('ConsciOS swarm application encryption v1');

function b64url(bytes){
  let s='';for(let i=0;i<bytes.length;i+=0x8000)s+=String.fromCharCode(...bytes.subarray(i,i+0x8000));
  return btoa(s).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
}
function fromB64url(value){
  const s=String(value).replace(/-/g,'+').replace(/_/g,'/');const padded=s+'='.repeat((4-s.length%4)%4);const raw=atob(padded);const out=new Uint8Array(raw.length);for(let i=0;i<raw.length;i++)out[i]=raw.charCodeAt(i);return out;
}
function concat(...arrays){const n=arrays.reduce((sum,a)=>sum+a.length,0);const out=new Uint8Array(n);let o=0;for(const a of arrays){out.set(a,o);o+=a.length}return out}
function compareBytes(a,b){for(let i=0;i<Math.min(a.length,b.length);i++){if(a[i]!==b[i])return a[i]-b[i]}return a.length-b.length}
function hex(bytes){return [...bytes].map(v=>v.toString(16).padStart(2,'0')).join('').toUpperCase()}

export async function createEphemeralIdentity(){
  const pair=await crypto.subtle.generateKey({name:'ECDH',namedCurve:'P-256'},true,['deriveBits']);
  const publicBytes=new Uint8Array(await crypto.subtle.exportKey('raw',pair.publicKey));
  return {privateKey:pair.privateKey,publicKey:pair.publicKey,publicKeyEncoded:b64url(publicBytes)};
}

export async function deriveSessionCrypto({privateKey,localPublicKeyEncoded,remotePublicKeyEncoded,sessionId}){
  if(!privateKey||!localPublicKeyEncoded||!remotePublicKeyEncoded||!sessionId)throw new TypeError('session crypto requires private key, both public keys, and sessionId');
  const remoteBytes=fromB64url(remotePublicKeyEncoded);
  const remoteKey=await crypto.subtle.importKey('raw',remoteBytes,{name:'ECDH',namedCurve:'P-256'},false,[]);
  const shared=new Uint8Array(await crypto.subtle.deriveBits({name:'ECDH',public:remoteKey},privateKey,256));
  const material=await crypto.subtle.importKey('raw',shared,'HKDF',false,['deriveKey']);
  const salt=new Uint8Array(await crypto.subtle.digest('SHA-256',te.encode(`conscios-swarm:${sessionId}`)));
  const key=await crypto.subtle.deriveKey({name:'HKDF',hash:'SHA-256',salt,info:INFO},material,{name:'AES-GCM',length:256},false,['encrypt','decrypt']);
  const localBytes=fromB64url(localPublicKeyEncoded);const ordered=[localBytes,remoteBytes].sort(compareBytes);
  const safetyDigest=new Uint8Array(await crypto.subtle.digest('SHA-256',concat(te.encode(sessionId),ordered[0],ordered[1])));
  const safetyHex=hex(safetyDigest.slice(0,6));
  return {key,safetyCode:`${safetyHex.slice(0,4)}-${safetyHex.slice(4,8)}-${safetyHex.slice(8,12)}`};
}

export async function encryptApplicationMessage(key,value,{sessionId}={}){
  if(!key)throw new Error('session encryption key is unavailable');
  const iv=crypto.getRandomValues(new Uint8Array(12));const plaintext=te.encode(JSON.stringify(value));
  const additionalData=te.encode(`conscios-swarm/v2:${sessionId??''}`);
  const ciphertext=new Uint8Array(await crypto.subtle.encrypt({name:'AES-GCM',iv,additionalData,tagLength:128},key,plaintext));
  return JSON.stringify({v:1,iv:b64url(iv),ct:b64url(ciphertext)});
}

export async function decryptApplicationMessage(key,wire,{sessionId}={}){
  if(!key)throw new Error('session encryption key is unavailable');
  const frame=typeof wire==='string'?JSON.parse(wire):wire;
  if(!frame||frame.v!==1||typeof frame.iv!=='string'||typeof frame.ct!=='string')throw new TypeError('invalid encrypted swarm frame');
  const additionalData=te.encode(`conscios-swarm/v2:${sessionId??''}`);
  const plaintext=await crypto.subtle.decrypt({name:'AES-GCM',iv:fromB64url(frame.iv),additionalData,tagLength:128},key,fromB64url(frame.ct));
  return JSON.parse(td.decode(plaintext));
}

export const _test={b64url,fromB64url};
