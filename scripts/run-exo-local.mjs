#!/usr/bin/env node
import http from 'node:http';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawn,spawnSync} from 'node:child_process';
import {buildPagesSite} from './build-pages-site.mjs';

const here=path.dirname(fileURLToPath(import.meta.url));
const root=path.resolve(here,'..');
const args=new Set(process.argv.slice(2));
const valueArg=name=>process.argv.slice(2).find(x=>x.startsWith(`${name}=`))?.slice(name.length+1);
const lan=args.has('--lan');
const forceSetup=args.has('--setup');
const skipSetup=args.has('--no-setup');
const openBrowser=args.has('--open');
const webPort=Number(valueArg('--port')||8080);
const exoDir=path.resolve(valueArg('--exo-dir')||process.env.EXO_DIR||path.join(root,'.runtime','exo'));
const exoRepo='https://github.com/Aggredicus/exo.git';
const siteRoot=path.join(root,'.runtime','site');

function fail(message){console.error(`\nConsciOS exo launcher: ${message}\n`);process.exit(1)}
function hasCommand(command){const result=spawnSync(command,['--version'],{stdio:'ignore',shell:false});return result.status===0}
function hasRustNightly(){if(!hasCommand('rustup'))return false;return spawnSync('rustup',['run','nightly','rustc','--version'],{stdio:'ignore',shell:false}).status===0}
function run(command,commandArgs,cwd){console.log(`\n> ${command} ${commandArgs.join(' ')}`);const result=spawnSync(command,commandArgs,{cwd,stdio:'inherit',shell:false});if(result.status!==0)fail(`${command} exited with status ${result.status}`)}
function firstLanIPv4(){for(const entries of Object.values(os.networkInterfaces()))for(const item of entries||[])if(item.family==='IPv4'&&!item.internal&&/^(10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(item.address))return item.address;return null}
function mime(file){const ext=path.extname(file).toLowerCase();return ({'.html':'text/html; charset=utf-8','.mjs':'text/javascript; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json; charset=utf-8','.svg':'image/svg+xml','.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.webp':'image/webp','.ico':'image/x-icon','.txt':'text/plain; charset=utf-8','.md':'text/markdown; charset=utf-8','.wasm':'application/wasm'}[ext]||'application/octet-stream')}

if(!Number.isInteger(webPort)||webPort<1||webPort>65535)fail('--port must be an integer from 1 to 65535');
if(process.platform==='win32')fail('Upstream exo does not document native Windows support. Run this command inside WSL2/Linux, or run exo on a supported macOS/Linux machine.');
for(const command of ['git','node'])if(!hasCommand(command))fail(`${command} is required but was not found on PATH.`);
if(!hasCommand('uv'))fail('uv is required. Install it from https://docs.astral.sh/uv/ and rerun this command.');
if(!hasCommand('npm'))fail('npm is required to build the native exo dashboard. Install Node.js/npm and rerun this command.');
if(!hasCommand('cargo')||!hasCommand('rustup'))fail('Rust + rustup are required by exo. Install rustup from https://rustup.rs/ and rerun this command.');
if(!hasRustNightly())fail('exo requires the Rust nightly toolchain. Run: rustup toolchain install nightly');
if(process.platform==='darwin'&&!hasCommand('xcrun'))fail('macOS exo requires Xcode/Command Line Tools. Install Xcode, then rerun this command.');

const siteReport=await buildPagesSite({output:path.relative(root,siteRoot),maxBytes:120000});
console.log(`Prepared compact ConsciOS site: ${siteReport.totalBytes} bytes across ${siteReport.fileCount} files.`);

if(!fs.existsSync(exoDir)){
  fs.mkdirSync(path.dirname(exoDir),{recursive:true});
  console.log(`Cloning exo into ${exoDir}`);
  run('git',['clone',exoRepo,exoDir],root);
}else if(!fs.existsSync(path.join(exoDir,'.git'))){
  fail(`${exoDir} exists but is not an exo git checkout. Use --exo-dir=/path/to/exo or remove that directory.`);
}

const dashboardIndex=path.join(exoDir,'dashboard','build','index.html');
const venvDir=path.join(exoDir,'.venv');
if(!skipSetup&&(forceSetup||!fs.existsSync(dashboardIndex))){
  console.log('\nBuilding the native exo dashboard…');
  run('npm',['install'],path.join(exoDir,'dashboard'));
  run('npm',['run','build'],path.join(exoDir,'dashboard'));
}
if(!skipSetup&&(forceSetup||!fs.existsSync(venvDir))){
  const extra=process.platform==='darwin'?'mlx':'mlx-cpu';
  console.log(`\nInstalling exo dependencies (${extra}). First setup can take a while…`);
  run('uv',['sync','--extra',extra],exoDir);
  if(process.platform==='linux')console.log('\nNote: upstream exo currently documents Linux inference through its CPU backend; Linux GPU support is still under development.');
  if(process.platform==='darwin'&&!hasCommand('macmon'))console.log('\nNote: upstream exo recommends its pinned macmon build for Apple-Silicon hardware monitoring. Inference can be attempted without launcher-managed macmon installation.');
}

const bindHost=lan?'0.0.0.0':'127.0.0.1';
const lanIp=lan?firstLanIPv4():null;
const server=http.createServer((req,res)=>{
  try{
    const url=new URL(req.url||'/',`http://${req.headers.host||'localhost'}`);
    let pathname=decodeURIComponent(url.pathname);
    if(pathname.endsWith('/'))pathname+='index.html';
    const candidate=path.resolve(siteRoot,`.${pathname}`);
    if(candidate!==siteRoot&&!candidate.startsWith(`${siteRoot}${path.sep}`)){res.writeHead(403);res.end('Forbidden');return}
    let file=candidate;
    if(fs.existsSync(file)&&fs.statSync(file).isDirectory())file=path.join(file,'index.html');
    if(!fs.existsSync(file)||!fs.statSync(file).isFile()){res.writeHead(404,{'Content-Type':'text/plain; charset=utf-8'});res.end('Not found');return}
    res.writeHead(200,{'Content-Type':mime(file),'Cache-Control':'no-store'});
    fs.createReadStream(file).pipe(res);
  }catch(error){res.writeHead(500,{'Content-Type':'text/plain; charset=utf-8'});res.end(String(error?.message||error))}
});

server.listen(webPort,bindHost,()=>{
  const localEndpoint='http://localhost:52415';
  const localUrl=`http://localhost:${webPort}/local/workbench/?provider=exo&endpoint=${encodeURIComponent(localEndpoint)}`;
  console.log('\nConsciOS local web server is ready.');
  console.log(`Desktop: ${localUrl}`);
  if(lan){
    if(lanIp){const endpoint=`http://${lanIp}:52415`;const url=`http://${lanIp}:${webPort}/local/workbench/?provider=exo&endpoint=${encodeURIComponent(endpoint)}`;console.log(`Phone/LAN: ${url}`)}
    else console.log('Phone/LAN: no private IPv4 address was detected; use the computer\'s LAN IP manually.');
    console.log('LAN mode exposes the ConsciOS static server and exo API to devices on your local network. Do not expose these ports directly to the public internet.');
  }
  if(openBrowser){const target=localUrl;try{if(process.platform==='darwin')spawn('open',[target],{detached:true,stdio:'ignore'}).unref();else spawn('xdg-open',[target],{detached:true,stdio:'ignore'}).unref()}catch{}}
});

console.log(`\nStarting exo from ${exoDir} …`);
const exo=spawn('uv',['run','exo'],{cwd:exoDir,stdio:'inherit',shell:false,env:{...process.env}});
exo.on('error',error=>{console.error(`exo failed to start: ${error.message}`);server.close();process.exitCode=1});
exo.on('exit',code=>{console.log(`\nexo exited with status ${code??'unknown'}.`);server.close(()=>process.exit(code??0))});
function shutdown(){console.log('\nStopping ConsciOS + exo…');server.close();if(!exo.killed)exo.kill('SIGTERM');setTimeout(()=>process.exit(0),1000).unref()}
process.on('SIGINT',shutdown);process.on('SIGTERM',shutdown);
