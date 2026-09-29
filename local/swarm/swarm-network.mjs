export const DEFAULT_STUN_URL='stun:stun.cloudflare.com:3478';
export const CONNECTION_MODES=Object.freeze({
  local:{id:'local',label:'Nearby / same Wi-Fi',description:'No STUN or TURN. Direct host candidates only.',requiresTurn:false,iceTransportPolicy:'all'},
  'internet-direct':{id:'internet-direct',label:'Internet · direct preferred',description:'STUN discovers public paths. No relay fallback.',requiresTurn:false,iceTransportPolicy:'all'},
  'internet-reliable':{id:'internet-reliable',label:'Internet · reliable',description:'Direct preferred with TURN fallback.',requiresTurn:true,iceTransportPolicy:'all'},
  'internet-private':{id:'internet-private',label:'Internet · private relay',description:'TURN relay only; peer IPs are not used for the WebRTC path.',requiresTurn:true,iceTransportPolicy:'relay'}
});

function ensureMode(mode){const value=CONNECTION_MODES[mode];if(!value)throw new TypeError(`unsupported swarm connection mode '${mode}'`);return value}
function urlList(value){const values=Array.isArray(value)?value:String(value??'').split(/[\s,]+/);return values.map(v=>String(v).trim()).filter(Boolean)}
function validateIceUrl(value,{turnOnly=false}={}){
  const text=String(value);const lower=text.toLowerCase();
  const ok=turnOnly?(lower.startsWith('turn:')||lower.startsWith('turns:')):(lower.startsWith('stun:')||lower.startsWith('stuns:')||lower.startsWith('turn:')||lower.startsWith('turns:'));
  if(!ok)throw new TypeError(`invalid ICE URL '${text}'`);return text;
}
export function normalizeStunUrls(value=DEFAULT_STUN_URL){return [...new Set(urlList(value).map(v=>{if(!/^stuns?:/i.test(v))throw new TypeError('STUN URL must use stun: or stuns:');return v}))]}
export function normalizeCredentialEndpoint(value){
  if(value===null||value===undefined||String(value).trim()==='')return null;const url=new URL(String(value).trim());
  const local=['localhost','127.0.0.1','[::1]'].includes(url.hostname);if(url.protocol!=='https:'&&!(local&&url.protocol==='http:'))throw new TypeError('TURN credential endpoint must use https (http allowed only on localhost)');
  url.hash='';return url.toString();
}
export function validateIceServers(value,{requireTurn=false}={}){
  if(!Array.isArray(value))throw new TypeError('iceServers must be an array');let hasTurn=false;
  const clean=value.map(server=>{
    if(!server||(!server.urls))throw new TypeError('ICE server requires urls');const urls=urlList(server.urls).map(v=>validateIceUrl(v));
    if(urls.some(v=>/^turns?:/i.test(v))){hasTurn=true;if(typeof server.username!=='string'||!server.username||typeof server.credential!=='string'||!server.credential)throw new TypeError('TURN server requires temporary username and credential')}
    return {urls:urls.length===1?urls[0]:urls,...(server.username?{username:server.username}:{}),...(server.credential?{credential:server.credential}:{}),...(server.credentialType?{credentialType:server.credentialType}:{})};
  });
  if(requireTurn&&!hasTurn)throw new Error('selected mode requires at least one TURN server');return clean;
}
export async function fetchTurnIceServers(endpoint,{fetchImpl=globalThis.fetch,signal}={}){
  const normalized=normalizeCredentialEndpoint(endpoint);if(!normalized)throw new Error('TURN credential endpoint is required');if(typeof fetchImpl!=='function')throw new TypeError('fetch is unavailable');
  const response=await fetchImpl(normalized,{method:'GET',headers:{Accept:'application/json'},cache:'no-store',credentials:'omit',signal});
  if(!response.ok)throw new Error(`TURN credential request failed with HTTP ${response.status}`);const payload=await response.json();
  return {iceServers:validateIceServers(payload.iceServers,{requireTurn:true}),expiresAt:Number.isFinite(payload.expiresAt)?payload.expiresAt:null};
}
export async function buildRtcConfiguration({mode='local',stunUrls=[DEFAULT_STUN_URL],turnCredentialEndpoint=null,fetchImpl=globalThis.fetch,signal}={}){
  const policy=ensureMode(mode);if(mode==='local')return {mode,configuration:{iceServers:[],iceTransportPolicy:'all'},credentialExpiresAt:null};
  const stun=normalizeStunUrls(stunUrls).map(url=>({urls:url}));let turn=[];let credentialExpiresAt=null;
  if(policy.requiresTurn){const result=await fetchTurnIceServers(turnCredentialEndpoint,{fetchImpl,signal});turn=result.iceServers;credentialExpiresAt=result.expiresAt}
  return {mode,configuration:{iceServers:[...stun,...turn],iceTransportPolicy:policy.iceTransportPolicy},credentialExpiresAt};
}
export function networkInviteFields({mode='local',stunUrls=[DEFAULT_STUN_URL],turnCredentialEndpoint=null}={}){
  ensureMode(mode);return {connectionMode:mode,stunUrls:mode==='local'?[]:normalizeStunUrls(stunUrls),turnCredentialEndpoint:CONNECTION_MODES[mode].requiresTurn?normalizeCredentialEndpoint(turnCredentialEndpoint):null};
}
