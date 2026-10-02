#!/usr/bin/env node
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import {execFileSync} from 'node:child_process';

const VERSION=1;
const KIND='conscios-temporal-graph-history';
const argv=process.argv.slice(2);
const cmd=argv[0]&&!argv[0].startsWith('--')?argv.shift():'build';
const arg=(name,fallback=null)=>{const i=argv.indexOf(name);return i>=0?argv[i+1]:fallback;};
const has=name=>argv.includes(name);
const ROOT=path.resolve(arg('--root',process.cwd()));
const OUT=path.resolve(ROOT,arg('--out','artifacts/self-model/current/history.v1.json'));
const MAX_BUFFER=64*1024*1024;
const VALID_REF=/^[A-Za-z0-9._/@+~^-]{1,120}$/;
const KEEP_TYPES=new Set(['Repository','Domain','Role','File','Workflow','AgentContract','DevelopmentDocument','Interface','Schema','SkillDocument','AgentInstruction','Section','Concept']);
const sha=v=>crypto.createHash('sha256').update(v).digest('hex');
const git=args=>execFileSync('git',args,{cwd:ROOT,encoding:'utf8',stdio:['ignore','pipe','pipe'],maxBuffer:MAX_BUFFER}).trim();
const node=args=>execFileSync(process.execPath,args,{cwd:ROOT,encoding:'utf8',stdio:['ignore','pipe','pipe'],maxBuffer:MAX_BUFFER});
const writeJson=(p,v)=>{fs.mkdirSync(path.dirname(p),{recursive:true});fs.writeFileSync(p,JSON.stringify(v,null,2)+'\n');};
const edgeKey=e=>`${e.from}|${e.type}|${e.to}|${e.mode||''}`;

function validRef(ref){return typeof ref==='string'&&VALID_REF.test(ref)&&!ref.startsWith('-')&&!ref.includes('..');}
function resolveRef(ref){if(!validRef(ref))throw new Error(`invalid Git ref: ${ref}`);return git(['rev-parse','--verify',`${ref}^{commit}`]);}
function commitRow(line){const p=line.trim().split(/\s+/);return {timestampSec:Number(p[0]),sha:p[1],parents:p.slice(2)};}
function rowsForRange(fromRef,headRef,firstParent=false){
  const head=resolveRef(headRef),args=['rev-list','--reverse','--topo-order','--timestamp','--parents'];
  if(firstParent)args.push('--first-parent');
  if(fromRef){
    const from=resolveRef(fromRef);
    try{git(['merge-base','--is-ancestor',from,head]);}catch{throw new Error(`--from ${fromRef} is not an ancestor of --head ${headRef}`);}
    const first=commitRow(git(['show','-s','--format=%ct %H %P',from]));
    const rest=git([...args,`${from}..${head}`]);
    return [first,...(rest?rest.split(/\r?\n/).filter(Boolean).map(commitRow):[])];
  }
  const out=git([...args,head]);
  return out?out.split(/\r?\n/).filter(Boolean).map(commitRow):[];
}
function sampleIndices(count,maxFrames){
  if(maxFrames<=0||count<=maxFrames)return Array.from({length:count},(_,i)=>i);
  if(maxFrames===1)return [count-1];
  const out=new Set();
  for(let i=0;i<maxFrames;i++)out.add(Math.round(i*(count-1)/(maxFrames-1)));
  return [...out].sort((a,b)=>a-b);
}
function subject(commit){return git(['show','-s','--format=%s',commit]).slice(0,240);}
function buildGraph(commit,temp,index){
  const snap=path.join(temp,`snapshot-${String(index).padStart(4,'0')}`),graphFile=path.join(temp,`graph-${String(index).padStart(4,'0')}.json`);
  node(['scripts/self-model-memory.mjs','build','--ref',commit,'--out',snap]);
  node(['scripts/self-model-graph-v2.mjs','normalize',snap,'--out',graphFile]);
  const raw=JSON.parse(fs.readFileSync(graphFile,'utf8'));
  const nodes=(raw.nodes||[]).filter(n=>KEEP_TYPES.has(n.type)).map(n=>({...n})).sort((a,b)=>a.id.localeCompare(b.id));
  const ids=new Set(nodes.map(n=>n.id));
  const edges=(raw.edges||[]).filter(e=>ids.has(e.from)&&ids.has(e.to)).map(e=>({...e})).sort((a,b)=>edgeKey(a).localeCompare(edgeKey(b)));
  return {nodes,edges,graphHash:sha(JSON.stringify({nodes:nodes.map(n=>n.id),edges:edges.map(edgeKey)})),fingerprint:raw.fingerprint||null};
}
function comparableNode(n){const x={...n};delete x.diffStatus;delete x.before;return JSON.stringify(x);}
function graphDelta(prev,next){
  const a=new Map(prev.nodes.map(n=>[n.id,n])),b=new Map(next.nodes.map(n=>[n.id,n]));
  const addedNodes=[...b.keys()].filter(id=>!a.has(id)).map(id=>b.get(id));
  const removedNodes=[...a.keys()].filter(id=>!b.has(id)).map(id=>a.get(id));
  const changedNodes=[...b.keys()].filter(id=>a.has(id)&&comparableNode(a.get(id))!==comparableNode(b.get(id))).map(id=>b.get(id));
  const ae=new Map(prev.edges.map(e=>[edgeKey(e),e])),be=new Map(next.edges.map(e=>[edgeKey(e),e]));
  const addedEdges=[...be.keys()].filter(k=>!ae.has(k)).map(k=>be.get(k));
  const removedEdges=[...ae.keys()].filter(k=>!be.has(k)).map(k=>ae.get(k));
  return {addedNodes,removedNodes,changedNodes,addedEdges,removedEdges};
}
function emptyDelta(){return {addedNodes:[],removedNodes:[],changedNodes:[],addedEdges:[],removedEdges:[]};}
function median(values){if(!values.length)return 1000;const a=[...values].sort((x,y)=>x-y),m=Math.floor(a.length/2);return a.length%2?a[m]:(a[m-1]+a[m])/2;}
function artifactHash(h){const copy={...h};delete copy.historyHash;return sha(JSON.stringify(copy));}
function applyDelta(maps,d){
  for(const n of d.removedNodes||[])maps.nodes.delete(n.id);
  for(const n of d.addedNodes||[])maps.nodes.set(n.id,n);
  for(const n of d.changedNodes||[])maps.nodes.set(n.id,n);
  for(const e of d.removedEdges||[])maps.edges.delete(edgeKey(e));
  for(const e of d.addedEdges||[])maps.edges.set(edgeKey(e),e);
  return maps;
}
function assertGraph(maps,label){const ids=new Set(maps.nodes.keys());if(ids.size!==maps.nodes.size)throw new Error(`${label}: duplicate node ids`);for(const e of maps.edges.values())if(!ids.has(e.from)||!ids.has(e.to))throw new Error(`${label}: dangling edge ${edgeKey(e)}`);}
function verifyHistory(h){
  if(h.kind!==KIND||h.version!==VERSION)throw new Error('unsupported temporal history artifact');
  if(!h.seed||!Array.isArray(h.seed.nodes)||!Array.isArray(h.seed.edges)||!Array.isArray(h.frames)||!h.frames.length)throw new Error('malformed temporal history artifact');
  const maps={nodes:new Map(h.seed.nodes.map(n=>[n.id,n])),edges:new Map(h.seed.edges.map(e=>[edgeKey(e),e]))};assertGraph(maps,'seed');
  for(let i=1;i<h.frames.length;i++){applyDelta(maps,h.frames[i].delta||emptyDelta());assertGraph(maps,`frame ${i}`);}
  const expected=artifactHash(h);if(h.historyHash&&h.historyHash!==expected)throw new Error(`history hash mismatch: expected ${expected}, got ${h.historyHash}`);
  return {ok:true,frames:h.frames.length,commits:h.source?.commitCount||h.frames.length,nodesAtEnd:maps.nodes.size,edgesAtEnd:maps.edges.size,historyHash:expected};
}
function build(){
  const from=arg('--from',null),head=arg('--head','HEAD'),firstParent=has('--first-parent'),all=has('--all'),maxFrames=all?0:Math.max(2,Math.min(1000,Number(arg('--max-frames',120))||120));
  const rows=rowsForRange(from,head,firstParent);if(!rows.length)throw new Error('no commits resolved for requested history');
  const indices=sampleIndices(rows.length,maxFrames),selected=indices.map(i=>({...rows[i],sourceOrdinal:i}));
  const gaps=[...rows].sort((a,b)=>a.timestampSec-b.timestampSec).slice(1).map((r,i)=>(r.timestampSec-[...rows].sort((a,b)=>a.timestampSec-b.timestampSec)[i].timestampSec)*1000).filter(x=>x>0);
  const temp=fs.mkdtempSync(path.join(os.tmpdir(),'conscios-history-'));
  try{
    const graphs=[],frames=[];
    for(let i=0;i<selected.length;i++){
      const row=selected[i],g=buildGraph(row.sha,temp,i);graphs.push(g);
      frames.push({commit:{sha:row.sha,shortSha:row.sha.slice(0,12),timestampMs:row.timestampSec*1000,parents:row.parents,subject:subject(row.sha),sourceOrdinal:row.sourceOrdinal,selectedOrdinal:i},fingerprint:g.fingerprint,graphHash:g.graphHash,delta:i===0?emptyDelta():graphDelta(graphs[i-1],g)});
    }
    const minTs=Math.min(...rows.map(r=>r.timestampSec))*1000,maxTs=Math.max(...rows.map(r=>r.timestampSec))*1000;
    const history={version:VERSION,kind:KIND,source:{from:from?resolveRef(from):null,head:resolveRef(head),commitCount:rows.length,frameCount:frames.length,sampled:frames.length<rows.length,maxFrames:maxFrames||null,firstParent,projection:'structural-v1'},stats:{minTimestampMs:minTs,maxTimestampMs:maxTs,medianCommitGapMs:median(gaps),minSourceOrdinal:0,maxSourceOrdinal:rows.length-1},orders:{sequence:frames.map((_,i)=>i),wallClock:frames.map((_,i)=>i).sort((a,b)=>frames[a].commit.timestampMs-frames[b].commit.timestampMs||frames[a].commit.sourceOrdinal-frames[b].commit.sourceOrdinal)},seed:{nodes:graphs[0].nodes,edges:graphs[0].edges,fingerprint:graphs[0].fingerprint,graphHash:graphs[0].graphHash},frames};
    history.historyHash=artifactHash(history);verifyHistory(history);writeJson(OUT,history);console.log(JSON.stringify({out:OUT,historyHash:history.historyHash,commits:rows.length,frames:frames.length,sampled:history.source.sampled,bytes:fs.statSync(OUT).size}));
  }finally{fs.rmSync(temp,{recursive:true,force:true});}
}
function selfTest(){
  const a={nodes:[{id:'a',type:'File'},{id:'b',type:'Concept'}],edges:[{from:'a',type:'X',to:'b'}]},b={nodes:[{id:'a',type:'File',sha256:'2'},{id:'c',type:'Concept'}],edges:[{from:'a',type:'X',to:'c'}]},d=graphDelta(a,b),h={version:VERSION,kind:KIND,source:{commitCount:2},stats:{},orders:{sequence:[0,1],wallClock:[0,1]},seed:a,frames:[{commit:{sha:'0'},delta:emptyDelta()},{commit:{sha:'1'},delta:d}]};h.historyHash=artifactHash(h);const r=verifyHistory(h);if(d.addedNodes.length!==1||d.removedNodes.length!==1||d.changedNodes.length!==1)throw new Error('delta self-test failed');console.log(JSON.stringify({...r,delta:{added:d.addedNodes.length,removed:d.removedNodes.length,changed:d.changedNodes.length}}));
}
function usage(){console.log('self-model-history.mjs build [--from ref] [--head ref] [--max-frames N|--all] [--first-parent] [--out file]\nself-model-history.mjs verify <file>\nself-model-history.mjs summary <file>\nself-model-history.mjs --self-test');}
if(has('--self-test'))selfTest();
else if(cmd==='build')build();
else if(cmd==='verify'||cmd==='summary'){
  const p=argv.find(x=>!x.startsWith('--'))||arg('--file');if(!p)throw new Error(`${cmd} requires a history file`);const h=JSON.parse(fs.readFileSync(path.resolve(ROOT,p),'utf8')),r=verifyHistory(h);console.log(JSON.stringify(cmd==='verify'?r:{...r,source:h.source,stats:h.stats}));
}else usage();
