#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const argv=process.argv.slice(2);
const cmd=argv[0]&&!argv[0].startsWith('--')?argv.shift():'metrics';
const arg=(name,fallback=null)=>{const i=argv.indexOf(name);return i>=0?argv[i+1]:fallback;};
const read=file=>JSON.parse(fs.readFileSync(path.resolve(file),'utf8'));
const edgeKey=e=>`${e.source}|${e.type}|${e.target}`;
const STRUCTURAL=new Set(['DEPENDS_ON','IMPORTS','CALLS','REFERENCES']);

function stronglyConnected(nodes,edges){
  const ids=new Set(nodes.map(n=>n.id)),adj=new Map([...ids].map(id=>[id,[]]));
  for(const e of edges)if(STRUCTURAL.has(e.type)&&ids.has(e.source)&&ids.has(e.target))adj.get(e.source).push(e.target);
  let index=0;const stack=[],on=new Set,indexes=new Map,low=new Map,out=[];
  function visit(v){
    indexes.set(v,index);low.set(v,index);index++;stack.push(v);on.add(v);
    for(const w of adj.get(v)||[]){
      if(!indexes.has(w)){visit(w);low.set(v,Math.min(low.get(v),low.get(w)));}
      else if(on.has(w))low.set(v,Math.min(low.get(v),indexes.get(w)));
    }
    if(low.get(v)===indexes.get(v)){
      const s=[];let w;do{w=stack.pop();on.delete(w);s.push(w);}while(w!==v);
      if(s.length>1||((adj.get(v)||[]).includes(v)))out.push(s.sort());
    }
  }
  for(const id of ids)if(!indexes.has(id))visit(id);
  return out.sort((a,b)=>b.length-a.length||a[0].localeCompare(b[0]));
}

function analyze(data){
  if(!Array.isArray(data.nodes)||!Array.isArray(data.edges))throw new Error('artifact requires nodes[] and edges[]');
  const byId=new Map(data.nodes.map(n=>[n.id,n])),degree=new Map(data.nodes.map(n=>[n.id,0])),edgeTypes={},nodeTypes={},coupling={};
  let dangling=0,crossRepo=0,lowConfidence=0;
  for(const n of data.nodes)nodeTypes[n.type]=(nodeTypes[n.type]||0)+1;
  for(const e of data.edges){
    edgeTypes[e.type]=(edgeTypes[e.type]||0)+1;
    if(!byId.has(e.source)||!byId.has(e.target)){dangling++;continue}
    degree.set(e.source,(degree.get(e.source)||0)+1);degree.set(e.target,(degree.get(e.target)||0)+1);
    const a=byId.get(e.source),b=byId.get(e.target),ar=a.repo||((a.type==='Repository')?a.id:null),br=b.repo||((b.type==='Repository')?b.id:null);
    if(ar&&br&&ar!==br){crossRepo++;const key=[ar,br].sort().join(' <-> ');coupling[key]=(coupling[key]||0)+1;}
    if(Number(e.confidence??1)<1)lowConfidence++;
  }
  const orphanNodes=data.nodes.filter(n=>!['DevelopmentLandscape','Repository'].includes(n.type)&&(degree.get(n.id)||0)===0).map(n=>n.id);
  const ranked=[...degree.entries()].sort((a,b)=>b[1]-a[1]||a[0].localeCompare(b[0]));
  const cycles=stronglyConnected(data.nodes,data.edges);
  return {
    kind:'conscios-development-landscape-quality',
    sourceKind:data.kind||null,
    sourceHash:data.landscapeHash||data.projectionHash||null,
    metrics:{
      nodes:data.nodes.length,edges:data.edges.length,danglingEdges:dangling,
      crossRepositoryEdges:crossRepo,lowConfidenceEdges:lowConfidence,
      orphanNodes:orphanNodes.length,dependencyCycles:cycles.length,
      largestDependencyCycle:cycles[0]?.length||0,
      maxDegree:ranked[0]?.[1]||0,maxDegreeNode:ranked[0]?.[0]||null
    },
    nodeTypes,edgeTypes,repositoryCoupling:coupling,
    dependencyCycleSamples:cycles.slice(0,12),
    orphanSamples:orphanNodes.slice(0,24)
  };
}

function compare(base,candidate){
  const a=analyze(base),b=analyze(candidate),delta={};
  for(const k of Object.keys(a.metrics))if(typeof a.metrics[k]==='number'&&typeof b.metrics[k]==='number')delta[k]=b.metrics[k]-a.metrics[k];
  return {kind:'conscios-development-landscape-quality-comparison',base:a,candidate:b,delta};
}

function gate(base,candidate,policy){
  const result=compare(base,candidate),d=result.delta,checks=[];
  const rule=(metric,key)=>{if(policy[key]===undefined)return;const limit=Number(policy[key]);const value=Number(d[metric]||0);checks.push({metric,delta:value,maxIncrease:limit,pass:value<=limit});};
  rule('dependencyCycles','maxDependencyCycleIncrease');
  rule('crossRepositoryEdges','maxCrossRepositoryEdgeIncrease');
  rule('lowConfidenceEdges','maxLowConfidenceEdgeIncrease');
  rule('orphanNodes','maxOrphanIncrease');
  rule('maxDegree','maxDegreeIncrease');
  return {...result,policy,checks,pass:checks.every(x=>x.pass)};
}

function selfTest(){
  const base={kind:'conscios-development-landscape',nodes:[
    {id:'repository:a',type:'Repository',repo:'repository:a'},
    {id:'module:a',type:'Module',repo:'repository:a'},
    {id:'module:b',type:'Module',repo:'repository:a'}
  ],edges:[{source:'module:a',type:'DEPENDS_ON',target:'module:b',confidence:1}]};
  const candidate={...base,nodes:[...base.nodes,{id:'module:c',type:'Module',repo:'repository:a'}],edges:[
    ...base.edges,
    {source:'module:b',type:'DEPENDS_ON',target:'module:a',confidence:1},
    {source:'module:c',type:'REFERENCES',target:'module:a',confidence:.6}
  ]};
  const r=gate(base,candidate,{maxDependencyCycleIncrease:0,maxLowConfidenceEdgeIncrease:1});
  assert.equal(r.delta.dependencyCycles,1);assert.equal(r.delta.lowConfidenceEdges,1);assert.equal(r.pass,false);
  console.log(JSON.stringify({ok:true,delta:r.delta,gatePass:r.pass}));
}

if(argv.includes('--self-test'))selfTest();
else if(cmd==='metrics')console.log(JSON.stringify(analyze(read(arg('--input',argv[0]))),null,2));
else if(cmd==='compare')console.log(JSON.stringify(compare(read(arg('--base')),read(arg('--candidate'))),null,2));
else if(cmd==='gate'){const r=gate(read(arg('--base')),read(arg('--candidate')),read(arg('--policy')));console.log(JSON.stringify(r,null,2));process.exitCode=r.pass?0:2;}
else console.log('metrics --input FILE | compare --base FILE --candidate FILE | gate --base FILE --candidate FILE --policy FILE | --self-test');
