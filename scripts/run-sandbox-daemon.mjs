import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import {spawn} from 'node:child_process';
import {randomUUID} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {
  DEFAULT_SANDBOX_POLICY,
  SANDBOX_PROTOCOL,
  SANDBOX_RESULT_FORMAT,
  assertSandboxArgsStayBounded,
  buildContainerRunArgs,
  normalizeSandboxPolicy,
  normalizeSandboxRequest,
  sandboxPolicySnapshot
} from '../runtime/execution/sandbox-protocol.mjs';

export const DEFAULT_SANDBOX_PORT=43117;
export const DEFAULT_SANDBOX_HOST='127.0.0.1';

function isLoopbackHostname(hostname){
  return hostname==='localhost'||hostname==='127.0.0.1'||hostname==='::1'||hostname==='[::1]';
}
export function isAllowedSandboxOrigin(origin){
  if(origin===undefined||origin===null||origin==='')return true;
  try{
    const url=new URL(origin);
    return url.protocol==='http:'&&isLoopbackHostname(url.hostname);
  }catch{return false}
}
function corsHeaders(origin){
  if(!origin)return {};
  return {
    'Access-Control-Allow-Origin':origin,
    'Access-Control-Allow-Methods':'GET,POST,OPTIONS',
    'Access-Control-Allow-Headers':'Content-Type',
    'Access-Control-Allow-Private-Network':'true',
    'Vary':'Origin'
  };
}
function writeJson(res,status,payload,origin){
  const body=JSON.stringify(payload);
  res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Content-Length':Buffer.byteLength(body),...corsHeaders(origin)});
  res.end(body);
}
async function readJsonBody(req,maxBytes){
  let size=0;const chunks=[];
  for await(const chunk of req){
    size+=chunk.length;
    if(size>maxBytes)throw Object.assign(new Error(`request body exceeds ${maxBytes} bytes`),{statusCode:413});
    chunks.push(chunk);
  }
  let parsed;
  try{parsed=JSON.parse(Buffer.concat(chunks).toString('utf8')||'{}')}catch{throw Object.assign(new Error('request body must be valid JSON'),{statusCode:400})}
  return parsed;
}
function prepareWorkspace(files){
  const workspace=fs.mkdtempSync(path.join(os.tmpdir(),'conscios-sandbox-'));
  fs.chmodSync(workspace,0o700);
  try{
    for(const file of files){
      const target=path.join(workspace,...file.path.split('/'));
      const relative=path.relative(workspace,target);
      if(relative.startsWith('..')||path.isAbsolute(relative))throw new Error('normalized sandbox file escaped workspace');
      fs.mkdirSync(path.dirname(target),{recursive:true,mode:0o700});
      fs.writeFileSync(target,file.content,{encoding:'utf8',mode:0o600});
      fs.chmodSync(target,0o600);
    }
    return workspace;
  }catch(error){
    fs.rmSync(workspace,{recursive:true,force:true});
    throw error;
  }
}
function cleanupContainer(engine,containerName,spawnImpl=spawn){
  try{
    const child=spawnImpl(engine,['rm','-f',containerName],{stdio:'ignore'});
    child.unref?.();
  }catch{}
}
function appendBounded(state,chunk,stream){
  const buffer=Buffer.isBuffer(chunk)?chunk:Buffer.from(chunk);
  const remaining=Math.max(0,state.limit-state.captured);
  if(remaining>0){
    const slice=buffer.subarray(0,remaining);
    state[stream]+=slice.toString('utf8');
    state.captured+=slice.length;
  }
  state.observed+=buffer.length;
  if(state.observed>state.limit)state.limitExceeded=true;
}

export async function runSandboxContainer({request,policy=DEFAULT_SANDBOX_POLICY,engine='docker',spawnImpl=spawn}={}){
  if(!['docker','podman'].includes(engine))throw new TypeError('sandbox engine must be docker or podman');
  const normalized=normalizeSandboxRequest(request,{policy});
  const workspace=prepareWorkspace(normalized.files);
  const containerName=`conscios-sandbox-${randomUUID().replaceAll('-','').slice(0,20)}`;
  const hostUid=typeof process.getuid==='function'?process.getuid():0;const hostGid=typeof process.getgid==='function'?process.getgid():0;
  const {args}=buildContainerRunArgs(normalized,{workspacePath:workspace,containerName,containerUser:`${hostUid}:${hostGid}`,policy});
  assertSandboxArgsStayBounded(args);
  const started=performance.now();
  const state={stdout:'',stderr:'',captured:0,observed:0,limit:normalized.limits.outputBytes,limitExceeded:false};
  let forcedStatus=null;
  try{
    const result=await new Promise((resolve,reject)=>{
      let child;
      try{child=spawnImpl(engine,args,{stdio:['pipe','pipe','pipe']})}catch(error){reject(error);return}
      let settled=false;
      const timer=setTimeout(()=>{
        forcedStatus='timeout';
        cleanupContainer(engine,containerName,spawnImpl);
        child.kill?.('SIGKILL');
      },normalized.limits.timeoutMs);
      const finish=(error,value)=>{
        if(settled)return;settled=true;clearTimeout(timer);error?reject(error):resolve(value);
      };
      child.on?.('error',error=>finish(error));
      child.stdout?.on?.('data',chunk=>{
        appendBounded(state,chunk,'stdout');
        if(state.limitExceeded&&!forcedStatus){
          forcedStatus='output-limit';
          cleanupContainer(engine,containerName,spawnImpl);
          child.kill?.('SIGKILL');
        }
      });
      child.stderr?.on?.('data',chunk=>{
        appendBounded(state,chunk,'stderr');
        if(state.limitExceeded&&!forcedStatus){
          forcedStatus='output-limit';
          cleanupContainer(engine,containerName,spawnImpl);
          child.kill?.('SIGKILL');
        }
      });
      child.on?.('close',(code,signal)=>finish(null,{code,signal}));
      child.stdin?.end?.(normalized.stdin);
    });
    const status=forcedStatus??(result.code===0?'ok':'error');
    return {
      format:SANDBOX_RESULT_FORMAT,
      protocol:SANDBOX_PROTOCOL,
      requestId:normalized.requestId,
      status,
      exitCode:Number.isInteger(result.code)?result.code:null,
      signal:result.signal??null,
      stdout:state.stdout,
      stderr:state.stderr,
      outputTruncated:state.limitExceeded,
      timing:{elapsedMs:Math.max(0,performance.now()-started),timeoutMs:normalized.limits.timeoutMs},
      execution:{engine,image:normalized.image,network:normalized.network,pull:normalized.pull,limits:{...normalized.limits}},
      policy:sandboxPolicySnapshot(policy)
    };
  }finally{
    if(forcedStatus)cleanupContainer(engine,containerName,spawnImpl);
    fs.rmSync(workspace,{recursive:true,force:true});
  }
}

export function createSandboxServer({policy=DEFAULT_SANDBOX_POLICY,engine='docker',runImpl=runSandboxContainer}={}){
  const normalizedPolicy=normalizeSandboxPolicy(policy);
  return http.createServer(async(req,res)=>{
    const origin=req.headers.origin;
    if(!isAllowedSandboxOrigin(origin)){
      writeJson(res,403,{error:'origin-not-allowed',message:'Sandbox daemon accepts browser requests only from loopback HTTP origins.'});
      return;
    }
    if(req.method==='OPTIONS'){
      res.writeHead(204,corsHeaders(origin));res.end();return;
    }
    const url=new URL(req.url??'/',`http://${req.headers.host??'127.0.0.1'}`);
    if(req.method==='GET'&&url.pathname==='/health'){
      writeJson(res,200,{status:'ok',protocol:SANDBOX_PROTOCOL,engine,policy:sandboxPolicySnapshot(normalizedPolicy)},origin);return;
    }
    if(req.method!=='POST'||url.pathname!=='/v1/run'){
      writeJson(res,404,{error:'not-found'},origin);return;
    }
    if(!String(req.headers['content-type']??'').toLowerCase().includes('application/json')){
      writeJson(res,415,{error:'content-type',message:'Use application/json.'},origin);return;
    }
    try{
      const raw=await readJsonBody(req,normalizedPolicy.maxBodyBytes);
      const request=normalizeSandboxRequest(raw,{policy:normalizedPolicy});
      const result=await runImpl({request,policy:normalizedPolicy,engine});
      writeJson(res,200,result,origin);
    }catch(error){
      const status=Number(error?.statusCode)||(/ENOENT/.test(String(error?.code??''))?503:400);
      writeJson(res,status,{error:status===503?'engine-unavailable':'sandbox-request-rejected',message:String(error?.message??error)},origin);
    }
  });
}

function parseArgs(argv){
  const result={port:DEFAULT_SANDBOX_PORT,engine:'docker',allowNetwork:false,allowPull:false,images:[]};
  while(argv.length){
    const flag=argv.shift();
    if(flag==='--port')result.port=Number(argv.shift());
    else if(flag==='--engine')result.engine=String(argv.shift()??'');
    else if(flag==='--allow-network')result.allowNetwork=true;
    else if(flag==='--allow-pull')result.allowPull=true;
    else if(flag==='--image')result.images.push(String(argv.shift()??''));
    else throw new Error(`Unknown argument: ${flag}`);
  }
  if(!Number.isInteger(result.port)||result.port<1||result.port>65535)throw new Error('--port must be an integer between 1 and 65535');
  if(!['docker','podman'].includes(result.engine))throw new Error('--engine must be docker or podman');
  return result;
}

if(process.argv[1]===fileURLToPath(import.meta.url)){
  const args=parseArgs(process.argv.slice(2));
  const policy=normalizeSandboxPolicy({
    allowedImages:[...DEFAULT_SANDBOX_POLICY.allowedImages,...args.images.filter(Boolean)],
    allowNetwork:args.allowNetwork,
    allowPull:args.allowPull
  });
  const server=createSandboxServer({policy,engine:args.engine});
  server.listen(args.port,DEFAULT_SANDBOX_HOST,()=>{
    console.log(`ConsciOS sandbox daemon listening on http://${DEFAULT_SANDBOX_HOST}:${args.port}`);
    console.log(`engine=${args.engine} network=${policy.allowNetwork?'opt-in enabled':'disabled'} pull=${policy.allowPull?'opt-in enabled':'disabled'}`);
    console.log(`allowed images: ${policy.allowedImages.join(', ')}`);
  });
}
