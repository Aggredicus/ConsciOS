function cors(origin,env){
  const allowed=String(env.ALLOWED_ORIGINS||'').split(',').map(v=>v.trim()).filter(Boolean);const ok=allowed.includes('*')||allowed.includes(origin);
  return {'Access-Control-Allow-Origin':ok?origin:'null','Access-Control-Allow-Methods':'GET,OPTIONS','Access-Control-Allow-Headers':'Content-Type','Access-Control-Max-Age':'600','Vary':'Origin','Cache-Control':'no-store','Content-Type':'application/json; charset=utf-8'};
}
function bytesToBase64(bytes){let raw='';for(const b of bytes)raw+=String.fromCharCode(b);return btoa(raw)}
export async function mintCoturnCredential({secret,userId='browser',ttlSeconds=600,nowSeconds=Math.floor(Date.now()/1000)}){
  if(!secret)throw new Error('TURN_SHARED_SECRET is required');const ttl=Math.max(60,Math.min(3600,Number(ttlSeconds)||600));const expires=nowSeconds+ttl;const nonce=crypto.randomUUID().replace(/-/g,'').slice(0,12);const username=`${expires}:${String(userId).replace(/[^A-Za-z0-9_.-]/g,'').slice(0,32)||'browser'}-${nonce}`;
  const key=await crypto.subtle.importKey('raw',new TextEncoder().encode(secret),{name:'HMAC',hash:'SHA-1'},false,['sign']);const signature=new Uint8Array(await crypto.subtle.sign('HMAC',key,new TextEncoder().encode(username)));return {username,credential:bytesToBase64(signature),expiresAt:expires*1000};
}
function turnUrls(env){const values=String(env.TURN_URLS||'').split(',').map(v=>v.trim()).filter(Boolean);if(!values.length)throw new Error('TURN_URLS is required');for(const url of values)if(!/^turns?:/i.test(url))throw new Error('TURN_URLS must contain only turn: or turns: URLs');return values}
function allowedOrigin(request,env){const origin=request.headers.get('Origin')||'';const allowed=String(env.ALLOWED_ORIGINS||'').split(',').map(v=>v.trim()).filter(Boolean);return allowed.includes('*')||allowed.includes(origin)}
export default {async fetch(request,env){
  const origin=request.headers.get('Origin')||'';const headers=cors(origin,env);if(request.method==='OPTIONS')return new Response(null,{status:204,headers});if(request.method!=='GET')return new Response(JSON.stringify({error:'method_not_allowed'}),{status:405,headers});if(!allowedOrigin(request,env))return new Response(JSON.stringify({error:'origin_not_allowed'}),{status:403,headers});
  try{const url=new URL(request.url);const userId=url.searchParams.get('peer')||'browser';const minted=await mintCoturnCredential({secret:env.TURN_SHARED_SECRET,userId,ttlSeconds:Number(env.TURN_TTL_SECONDS||600)});return new Response(JSON.stringify({iceServers:[{urls:turnUrls(env),username:minted.username,credential:minted.credential}],expiresAt:minted.expiresAt}),{status:200,headers})}catch(error){return new Response(JSON.stringify({error:'credential_mint_failed',message:String(error?.message||error)}),{status:500,headers})}
}};
