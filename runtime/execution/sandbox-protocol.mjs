import path from 'node:path';
import {SANDBOX_PROTOCOL,SANDBOX_RESULT_FORMAT} from './sandbox-contract.mjs';

export {SANDBOX_PROTOCOL,SANDBOX_RESULT_FORMAT} from './sandbox-contract.mjs';

export const DEFAULT_SANDBOX_POLICY=Object.freeze({
  version:1,
  allowedImages:Object.freeze(['ubuntu:24.04','node:22-bookworm-slim','python:3.13-slim']),
  allowNetwork:false,
  allowPull:false,
  maxBodyBytes:1024*1024,
  maxFiles:32,
  maxFileBytes:256*1024,
  maxTotalFileBytes:1024*1024,
  defaults:Object.freeze({timeoutMs:30000,memoryMB:512,cpus:1,pids:64,outputBytes:256*1024}),
  maximums:Object.freeze({timeoutMs:120000,memoryMB:2048,cpus:2,pids:128,outputBytes:1024*1024})
});

function finiteNumber(value,name){
  const number=Number(value);
  if(!Number.isFinite(number))throw new TypeError(`${name} must be a finite number`);
  return number;
}
function positiveInteger(value,name){
  const number=finiteNumber(value,name);
  if(!Number.isInteger(number)||number<=0)throw new TypeError(`${name} must be a positive integer`);
  return number;
}
function bounded(value,name,defaultValue,maxValue,{integer=true}={}){
  if(value===undefined||value===null)return defaultValue;
  const number=finiteNumber(value,name);
  if(number<=0||(integer&&!Number.isInteger(number)))throw new TypeError(`${name} must be a positive ${integer?'integer':'number'}`);
  if(number>maxValue)throw new RangeError(`${name} exceeds policy maximum ${maxValue}`);
  return number;
}
function utf8Bytes(value){return Buffer.byteLength(String(value??''),'utf8')}
function normalizeRelativeFilePath(value){
  if(typeof value!=='string'||!value.trim())throw new TypeError('sandbox file path must be a non-empty string');
  if(value.includes('\0'))throw new TypeError('sandbox file path may not contain NUL');
  const slash=value.replaceAll('\\','/');
  if(slash.startsWith('/')||/^[A-Za-z]:\//.test(slash))throw new TypeError('sandbox file path must be relative');
  const normalized=path.posix.normalize(slash);
  if(normalized==='.'||normalized==='..'||normalized.startsWith('../'))throw new TypeError('sandbox file path may not escape the workspace');
  return normalized.replace(/^\.\//,'');
}
function normalizeCommand(value){
  if(!Array.isArray(value)||value.length===0)throw new TypeError('sandbox command must be a non-empty string array');
  if(value.length>64)throw new RangeError('sandbox command has too many arguments');
  return value.map((item,index)=>{
    if(typeof item!=='string'||!item.length)throw new TypeError(`sandbox command[${index}] must be a non-empty string`);
    if(utf8Bytes(item)>4096)throw new RangeError(`sandbox command[${index}] is too large`);
    return item;
  });
}
function normalizeFiles(value,policy){
  if(value===undefined)return [];
  if(!Array.isArray(value))throw new TypeError('sandbox files must be an array');
  if(value.length>policy.maxFiles)throw new RangeError(`sandbox files exceed policy maximum ${policy.maxFiles}`);
  const seen=new Set();let total=0;
  return value.map((item,index)=>{
    if(!item||typeof item!=='object'||Array.isArray(item))throw new TypeError(`sandbox files[${index}] must be an object`);
    const filePath=normalizeRelativeFilePath(item.path);
    if(seen.has(filePath))throw new TypeError(`duplicate sandbox file path '${filePath}'`);seen.add(filePath);
    if(typeof item.content!=='string')throw new TypeError(`sandbox files[${index}].content must be a string`);
    const size=utf8Bytes(item.content);
    if(size>policy.maxFileBytes)throw new RangeError(`sandbox file '${filePath}' exceeds ${policy.maxFileBytes} bytes`);
    total+=size;if(total>policy.maxTotalFileBytes)throw new RangeError(`sandbox files exceed total policy maximum ${policy.maxTotalFileBytes} bytes`);
    return {path:filePath,content:item.content,bytes:size};
  });
}

export function normalizeSandboxPolicy(value={}){
  const base=DEFAULT_SANDBOX_POLICY;
  const images=value.allowedImages??base.allowedImages;
  if(!Array.isArray(images)||images.length===0||images.some(item=>typeof item!=='string'||!item.trim()))throw new TypeError('sandbox policy allowedImages must be a non-empty string array');
  return Object.freeze({
    version:1,
    allowedImages:Object.freeze([...new Set(images.map(item=>item.trim()))]),
    allowNetwork:value.allowNetwork===true,
    allowPull:value.allowPull===true,
    maxBodyBytes:positiveInteger(value.maxBodyBytes??base.maxBodyBytes,'maxBodyBytes'),
    maxFiles:positiveInteger(value.maxFiles??base.maxFiles,'maxFiles'),
    maxFileBytes:positiveInteger(value.maxFileBytes??base.maxFileBytes,'maxFileBytes'),
    maxTotalFileBytes:positiveInteger(value.maxTotalFileBytes??base.maxTotalFileBytes,'maxTotalFileBytes'),
    defaults:Object.freeze({...base.defaults,...(value.defaults??{})}),
    maximums:Object.freeze({...base.maximums,...(value.maximums??{})})
  });
}

export function normalizeSandboxRequest(value,{policy=DEFAULT_SANDBOX_POLICY}={}){
  const normalizedPolicy=normalizeSandboxPolicy(policy);
  if(!value||typeof value!=='object'||Array.isArray(value))throw new TypeError('sandbox request must be an object');
  if(value.protocol!==SANDBOX_PROTOCOL)throw new TypeError(`sandbox protocol must be '${SANDBOX_PROTOCOL}'`);
  const image=String(value.image??'').trim();
  if(!normalizedPolicy.allowedImages.includes(image))throw new Error(`sandbox image '${image||'<empty>'}' is not allowed by policy`);
  const network=value.network===true;
  if(network&&!normalizedPolicy.allowNetwork)throw new Error('sandbox network access is disabled by policy');
  const pull=value.pull===true;
  if(pull&&!normalizedPolicy.allowPull)throw new Error('sandbox image pulling is disabled by policy');
  const command=normalizeCommand(value.command);
  const files=normalizeFiles(value.files,normalizedPolicy);
  const stdin=value.stdin===undefined?'':String(value.stdin);
  if(utf8Bytes(stdin)>normalizedPolicy.maxFileBytes)throw new RangeError(`sandbox stdin exceeds ${normalizedPolicy.maxFileBytes} bytes`);
  const requested=value.limits??{};
  if(!requested||typeof requested!=='object'||Array.isArray(requested))throw new TypeError('sandbox limits must be an object');
  const limits={
    timeoutMs:bounded(requested.timeoutMs,'limits.timeoutMs',normalizedPolicy.defaults.timeoutMs,normalizedPolicy.maximums.timeoutMs),
    memoryMB:bounded(requested.memoryMB,'limits.memoryMB',normalizedPolicy.defaults.memoryMB,normalizedPolicy.maximums.memoryMB),
    cpus:bounded(requested.cpus,'limits.cpus',normalizedPolicy.defaults.cpus,normalizedPolicy.maximums.cpus,{integer:false}),
    pids:bounded(requested.pids,'limits.pids',normalizedPolicy.defaults.pids,normalizedPolicy.maximums.pids),
    outputBytes:bounded(requested.outputBytes,'limits.outputBytes',normalizedPolicy.defaults.outputBytes,normalizedPolicy.maximums.outputBytes)
  };
  const requestId=typeof value.requestId==='string'&&value.requestId.trim()?value.requestId.trim():null;
  return {protocol:SANDBOX_PROTOCOL,requestId,image,command,files,stdin,network,pull,limits};
}

export function sandboxPolicySnapshot(policy=DEFAULT_SANDBOX_POLICY){
  const normalized=normalizeSandboxPolicy(policy);
  return {
    version:normalized.version,
    allowedImages:[...normalized.allowedImages],
    allowNetwork:normalized.allowNetwork,
    allowPull:normalized.allowPull,
    maxFiles:normalized.maxFiles,
    maxFileBytes:normalized.maxFileBytes,
    maxTotalFileBytes:normalized.maxTotalFileBytes,
    defaults:{...normalized.defaults},
    maximums:{...normalized.maximums}
  };
}

export function buildContainerRunArgs(request,{workspacePath,containerName,policy=DEFAULT_SANDBOX_POLICY}={}){
  const normalized=normalizeSandboxRequest(request,{policy});
  if(typeof workspacePath!=='string'||!path.isAbsolute(workspacePath))throw new TypeError('workspacePath must be an absolute path');
  if(typeof containerName!=='string'||!/^[a-zA-Z0-9][a-zA-Z0-9_.-]{0,62}$/.test(containerName))throw new TypeError('containerName is invalid');
  const args=[
    'run','--rm','--name',containerName,
    `--pull=${normalized.pull?'missing':'never'}`,
    '--network',normalized.network?'bridge':'none',
    '--cpus',String(normalized.limits.cpus),
    '--memory',`${normalized.limits.memoryMB}m`,
    '--pids-limit',String(normalized.limits.pids),
    '--read-only',
    '--cap-drop','ALL',
    '--security-opt','no-new-privileges:true',
    '--user','65534:65534',
    '--tmpfs','/tmp:rw,nosuid,nodev,noexec,size=64m',
    '-v',`${workspacePath}:/workspace:rw`,
    '-w','/workspace',
    normalized.image,
    ...normalized.command
  ];
  return {args,request:normalized};
}

export function assertSandboxArgsStayBounded(args=[]){
  const joined=args.join(' ');
  const required=['--network','--cpus','--memory','--pids-limit','--read-only','--cap-drop','ALL','no-new-privileges:true','--user','65534:65534'];
  for(const token of required)if(!args.includes(token)&&!joined.includes(token))throw new Error(`sandbox container args are missing required boundary '${token}'`);
  const forbidden=['--privileged','--network=host','--pid=host','--ipc=host','/var/run/docker.sock','/run/podman/podman.sock'];
  for(const token of forbidden)if(joined.includes(token))throw new Error(`sandbox container args contain forbidden authority '${token}'`);
  return true;
}
