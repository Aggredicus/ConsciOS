export const SANDBOX_PROTOCOL='conscios-sandbox/v1';
export const SANDBOX_RESULT_FORMAT='conscios-sandbox-result/v1';
export const DEFAULT_SANDBOX_ENDPOINT='http://127.0.0.1:43117/v1/run';

export function isLoopbackSandboxHost(hostname){
  return hostname==='localhost'||hostname==='127.0.0.1'||hostname==='::1'||hostname==='[::1]';
}

export function normalizeSandboxEndpoint(value=DEFAULT_SANDBOX_ENDPOINT){
  const url=new URL(String(value??'').trim()||DEFAULT_SANDBOX_ENDPOINT);
  if(url.protocol!=='http:')throw new TypeError('sandbox endpoint must use loopback http://');
  if(!isLoopbackSandboxHost(url.hostname))throw new TypeError('sandbox endpoint must use localhost/loopback; remote sandbox endpoints are not allowed');
  if(url.username||url.password)throw new TypeError('sandbox endpoint must not contain URL credentials');
  url.hash='';
  return url.toString();
}

export function parseSandboxCellSource(source,{interpolate=(value)=>String(value)}={}){
  const text=interpolate(String(source??''));
  let value;
  try{value=JSON.parse(text)}catch(error){throw new TypeError(`container cell source must be valid JSON: ${error.message}`)}
  if(!value||typeof value!=='object'||Array.isArray(value))throw new TypeError('container cell source must be a JSON object');
  return value;
}

export function createSandboxRequest({source,parameters={},requestId,interpolate=(value)=>value}={}){
  const payload=parseSandboxCellSource(source,{interpolate:value=>interpolate(value,parameters)});
  return {
    protocol:SANDBOX_PROTOCOL,
    requestId:requestId??null,
    image:payload.image,
    command:payload.command,
    files:payload.files??[],
    stdin:payload.stdin??'',
    network:payload.network===true,
    pull:payload.pull===true,
    limits:payload.limits??{}
  };
}
