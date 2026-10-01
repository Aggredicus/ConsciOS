const IMAGE_RE=/^[A-Za-z0-9][A-Za-z0-9._:/@-]{0,255}$/;
const ENV_RE=/^[A-Za-z_][A-Za-z0-9_]*$/;
const NAME_RE=/^[a-z][a-z0-9-]{0,30}$/;

export const DEFAULT_SANDBOX_POLICY=Object.freeze({
  format:'conscios-sandbox-policy/v1',
  engines:Object.freeze(['docker','podman']),
  defaultImage:'ubuntu:24.04',
  defaultProfile:'strict',
  allowDevProfile:true,
  allowOutboundNetwork:true,
  maxTimeoutMs:120_000,
  maxOutputBytes:2_000_000,
  maxFiles:128,
  maxFileBytes:1_000_000,
  maxTotalFileBytes:8_000_000,
  maxServices:8,
  maxTests:16,
  maxSettleMs:5_000,
  defaults:Object.freeze({memoryMb:512,cpus:1,pids:256}),
  maxima:Object.freeze({memoryMb:4096,cpus:4,pids:1024})
});

const number=(value,fallback,min,max)=>{
  const n=Number(value);
  return Number.isFinite(n)?Math.max(min,Math.min(max,n)):fallback;
};

export function normalizeRelativePath(value){
  const raw=String(value??'').replaceAll('\\','/').trim();
  if(!raw||raw.startsWith('/')||raw.includes('\0'))throw new TypeError('sandbox file path must be a non-empty relative path');
  const parts=raw.split('/').filter(Boolean);
  if(parts.some(part=>part==='.'||part==='..'))throw new TypeError(`sandbox file path escapes workspace: ${raw}`);
  return parts.join('/');
}

export function normalizeImage(value,policy=DEFAULT_SANDBOX_POLICY){
  const image=String(value??policy.defaultImage).trim();
  if(!IMAGE_RE.test(image)||image.includes('://'))throw new TypeError(`invalid container image reference: ${image}`);
  return image;
}

export function normalizeServiceName(value){
  const name=String(value??'').toLowerCase().trim();
  if(!NAME_RE.test(name))throw new TypeError(`invalid service name '${value}'`);
  return name;
}

export function normalizeLimits(input={},policy=DEFAULT_SANDBOX_POLICY){
  return Object.freeze({
    memoryMb:Math.round(number(input.memoryMb,policy.defaults.memoryMb,64,policy.maxima.memoryMb)),
    cpus:number(input.cpus,policy.defaults.cpus,0.1,policy.maxima.cpus),
    pids:Math.round(number(input.pids,policy.defaults.pids,16,policy.maxima.pids))
  });
}

function normalizeEnvironment(input={}){
  if(!input||Array.isArray(input)||typeof input!=='object')throw new TypeError('environment must be an object');
  const out={};
  for(const [key,value] of Object.entries(input)){
    if(!ENV_RE.test(key))throw new TypeError(`invalid environment variable name: ${key}`);
    if(value===undefined||value===null)continue;
    const text=String(value);
    if(text.length>16_384)throw new TypeError(`environment value too large: ${key}`);
    out[key]=text;
  }
  return Object.freeze(out);
}

function normalizeFiles(files=[],policy=DEFAULT_SANDBOX_POLICY){
  if(!Array.isArray(files))throw new TypeError('files must be an array');
  if(files.length>policy.maxFiles)throw new TypeError(`too many sandbox files (max ${policy.maxFiles})`);
  let total=0;
  const seen=new Set();
  return Object.freeze(files.map(item=>{
    if(!item||typeof item!=='object')throw new TypeError('sandbox file entry must be an object');
    const path=normalizeRelativePath(item.path),content=String(item.content??'');
    const bytes=Buffer.byteLength(content);
    if(bytes>policy.maxFileBytes)throw new TypeError(`sandbox file too large: ${path}`);
    total+=bytes;if(total>policy.maxTotalFileBytes)throw new TypeError(`sandbox files exceed ${policy.maxTotalFileBytes} bytes`);
    if(seen.has(path))throw new TypeError(`duplicate sandbox file path: ${path}`);seen.add(path);
    return Object.freeze({path,content});
  }));
}

function normalizeCommand(value){
  if(typeof value==='string')return Object.freeze(['bash','-lc',value]);
  if(!Array.isArray(value)||!value.length||value.some(x=>typeof x!=='string'||!x.length))throw new TypeError('command must be a string or non-empty string array');
  if(value.length>128)throw new TypeError('command contains too many arguments');
  return Object.freeze(value.map(String));
}

export function normalizeRunSpec(input={},policy=DEFAULT_SANDBOX_POLICY){
  if(!input||Array.isArray(input)||typeof input!=='object')throw new TypeError('sandbox run spec must be an object');
  const profile=input.profile??policy.defaultProfile;
  if(!['strict','dev'].includes(profile))throw new TypeError(`unknown sandbox profile '${profile}'`);
  if(profile==='dev'&&!policy.allowDevProfile)throw new TypeError('dev sandbox profile is disabled by policy');
  const network=input.network??'none';
  if(!['none','bridge','sandbox'].includes(network)||network==='bridge'&&!policy.allowOutboundNetwork)throw new TypeError(`network mode '${network}' is not allowed`);
  if(network==='sandbox'&&!input.networkName)throw new TypeError('sandbox network requires a networkName supplied by the topology runner');
  const timeoutMs=Math.round(number(input.timeoutMs,60_000,250,policy.maxTimeoutMs));
  return Object.freeze({
    image:normalizeImage(input.image,policy),
    command:normalizeCommand(input.command??input.text??'uname -a'),
    profile,
    network,
    networkName:input.networkName?normalizeServiceName(input.networkName):null,
    environment:normalizeEnvironment(input.environment??input.env??{}),
    files:normalizeFiles(input.files??[],policy),
    limits:normalizeLimits(input.limits??{},policy),
    timeoutMs,
    maxOutputBytes:Math.round(number(input.maxOutputBytes,policy.maxOutputBytes,1024,policy.maxOutputBytes))
  });
}

export function normalizeTopologySpec(input={},policy=DEFAULT_SANDBOX_POLICY){
  if(!input||Array.isArray(input)||typeof input!=='object')throw new TypeError('topology spec must be an object');
  const services=input.services??[],tests=input.tests??[];
  if(!Array.isArray(services)||!services.length)throw new TypeError('topology requires at least one service');
  if(services.length>policy.maxServices)throw new TypeError(`topology exceeds ${policy.maxServices} services`);
  if(!Array.isArray(tests)||tests.length>policy.maxTests)throw new TypeError(`topology exceeds ${policy.maxTests} tests`);
  const names=new Set();
  const normalizedServices=services.map(service=>{
    const name=normalizeServiceName(service?.name);
    if(names.has(name))throw new TypeError(`duplicate topology service '${name}'`);names.add(name);
    const run=normalizeRunSpec({...service,network:'sandbox',networkName:'sandbox'},policy);
    return Object.freeze({name,run});
  });
  const normalizedTests=tests.map((test,index)=>Object.freeze({name:normalizeServiceName(test?.name??`test-${index+1}`),run:normalizeRunSpec({...test,network:'sandbox',networkName:'sandbox'},policy)}));
  return Object.freeze({
    services:Object.freeze(normalizedServices),tests:Object.freeze(normalizedTests),
    internet:input.internet===true&&policy.allowOutboundNetwork,
    settleMs:Math.round(number(input.settleMs,500,0,policy.maxSettleMs))
  });
}
