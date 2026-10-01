import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {spawn,spawnSync} from 'node:child_process';
import {DEFAULT_SANDBOX_POLICY,normalizeRunSpec,normalizeTopologySpec} from './policy.mjs';

const shortId=()=>crypto.randomBytes(6).toString('hex');
const safeName=(prefix='job')=>`conscios-${prefix.replace(/[^a-z0-9-]/gi,'-').toLowerCase().slice(0,20)}-${shortId()}`;

export function detectContainerEngine({preferred='auto',policy=DEFAULT_SANDBOX_POLICY}={}){
  const choices=preferred==='auto'?policy.engines:[preferred];
  for(const engine of choices){
    if(!policy.engines.includes(engine))continue;
    const result=spawnSync(engine,['version','--format','{{.Server.Version}}'],{encoding:'utf8',timeout:3000});
    if(result.status===0)return Object.freeze({engine,version:String(result.stdout||'').trim()||'unknown'});
  }
  return null;
}

export function buildContainerRunArgs(spec,{workspace,networkName=null,name=safeName('job'),detach=false,remove=true}={}){
  const args=['run'];
  if(detach)args.push('-d');
  if(remove)args.push('--rm');
  args.push('--name',name,'--cpus',String(spec.limits.cpus),'--memory',`${spec.limits.memoryMb}m`,'--pids-limit',String(spec.limits.pids),'--security-opt','no-new-privileges:true');
  if(spec.profile==='strict')args.push('--cap-drop=ALL','--read-only');
  args.push('--tmpfs','/tmp:rw,nosuid,nodev,size=128m');
  if(workspace)args.push('--mount',`type=bind,src=${workspace},dst=/workspace`,'--workdir','/workspace');
  if(networkName)args.push('--network',networkName);
  else if(spec.network==='none')args.push('--network','none');
  for(const [key,value] of Object.entries(spec.environment))args.push('--env',`${key}=${value}`);
  args.push(spec.image,...spec.command);
  return args;
}

export async function runProcess(command,args,{timeoutMs=60_000,maxOutputBytes=2_000_000,cwd,env=process.env}={}){
  return await new Promise((resolve,reject)=>{
    const started=performance.now();
    const child=spawn(command,args,{cwd,env,stdio:['ignore','pipe','pipe']});
    const stdout=[],stderr=[];let stdoutBytes=0,stderrBytes=0,overflow=false,timedOut=false,finished=false;
    const collect=(target,chunk,isErr)=>{
      if(overflow)return;
      const bytes=Buffer.byteLength(chunk);const total=stdoutBytes+stderrBytes+bytes;
      if(total>maxOutputBytes){overflow=true;child.kill('SIGKILL');return;}
      if(isErr)stderrBytes+=bytes;else stdoutBytes+=bytes;target.push(Buffer.from(chunk));
    };
    child.stdout.on('data',chunk=>collect(stdout,chunk,false));child.stderr.on('data',chunk=>collect(stderr,chunk,true));
    const timer=setTimeout(()=>{timedOut=true;child.kill('SIGKILL')},timeoutMs);
    child.on('error',error=>{if(finished)return;finished=true;clearTimeout(timer);reject(error)});
    child.on('close',(code,signal)=>{if(finished)return;finished=true;clearTimeout(timer);resolve(Object.freeze({
      command,args,exitCode:Number.isInteger(code)?code:null,signal:signal??null,timedOut,outputTruncated:overflow,
      stdout:Buffer.concat(stdout).toString('utf8'),stderr:Buffer.concat(stderr).toString('utf8'),
      elapsedMs:Math.max(0,performance.now()-started),stdoutBytes,stderrBytes
    }))});
  });
}

async function createWorkspace(files,{prefix='conscios-sandbox-'}={}){
  const root=await fs.mkdtemp(path.join(os.tmpdir(),prefix));
  for(const file of files){const target=path.join(root,...file.path.split('/'));const rel=path.relative(root,target);if(rel.startsWith('..')||path.isAbsolute(rel))throw new Error(`workspace path escaped root: ${file.path}`);await fs.mkdir(path.dirname(target),{recursive:true});await fs.writeFile(target,file.content,'utf8');}
  return root;
}

async function removeWorkspace(root){if(root)await fs.rm(root,{recursive:true,force:true}).catch(()=>{});}

export async function runContainerJob(input,{engine='auto',policy=DEFAULT_SANDBOX_POLICY,networkName=null,name=null}={}){
  const spec=normalizeRunSpec({...input,...(networkName?{network:'sandbox',networkName:'sandbox'}:{})},policy);
  const detected=detectContainerEngine({preferred:engine,policy});if(!detected)throw new Error(`No supported container engine is available (${policy.engines.join(', ')})`);
  const workspace=await createWorkspace(spec.files);const containerName=name??safeName('job');
  try{
    const args=buildContainerRunArgs(spec,{workspace,networkName,name:containerName});
    const result=await runProcess(detected.engine,args,{timeoutMs:spec.timeoutMs,maxOutputBytes:spec.maxOutputBytes});
    return Object.freeze({protocol:'conscios-sandbox-result/v1',kind:'container-job',engine:detected,image:spec.image,profile:spec.profile,network:networkName?'sandbox':spec.network,limits:spec.limits,...result});
  }finally{await removeWorkspace(workspace);}
}

async function startService(engine,service,{networkName,policy}){
  const workspace=await createWorkspace(service.run.files,{prefix:`conscios-${service.name}-`});const containerName=safeName(service.name);
  const args=buildContainerRunArgs(service.run,{workspace,networkName,name:containerName,detach:true,remove:false});
  const launch=await runProcess(engine.engine,args,{timeoutMs:Math.min(service.run.timeoutMs,30_000),maxOutputBytes:service.run.maxOutputBytes});
  if(launch.exitCode!==0){await removeWorkspace(workspace);throw new Error(`service ${service.name} failed to start: ${launch.stderr||launch.stdout}`);}
  return {name:service.name,containerName,workspace,image:service.run.image,launch};
}

async function cleanupTopology(engine,containers,networkName){
  for(const service of [...containers].reverse()){
    await runProcess(engine,['rm','-f',service.containerName],{timeoutMs:15_000,maxOutputBytes:256_000}).catch(()=>{});
    await removeWorkspace(service.workspace);
  }
  await runProcess(engine,['network','rm',networkName],{timeoutMs:15_000,maxOutputBytes:256_000}).catch(()=>{});
}

export async function runTopology(input,{engine='auto',policy=DEFAULT_SANDBOX_POLICY}={}){
  const spec=normalizeTopologySpec(input,policy);const detected=detectContainerEngine({preferred:engine,policy});if(!detected)throw new Error(`No supported container engine is available (${policy.engines.join(', ')})`);
  const networkName=safeName('net'),containers=[];const networkArgs=['network','create'];if(!spec.internet)networkArgs.push('--internal');networkArgs.push(networkName);
  const networkResult=await runProcess(detected.engine,networkArgs,{timeoutMs:15_000,maxOutputBytes:256_000});if(networkResult.exitCode!==0)throw new Error(`unable to create sandbox network: ${networkResult.stderr||networkResult.stdout}`);
  try{
    for(const service of spec.services)containers.push(await startService(detected,service,{networkName,policy}));
    if(spec.settleMs)await new Promise(resolve=>setTimeout(resolve,spec.settleMs));
    const tests=[];
    for(const test of spec.tests){const result=await runContainerJob({...test.run,files:test.run.files},{engine:detected.engine,policy,networkName,name:safeName(test.name)});tests.push({name:test.name,...result});}
    const serviceLogs=[];
    for(const service of containers){const logs=await runProcess(detected.engine,['logs',service.containerName],{timeoutMs:10_000,maxOutputBytes:policy.maxOutputBytes}).catch(error=>({exitCode:null,stdout:'',stderr:String(error)}));serviceLogs.push({name:service.name,containerName:service.containerName,stdout:logs.stdout,stderr:logs.stderr});}
    return Object.freeze({protocol:'conscios-sandbox-result/v1',kind:'topology-test',engine:detected,internet:spec.internet,networkName,serviceCount:containers.length,testCount:tests.length,ok:tests.every(test=>test.exitCode===0),services:serviceLogs,tests});
  }finally{await cleanupTopology(detected.engine,containers,networkName);}
}
