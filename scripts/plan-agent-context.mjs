#!/usr/bin/env node
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
const ROOT=process.cwd(),argv=process.argv.slice(2);const arg=(n,d=null)=>{const i=argv.indexOf(n);return i>=0?argv[i+1]:d};
const role=argv.find(x=>!x.startsWith('--')&&x!==arg('--task')&&x!==arg('--limit'));
const task=arg('--task','');const limit=Math.max(1,Math.min(24,Number(arg('--limit',12))||12));
if(!role||!task)throw new Error('Usage: node scripts/plan-agent-context.mjs <Role> --task "..." [--limit 12] [--json]');
const ownership=fs.readFileSync(path.join(ROOT,'agents/OWNERSHIP.yaml'),'utf8');
const line=ownership.split(/\r?\n/).find(x=>new RegExp(`^\\s*${role.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')}:`).test(x));
if(!line)throw new Error(`Unknown role: ${role}`);
const m=line.match(/owns:\s*\[([^\]]*)\]/);const roots=(m?.[1]||'').split(',').map(x=>x.trim().replace(/\*\*.*$/,'').replace(/\/$/,'')).filter(Boolean);
const shared=['CONSCIOS_CHARTER.md','WELFARE_PROTOCOL.md','SCIENTIFIC_METHOD.md','interfaces/'];
const ls=execFileSync('git',['ls-files'],{cwd:ROOT,encoding:'utf8'}).split(/\r?\n/).filter(Boolean);
const allowed=p=>roots.some(r=>p===r||p.startsWith(`${r}/`))||shared.some(r=>r.endsWith('/')?p.startsWith(r):p===r);
const allowedFiles=ls.filter(allowed),baselineBytes=allowedFiles.reduce((n,p)=>n+fs.statSync(path.join(ROOT,p)).size,0);
const roleContract=`agents/${role.replace(/([a-z0-9])([A-Z])/g,'$1-$2').toLowerCase()}.agent.yaml`;
const mandatory=['agents/OWNERSHIP.yaml',...(fs.existsSync(path.join(ROOT,roleContract))?[roleContract]:[])];
const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'conscios-context-plan-')),idx=path.join(tmp,'self-model');
execFileSync(process.execPath,['scripts/self-model-memory.mjs','build','--ref','HEAD','--out',idx],{cwd:ROOT,stdio:'ignore'});
let results=[];try{results=JSON.parse(execFileSync(process.execPath,['scripts/self-model-memory.mjs','search',task,'--index',idx,'--limit',String(limit),'--json'],{cwd:ROOT,encoding:'utf8',maxBuffer:8*1024*1024}));}catch{}
const selected=[];let selectedBytes=0;
for(const r of results){if(!allowedFiles.includes(r.file)||selected.some(x=>x.sectionId===r.sectionId))continue;try{const material=JSON.parse(execFileSync(process.execPath,['scripts/self-model-memory.mjs','read',r.sectionId,'--index',idx,'--json'],{cwd:ROOT,encoding:'utf8',maxBuffer:8*1024*1024}));selected.push({sectionId:r.sectionId,file:r.file,heading:r.heading,startLine:material.startLine,endLine:material.endLine,bytes:material.bytes,sha256:material.sha256,score:r.score});selectedBytes+=material.bytes;}catch{}if(selected.length>=limit)break;}
fs.rmSync(tmp,{recursive:true,force:true});
const mandatoryBytes=mandatory.reduce((n,p)=>n+(fs.existsSync(path.join(ROOT,p))?fs.statSync(path.join(ROOT,p)).size:0),0),plannedBytes=mandatoryBytes+selectedBytes;
const report={version:'0.1.0',kind:'advisory-section-context-plan',authority:'none',role,task,mandatoryFiles:mandatory,allowedWholeFileCount:allowedFiles.length,baselineWholeFileBytes:baselineBytes,selectedSections:selected,plannedBytes,reduction:baselineBytes?Math.round((1-plannedBytes/baselineBytes)*10000)/10000:null,fallback:'If selected sections are insufficient, expand to their subtrees, then adjacent evidence, then whole allowed files. Existing ownership/governance remains authoritative.'};
process.stdout.write(JSON.stringify(report,null,2)+'\n');
