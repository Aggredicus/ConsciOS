#!/usr/bin/env node
import {mkdir,readFile,readdir,rm,stat,writeFile,copyFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const DEFAULT_OUTPUT='_site';
const DEFAULT_MAX_BYTES=70000;
const MAX_INITIAL_BYTES=26000;
const ENTRY='local/workbench/index.html';

function args(argv){
  const out={output:DEFAULT_OUTPUT,maxBytes:DEFAULT_MAX_BYTES};
  for(let i=0;i<argv.length;i++){
    if(argv[i]==='--output')out.output=argv[++i];
    else if(argv[i]==='--max-bytes')out.maxBytes=Number(argv[++i]);
    else if(argv[i]==='--no-limit')out.maxBytes=Infinity;
    else throw new Error(`Unknown argument: ${argv[i]}`);
  }
  if(!out.output)throw new Error('--output requires a path');
  if(!(out.maxBytes>0))throw new Error('--max-bytes must be positive');
  return out;
}
function localSpec(spec){return spec.startsWith('./')||spec.startsWith('../')}
function normalized(rel){return path.posix.normalize(rel.replaceAll('\\','/'))}
async function ensureCopy(rel,outRoot){
  const src=path.join(root,rel),dst=path.join(outRoot,rel);
  await mkdir(path.dirname(dst),{recursive:true});await copyFile(src,dst);
}
function staticSpecs(source){
  return [...source.matchAll(/(?:import|export)\s+(?:[^'"\n]*?\s+from\s+)?['"]([^'"]+)['"]/g)].map(match=>match[1]);
}
function dynamicSpecs(source){
  return [...source.matchAll(/import\(\s*['"]([^'"]+)['"]\s*\)/g)].map(match=>match[1]);
}
async function visitModule(rel,outRoot,seen){
  rel=normalized(rel);if(seen.has(rel))return;seen.add(rel);
  const source=await readFile(path.join(root,rel),'utf8');await ensureCopy(rel,outRoot);
  const base=path.posix.dirname(rel);
  for(const spec of new Set([...staticSpecs(source),...dynamicSpecs(source)])){
    if(!localSpec(spec))continue;
    await visitModule(normalized(path.posix.join(base,spec)),outRoot,seen);
  }
}
async function visitEager(rel,eager){
  rel=normalized(rel);if(eager.has(rel))return;eager.add(rel);
  const source=await readFile(path.join(root,rel),'utf8'),base=path.posix.dirname(rel);
  for(const spec of staticSpecs(source)){
    if(localSpec(spec))await visitEager(normalized(path.posix.join(base,spec)),eager);
  }
}
async function dirSize(dir){
  let total=0;
  for(const entry of await readdir(dir,{withFileTypes:true})){
    const p=path.join(dir,entry.name);total+=entry.isDirectory()?await dirSize(p):(await stat(p)).size;
  }
  return total;
}
function redirectHtml(){
  return '<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="refresh" content="0;url=./local/workbench/"><title>ConsciOS</title></head><body><a href="./local/workbench/">Open ConsciOS</a></body></html>';
}
export async function buildPagesSite({output=DEFAULT_OUTPUT,maxBytes=DEFAULT_MAX_BYTES}={}){
  const outRoot=path.resolve(root,output);
  if(outRoot===root||!outRoot.startsWith(root+path.sep))throw new Error('output must stay inside repository');
  await rm(outRoot,{recursive:true,force:true});await mkdir(outRoot,{recursive:true});
  const html=await readFile(path.join(root,ENTRY),'utf8');
  await ensureCopy(ENTRY,outRoot);
  const seen=new Set(),initialFiles=new Set([ENTRY]),entryModules=[];
  for(const match of html.matchAll(/\b(?:src|href)=["']([^"'#?]+)["']/g)){
    const spec=match[1];if(!localSpec(spec))continue;
    const rel=normalized(path.posix.join(path.posix.dirname(ENTRY),spec));initialFiles.add(rel);
    if(/\.m?js$/.test(rel)){entryModules.push(rel);await visitModule(rel,outRoot,seen)}
    else await ensureCopy(rel,outRoot);
  }
  for(const rel of entryModules)await visitEager(rel,initialFiles);
  await writeFile(path.join(outRoot,'index.html'),redirectHtml(),'utf8');
  await writeFile(path.join(outRoot,'.nojekyll'),'','utf8');
  const totalBytes=await dirSize(outRoot);
  const files=[];
  async function walk(dir){
    for(const entry of await readdir(dir,{withFileTypes:true})){
      const p=path.join(dir,entry.name);
      if(entry.isDirectory())await walk(p);
      else files.push({path:path.relative(outRoot,p).replaceAll('\\','/'),bytes:(await stat(p)).size});
    }
  }
  await walk(outRoot);files.sort((a,b)=>b.bytes-a.bytes);
  const forbidden=files.filter(file=>/(?:^|\/)(?:workbench\.mjs|notebook-engine\.mjs|execution-providers\.mjs|context-selector\.mjs|conversation-test\.mjs|conscios-ui\.css)$/.test(file.path));
  if(forbidden.length)throw new Error(`Compact Pages closure pulled legacy UI code: ${forbidden.map(file=>file.path).join(', ')}`);
  const initialBytes=files.filter(file=>initialFiles.has(file.path)).reduce((sum,file)=>sum+file.bytes,0);
  if(initialBytes>MAX_INITIAL_BYTES)throw new Error(`Initial app shell ${initialBytes} bytes exceeds budget ${MAX_INITIAL_BYTES}`);
  const report={format:'conscios-pages-footprint/v1',totalBytes,maxBytes:Number.isFinite(maxBytes)?maxBytes:null,initialBytes,maxInitialBytes:MAX_INITIAL_BYTES,fileCount:files.length,files};
  if(totalBytes>maxBytes)throw new Error(`Pages footprint ${totalBytes} bytes exceeds budget ${maxBytes}`);
  return report;
}
if(path.resolve(process.argv[1]||'')===fileURLToPath(import.meta.url)){
  console.log(JSON.stringify(await buildPagesSite(args(process.argv.slice(2))),null,2));
}
