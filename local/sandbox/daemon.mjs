#!/usr/bin/env node
import http from 'node:http';
import {pathToFileURL} from 'node:url';
import {DEFAULT_SANDBOX_POLICY} from './policy.mjs';
import {detectContainerEngine,runContainerJob,runTopology} from './engine.mjs';

const argv=process.argv.slice(2);const arg=(name,fallback)=>{const i=argv.indexOf(name);return i>=0?argv[i+1]:fallback};
const JSON_LIMIT=10*1024*1024;

function allowedOrigins(){
  return new Set(String(process.env.CONSCIOS_SANDBOX_ORIGINS??'http://127.0.0.1,http://localhost').split(',').map(x=>x.trim().replace(/\/$/,'')).filter(Boolean));
}

function cors(req,res){
  const origin=req.headers.origin;if(!origin)return true;
  const allowed=allowedOrigins();if(!allowed.has(origin)&&!allowed.has('*'))return false;
  res.setHeader('Access-Control-Allow-Origin',origin);res.setHeader('Vary','Origin');res.setHeader('Access-Control-Allow-Headers','content-type');res.setHeader('Access-Control-Allow-Methods','GET,POST,OPTIONS');return true;
}

function send(res,status,value){const body=JSON.stringify(value,null,2)+'\n';res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Content-Length':Buffer.byteLength(body),'Cache-Control':'no-store'});res.end(body)}

async function bodyJson(req){
  const chunks=[];let bytes=0;for await(const chunk of req){bytes+=chunk.length;if(bytes>JSON_LIMIT)throw Object.assign(new Error('request body too large'),{statusCode:413});chunks.push(chunk)}
  const text=Buffer.concat(chunks).toString('utf8');if(!text)return {};try{return JSON.parse(text)}catch{throw Object.assign(new Error('request body must be JSON'),{statusCode:400})}
}

function unwrap(payload){
  if(payload?.protocol==='conscios-tool/v1')return {action:payload.action,payload:payload.payload??{}};
  return {action:payload?.action,payload:payload?.payload??payload??{}};
}

export function createSandboxServer({host='127.0.0.1',port=7337,engine='auto',policy=DEFAULT_SANDBOX_POLICY}={}){
  const server=http.createServer(async(req,res)=>{
    if(!cors(req,res)){send(res,403,{error:'Origin is not allowed. Set CONSCIOS_SANDBOX_ORIGINS explicitly to add trusted workbench origins.'});return}
    if(req.method==='OPTIONS'){res.writeHead(204);res.end();return}
    try{
      const url=new URL(req.url??'/',`http://${req.headers.host??`${host}:${port}`}`);
      if(req.method==='GET'&&url.pathname==='/v1/health'){
        const detected=detectContainerEngine({preferred:engine,policy});send(res,200,{protocol:'conscios-sandbox/v1',status:detected?'ready':'engine-unavailable',engine:detected,host,port,policy:{format:policy.format,defaultProfile:policy.defaultProfile,defaultImage:policy.defaultImage,networkDefault:'none',maxTimeoutMs:policy.maxTimeoutMs,maxServices:policy.maxServices}});return;
      }
      if(req.method==='POST'&&url.pathname==='/v1/execute'){
        const request=unwrap(await bodyJson(req));let result;
        if(request.action==='sandbox-run')result=await runContainerJob(request.payload,{engine,policy});
        else if(request.action==='sandbox-topology')result=await runTopology(request.payload,{engine,policy});
        else {send(res,400,{error:`unsupported sandbox action '${request.action??''}'`,supported:['sandbox-run','sandbox-topology']});return}
        send(res,200,{protocol:'conscios-tool-result/v1',action:request.action,result});return;
      }
      send(res,404,{error:'not found',routes:['GET /v1/health','POST /v1/execute']});
    }catch(error){send(res,error?.statusCode??500,{error:String(error?.message??error),name:error?.name??'Error'})}
  });
  return {server,start:()=>new Promise((resolve,reject)=>{server.once('error',reject);server.listen(port,host,()=>{server.off('error',reject);resolve(server.address())})}),stop:()=>new Promise(resolve=>server.close(()=>resolve()))};
}

async function main(){
  const host=arg('--host',process.env.CONSCIOS_SANDBOX_HOST??'127.0.0.1'),port=Number(arg('--port',process.env.CONSCIOS_SANDBOX_PORT??7337)),engine=arg('--engine',process.env.CONSCIOS_CONTAINER_ENGINE??'auto');
  const app=createSandboxServer({host,port,engine});const address=await app.start();const detected=detectContainerEngine({preferred:engine});
  console.log(`ConsciOS sandbox daemon listening on http://${address.address}:${address.port}`);console.log(detected?`Container engine: ${detected.engine} ${detected.version}`:'Container engine unavailable: install/start Docker or Podman before executing cells.');console.log(`Allowed browser origins: ${[...allowedOrigins()].join(', ')}`);
  const shutdown=async()=>{await app.stop();process.exit(0)};process.on('SIGINT',shutdown);process.on('SIGTERM',shutdown);
}

if(import.meta.url===pathToFileURL(process.argv[1]??'').href)main().catch(error=>{console.error(error);process.exitCode=1});
