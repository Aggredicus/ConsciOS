#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const VERSION=2;
const argv=process.argv.slice(2);
const cmd=argv.shift()||'help';
const arg=(name,fallback=null)=>{const i=argv.indexOf(name);return i>=0?argv[i+1]:fallback;};
const positional=()=>argv.filter((x,i)=>!x.startsWith('--')&&(i===0||!argv[i-1]?.startsWith('--'));
const sha=v=>crypto.createHash('sha256').update(v).digest('hex');
const readJson=p=>JSON.parse(fs.readFileSync(p,'utf8'));
const writeJson=(p,v)=>{fs.mkdirSync(path.dirname(p),{recursive:true});fs.writeFileSync(p,JSON.stringify(v,null,2)+'\n');};
const graphPath=d=>path.join(d,'ontology','current.json');

function canonicalId(node){
  if(node.type==='Section'&&!String(node.id).startsWith('section:'))return `section:${node.id}`;
  return String(node.id);
}
function normalize(snapshotDir,{findingsPath=null}={}){
  const raw=readJson(graphPath(snapshotDir));
  const manifestPath=path.join(snapshotDir,'manifest.json');
  const manifest=fs.existsSync(manifestPath)?readJson(manifestPath):{};
  const nodes=[];const seen=new Set();
  for(const original of raw.nodes||[]){
    const node={...original,id:canonicalId(original)};
    if(seen.has(node.id))throw new Error(`duplicate node id: ${node.id}`);
    seen.add(node.id);nodes.push(node);
  }
  const domains=new Map();
  for(const n of nodes){
    if(!n.path||!n.domain||!String(n.id).startsWith('file:'))continue;
    const id=`domain:${n.domain}`;
    if(!domains.has(id))domains.set(id,{id,type:'Domain',label:n.domain});
  }
  for(const d of domains.values()){if(!seen.has(d.id)){seen.add(d.id);nodes.push(d);}}
  const edges=(raw.edges||[]).map(e=>({...e}));
  for(const n of nodes){if(String(n.id).startsWith('file:')&&n.domain)edges.push({from:n.id,type:'IN_DOMAIN',to:`domain:${n.domain}`});}
  if(findingsPath&&fs.existsSync(findingsPath)){
    const audit=readJson(findingsPath);
    for(const f of audit.findings||[]){
      const id=f.id?.startsWith('finding:')?f.id:`finding:${f.id||sha(JSON.stringify(f)).slice(0,20)}`;
      if(!seen.has(id)){seen.add(id);const node={...f,id,type:'GovernanceFinding'};nodes.push(node);}
      for(const target of f.relatedNodeIds||[])edges.push({from:id,type:'RELATES_TO',to:target});
      for(const decision of f.decisionIds||[])edges.push({from:id,type:'EVIDENCES_DECISION',to:decision});
    }
    for(const d of audit.decisions||[]){
      const id=d.id?.startsWith('decision:')?d.id:`decision:${d.id||sha(JSON.stringify(d)).slice(0,20)}`;
      if(!seen.has(id)){seen.add(id);const node={...d,id,type:'GovernanceDecision'};nodes.push(node);}
      if(d.relatedNodeId)edges.push({from:id,type:'GOVERNS',to:d.relatedNodeId});
    }
  }
  nodes.sort((a,b)=>a.id.localeCompare(b.id));
  const ids=new Set(nodes.map(n=>n.id));
  const unique=[];const edgeSeen=new Set();const dangling=[];
  for(const e of edges){
    const key=`${e.from}|${e.type}|${e.to}|${e.mode||''}`;
    if(edgeSeen.has(key))continue;edgeSeen.add(key);
    if(!ids.has(e.from)||!ids.has(e.to))dangling.push({...e,missingFrom:!ids.has(e.from),missingTo:!ids.has(e.to)});
    unique.push(e);
  }
  if(dangling.length)throw new Error(`graph has ${dangling.length} dangling edges; first=${JSON.stringify(dangling[0])}`);
  unique.sort((a,b)=>`${a.from}|${a.type}|${a.to}|${a.mode||''}`.localeCompare(`${b.from}|${b.type}|${b.to}|${b.mode||''}`));
  const typeCounts={};for(const n of nodes)typeCounts[n.type]=(typeCounts[n.type]||0)+1;
  const edgeTypeCounts={};for(const e of unique)edgeTypeCounts[e.type]=(edgeTypeCounts[e.type]||0)+1;
  const out={version:VERSION,source:manifest.source||raw.source||null,fingerprint:manifest.fingerprint||raw.fingerprint||null,nodes,edges:unique,metrics:{nodeCount:nodes.length,edgeCount:unique.length,typeCounts,edgeTypeCounts,danglingEdges:0,duplicateNodeIds:0}};
  out.graphHash=sha(JSON.stringify({nodes:nodes.map(n=>n.id),edges:unique.map(e=>[e.from,e.type,e.to,e.mode||''])}));
  return out;
}
function comparableNode(n){const x={...n};delete x.diffStatus;delete x.before;return x;}
function edgeKey(e){return `${e.from}|${e.type}|${e.to}|${e.mode||''}`;}
function diff(base,head){
  const a=new Map(base.nodes.map(n=>[n.id,n])),b=new Map(head.nodes.map(n=>[n.id,n]));
  const ids=[...new Set([...a.keys(),...b.keys()])].sort();
  const nodes=ids.map(id=>{
    if(!a.has(id))return {...b.get(id),diffStatus:'added'};
    if(!b.has(id))return {...a.get(id),diffStatus:'removed'};
    const before=a.get(id),after=b.get(id);
    const changed=JSON.stringify(comparableNode(before))!==JSON.stringify(comparableNode(after));
    return changed?{...after,diffStatus:'changed',before}:{...after,diffStatus:'unchanged'};
  });
  const ae=new Map(base.edges.map(e=>[edgeKey(e),e])),be=new Map(head.edges.map(e=>[edgeKey(e),e]));
  const ekeys=[...new Set([...ae.keys(),...be.keys()])].sort();
  const edges=ekeys.map(k=>!ae.has(k)?{...be.get(k),diffStatus:'added'}:!be.has(k)?{...ae.get(k),diffStatus:'removed'}:{...be.get(k),diffStatus:'unchanged'});
  const count=(xs,s)=>xs.filter(x=>x.diffStatus===s).length;
  return {version:VERSION,base:{fingerprint:base.fingerprint,graphHash:base.graphHash},head:{fingerprint:head.fingerprint,graphHash:head.graphHash},summary:{nodes:{added:count(nodes,'added'),removed:count(nodes,'removed'),changed:count(nodes,'changed'),unchanged:count(nodes,'unchanged')},edges:{added:count(edges,'added'),removed:count(edges,'removed'),unchanged:count(edges,'unchanged')}},nodes,edges};
}
function compact(graph){
  const keep=new Set(['Repository','Domain','Role','AgentContract','Workflow','Interface','Schema','DevelopmentDocument','Section','Concept','GovernanceFinding','GovernanceDecision']);
  const nodes=graph.nodes.filter(n=>keep.has(n.type));
  const ids=new Set(nodes.map(n=>n.id));
  const edges=graph.edges.filter(e=>ids.has(e.from)&&ids.has(e.to));
  return {version:graph.version,fingerprint:graph.fingerprint,graphHash:graph.graphHash,metrics:{nodeCount:nodes.length,edgeCount:edges.length},nodes,edges};
}
function usage(){console.log('self-model-graph-v2.mjs normalize <snapshotDir> [--out file] [--findings findings.json]\nself-model-graph-v2.mjs verify <snapshotDir>\nself-model-graph-v2.mjs diff <baseDir> <headDir> [--out file] [--base-findings file] [--head-findings file]\nself-model-graph-v2.mjs compact <snapshotDir> [--out file]');}
const pos=positional();
if(cmd==='normalize'||cmd==='verify'||cmd==='compact'){
  const dir=pos[0];if(!dir)throw new Error('snapshotDir required');
  const graph=normalize(dir,{findingsPath:arg('--findings')});
  if(cmd==='verify')console.log(JSON.stringify({ok:true,...graph.metrics,graphHash:graph.graphHash}));
  else {const data=cmd==='compact'?compact(graph):graph;const out=arg('--out');if(out)writeJson(out,data);else process.stdout.write(JSON.stringify(data,null,2)+'\n');}
}else if(cmd==='diff'){
  if(pos.length<2)throw new Error('baseDir and headDir required');
  const d=diff(normalize(pos[0],{findingsPath:arg('--base-findings')}),normalize(pos[1],{findingsPath:arg('--head-findings')}));
  const out=arg('--out');if(out)writeJson(out,d);else process.stdout.write(JSON.stringify(d,null,2)+'\n');
}else usage();
