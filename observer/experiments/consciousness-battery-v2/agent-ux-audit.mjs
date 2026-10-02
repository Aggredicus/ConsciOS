#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';
import {execFileSync} from 'node:child_process';
const ROOT=process.cwd(),argv=process.argv.slice(2);const arg=(n,d=null)=>{const i=argv.indexOf(n);return i>=0?argv[i+1]:d};
const hash=v=>crypto.createHash('sha256').update(v).digest('hex');
const run=args=>execFileSync(process.execPath,args,{cwd:ROOT,encoding:'utf8',maxBuffer:16*1024*1024});
const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'conscios-agent-ux-'));
const index=path.join(tmp,'model');
run(['scripts/self-model-memory.mjs','build','--ref','HEAD','--out',index]);
const tasks=[
 {kind:'heading',query:'Self Model',file:'ARCHITECTURE.md',heading:/Self Model/i},
 {kind:'heading',query:'Global Workspace',file:'ARCHITECTURE.md',heading:/Global Workspace/i},
 {kind:'heading',query:'Claims discipline',file:'SCIENTIFIC_METHOD.md',heading:/Claims discipline/i},
 {kind:'heading',query:'Temporal continuity',file:'SCIENTIFIC_METHOD.md',heading:/Temporal continuity/i},
 {kind:'heading',query:'Governance discrepancy lifecycle',file:'development/SELF_MODEL_STUDIO.md',heading:/Governance discrepancy lifecycle/i},
 {kind:'natural',query:'why first person claims are not evidence',file:'SCIENTIFIC_CONTRACT.md',heading:/Claims|Scientific/i},
 {kind:'natural',query:'what is an agent allowed to change',file:'AGENT_ORGANIZATION.md',heading:/permission|ownership|governance|write/i},
 {kind:'natural',query:'how does the system remember across restarts',file:'SCIENTIFIC_METHOD.md',heading:/Temporal continuity|memory/i},
 {kind:'natural',query:'what protects humans from agent self modification',file:'AGENT_ORGANIZATION.md',heading:/governance|human|permission/i}
];
const rows=[];
for(const t of tasks){
 let results=[];try{results=JSON.parse(run(['scripts/self-model-memory.mjs','search',t.query,'--index',index,'--limit','12','--json']));}catch{}
 const rank=results.findIndex(r=>r.file===t.file&&t.heading.test(r.heading||''));
 const hit=rank>=0?results[rank]:null;let sectionBytes=null,wholeBytes=null,reduction=null;
 if(hit){try{const r=JSON.parse(run(['scripts/self-model-memory.mjs','read',hit.sectionId,'--index',index,'--json']));sectionBytes=r.bytes;wholeBytes=fs.statSync(path.join(ROOT,t.file)).size;reduction=wholeBytes?1-sectionBytes/wholeBytes:null;}catch{}}
 rows.push({kind:t.kind,query:t.query,expectedFile:t.file,hit:!!hit,rank:rank>=0?rank+1:null,sectionId:hit?.sectionId??null,sectionBytes,wholeFileBytes:wholeBytes,reduction:reduction===null?null:Math.round(reduction*10000)/10000,topResults:results.slice(0,3).map(r=>({file:r.file,heading:r.heading,score:r.score}))});
}
fs.rmSync(tmp,{recursive:true,force:true});
const byKind=k=>{const xs=rows.filter(r=>r.kind===k),ys=xs.filter(r=>r.reduction!==null);return {tasks:xs.length,hits:xs.filter(r=>r.hit).length,hitRate:xs.length?xs.filter(r=>r.hit).length/xs.length:0,meanReduction:ys.length?ys.reduce((a,r)=>a+r.reduction,0)/ys.length:null};};
const allReduced=rows.filter(r=>r.reduction!==null);
const summary={heading:byKind('heading'),naturalLanguage:byKind('natural'),overall:{tasks:rows.length,hits:rows.filter(r=>r.hit).length,hitRate:rows.filter(r=>r.hit).length/rows.length,meanReduction:allReduced.length?allReduced.reduce((a,r)=>a+r.reduction,0)/allReduced.length:null}};
const report={version:'0.4.0',kind:'agent-retrieval-ux',interpretation:'Measures navigation/retrieval UX and byte exposure, not intelligence or consciousness.',summary,rows,knownLimitation:'The deterministic index primarily routes by headings, file paths, and declared metadata; body-semantic discovery is intentionally limited in v0.1.',reportHash:null};report.reportHash=hash(JSON.stringify({...report,reportHash:null}));
const out=arg('--out');if(out){fs.mkdirSync(path.dirname(out),{recursive:true});fs.writeFileSync(out,JSON.stringify(report,null,2)+'\n')}else process.stdout.write(JSON.stringify(report,null,2)+'\n');
