#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {execFileSync} from 'node:child_process';

const root=process.cwd();
const argv=process.argv.slice(2);
const arg=(n,d=null)=>{const i=argv.indexOf(n);return i>=0?argv[i+1]:d;};
const outDir=arg('--out','artifacts/self-model/current/governance');
const snapshot=arg('--snapshot','artifacts/self-model/current');
const sha=s=>crypto.createHash('sha256').update(s).digest('hex');
const git=a=>execFileSync('git',a,{cwd:root,encoding:'utf8',maxBuffer:64*1024*1024});
const files=git(['ls-files','-z']).split('\0').filter(Boolean).sort();
const textExt=new Set(['.md','.mdx','.txt','.json','.jsonl','.yaml','.yml','.toml','.mjs','.js','.cjs','.ts','.tsx','.jsx','.html','.css','.py','.sh','.sql','.graphql','.gql','.xml','.csv','.ini','.conf']);
const baseNames=new Set(['LICENSE','Makefile','Dockerfile','.gitignore','.gitattributes','.editorconfig']);
const isText=p=>baseNames.has(path.basename(p))||textExt.has(path.extname(p).toLowerCase());
const safeRead=p=>{try{return fs.readFileSync(path.join(root,p),'utf8')}catch{return null}};
const sectionsPath=path.join(root,snapshot,'index','sections.jsonl');
const sections=fs.existsSync(sectionsPath)?fs.readFileSync(sectionsPath,'utf8').split(/\r?\n/).filter(Boolean).map(JSON.parse):[];
const byFile=new Map();for(const s of sections){if(!byFile.has(s.file))byFile.set(s.file,[]);byFile.get(s.file).push(s)};
const sectionAt=(p,line)=>{const ss=byFile.get(p)||[];let best=null;for(const s of ss){if(line>=s.startLine&&line<=s.subtreeEndLine&&(!best||s.level>best.level))best=s;}return best;};
const related=(p,line)=>{const s=sectionAt(p,line);return s?[`file:${p}`,`section:${s.id.replace(/^section:/,'')}`]:[`file:${p}`];};
const findings=[];const decisions=[];
function addFinding({category,severity='low',rule,path:p=null,line=null,message,excerpt=null,decisionIds=[]}){
  const seed=[category,severity,rule,p,line,message].join('|');
  findings.push({id:`finding:${sha(seed).slice(0,20)}`,category,severity,rule,path:p,line,message,excerpt:excerpt?.slice(0,240)||null,relatedNodeIds:p?related(p,line||1):[],decisionIds});
}
const normative=/\b(must not|may not|shall not|must|shall|required|forbidden|prohibited|never)\b/i;
const protectedSources=p=>['CONSCIOS_CHARTER.md','WELFARE_PROTOCOL.md','SCIENTIFIC_METHOD.md','AGENT_ORGANIZATION.md'].includes(p)||p==='agents/ORCHESTRATION_POLICY.md'||p.startsWith('agents/')||p.startsWith('development/');
for(const p of files.filter(isText)){
  const t=safeRead(p);if(t==null)continue;const ls=t.split(/\r?\n/);
  if(protectedSources(p)&&/\.md$/i.test(p)){
    let fence=false,heading='';
    ls.forEach((raw,i)=>{const line=i+1;if(/^\s*(```|~~~)/.test(raw)){fence=!fence;return}if(fence)return;const hm=raw.match(/^\s{0,3}#{1,6}\s+(.+?)\s*#*\s*$/);if(hm){heading=hm[1].trim();return}if(!normative.test(raw))return;const polarity=/\b(must not|may not|shall not|forbidden|prohibited|never)\b/i.test(raw)?'deny':'require';const text=raw.trim().replace(/^[-*+]\s+/,'').replace(/^\d+[.)]\s+/,'');if(text.length<12)return;const id=`decision:${sha(`${p}:${line}:${text}`).slice(0,20)}`;decisions.push({id,type:'GovernanceDecision',authority:p.startsWith('development/')?'design':'governance',polarity,source:{path:p,line,heading},text,relatedNodeId:related(p,line).at(-1)});});
  }
  const ext=path.extname(p).toLowerCase();
  if(['.js','.mjs','.cjs','.ts','.tsx','.jsx','.html'].includes(ext)){
    const rules=[[/\beval\s*\(/g,'SEC-EVAL','high','Dynamic eval can execute untrusted code.'],[/\bnew\s+Function\s*\(/g,'SEC-NEW-FUNCTION','high','Dynamic Function construction expands code-injection risk.'],[/\.innerHTML\s*=/g,'SEC-INNERHTML','medium','Direct innerHTML assignment should be reviewed for injection.'],[/insertAdjacentHTML\s*\(/g,'SEC-INSERT-HTML','medium','HTML string insertion should be reviewed for injection.'],[/document\.write\s*\(/g,'SEC-DOCUMENT-WRITE','medium','document.write is unsafe and degrades page behavior.'],[/postMessage\s*\([^\n]*['"]\*['"]/g,'SEC-WILDCARD-POSTMESSAGE','medium','Wildcard postMessage target origin weakens message isolation.']];
    for(const [re,rule,severity,msg] of rules){for(const m of t.matchAll(re)){const line=t.slice(0,m.index).split(/\n/).length;addFinding({category:'security',severity,rule,path:p,line,message:msg,excerpt:ls[line-1]});}}
  }
  for(const m of t.matchAll(/http:\/\/(?!localhost|127\.0\.0\.1|0\.0\.0\.0)[^\s"')>]+/g)){const line=t.slice(0,m.index).split(/\n/).length;addFinding({category:'security',severity:'medium',rule:'SEC-INSECURE-HTTP',path:p,line,message:'External plaintext HTTP reference should be reviewed or upgraded to HTTPS.',excerpt:m[0]});}
  if(ext==='.html'){
    if(!/<html\b[^>]*\blang=/i.test(t))addFinding({category:'ux',severity:'medium',rule:'UX-HTML-LANG',path:p,line:1,message:'HTML document has no declared language for accessibility.'});
    if(!/<meta\b[^>]*name=["']viewport["']/i.test(t))addFinding({category:'ux',severity:'medium',rule:'UX-VIEWPORT',path:p,line:1,message:'HTML document has no responsive viewport declaration.'});
    if(!/<title>[^<]+<\/title>/i.test(t))addFinding({category:'ux',severity:'low',rule:'UX-TITLE',path:p,line:1,message:'HTML document has no non-empty title.'});
    for(const m of t.matchAll(/<a\b[^>]*target=["']_blank["'][^>]*>/gi)){if(!/rel=["'][^"']*noopener/i.test(m[0])){const line=t.slice(0,m.index).split(/\n/).length;addFinding({category:'security',severity:'low',rule:'SEC-BLANK-NOOPENER',path:p,line,message:'target=_blank link should include rel=noopener.',excerpt:m[0]});}}
  }
  const bytes=Buffer.byteLength(t);
  if(bytes>80000)addFinding({category:'token-cost',severity:'medium',rule:'TOK-LARGE-FILE',path:p,line:1,message:`Large text file (${bytes} bytes) is expensive to load wholesale; prefer indexed section retrieval.`});
  if(/\.mdx?$/i.test(p)&&bytes>20000){const headings=(t.match(/^#{1,6}\s+/gm)||[]).length;if(headings<3)addFinding({category:'token-cost',severity:'medium',rule:'TOK-LOW-ADDRESSABILITY',path:p,line:1,message:`Large Markdown file has only ${headings} headings; section-addressed retrieval may be inefficient.`});}
}
for(const s of sections){if((s.subtreeBytes||0)>12000)addFinding({category:'token-cost',severity:'low',rule:'TOK-LARGE-SECTION',path:s.file,line:s.startLine,message:`Section subtree is ${s.subtreeBytes} bytes; consider a deeper heading boundary if it is frequently retrieved.`,excerpt:s.heading});}
for(const p of files.filter(p=>p.startsWith('.github/workflows/')&&/\.ya?ml$/i.test(p))){
  const t=safeRead(p)||'',ls=t.split(/\r?\n/);
  if(/\bpull_request_target\s*:/i.test(t))addFinding({category:'security',severity:'high',rule:'SEC-PR-TARGET',path:p,line:ls.findIndex(x=>/pull_request_target\s*:/.test(x))+1,message:'pull_request_target executes with base-repository privileges; require explicit threat review.'});
  if(!/^permissions\s*:/m.test(t))addFinding({category:'security',severity:'medium',rule:'SEC-WORKFLOW-PERMISSIONS',path:p,line:1,message:'Workflow has no explicit top-level permissions block; default token scope may be broader than necessary.'});
  ls.forEach((raw,i)=>{const m=raw.match(/^\s*-?\s*uses:\s*([^\s#]+)\s*/);if(m&&/^[\w.-]+\/[\w.-]+@/.test(m[1])){const ref=m[1].split('@')[1]||'';if(!/^[a-f0-9]{40}$/i.test(ref))addFinding({category:'security',severity:'low',rule:'SEC-ACTION-PIN',path:p,line:i+1,message:'Action is not pinned to an immutable full commit SHA.',excerpt:m[1]});}});
  ls.forEach((raw,i)=>{if(/^\s*(contents|pull-requests|issues|actions|checks|deployments|packages|id-token)\s*:\s*write\s*$/i.test(raw))addFinding({category:'security',severity:'medium',rule:'SEC-WORKFLOW-WRITE',path:p,line:i+1,message:'Workflow requests write privilege; verify least privilege and role ownership.',excerpt:raw.trim()});});
}
const sm=safeRead('scripts/self-model-memory.mjs')||'';
if(sm&&!sm.includes("'artifacts/self-model/'"))addFinding({category:'governance',severity:'high',rule:'GOV-OBSERVER-RECURSION',path:'scripts/self-model-memory.mjs',line:1,message:'Self-model generator no longer visibly excludes its generated artifact surface.'});
const ownership=safeRead('agents/OWNERSHIP.yaml')||'';
for(const required of ['CONSCIOS_CHARTER.md','WELFARE_PROTOCOL.md','SCIENTIFIC_METHOD.md','agents/**','audits/**'])if(!ownership.includes(required))addFinding({category:'governance',severity:'high',rule:'GOV-PROTECTED-SURFACE',path:'agents/OWNERSHIP.yaml',line:1,message:`Expected protected governance surface is not declared: ${required}`});
const groups=new Map();
for(const d of decisions){const core=d.text.toLowerCase().replace(/\b(must not|may not|shall not|must|shall|required|forbidden|prohibited|never)\b/g,' ').replace(/[^a-z0-9]+/g,' ').trim();if(core.length<24)continue;if(!groups.has(core))groups.set(core,[]);groups.get(core).push(d);}
for(const ds of groups.values()){const pol=new Set(ds.map(d=>d.polarity));if(pol.size>1){const a=ds[0];addFinding({category:'governance',severity:'high',rule:'GOV-CONTRADICTORY-NORM',path:a.source.path,line:a.source.line,message:'Potentially contradictory normative statements share the same normalized rule body.',excerpt:a.text,decisionIds:ds.map(d=>d.id)});}}
const sevRank={high:3,medium:2,low:1,info:0};findings.sort((a,b)=>(sevRank[b.severity]-sevRank[a.severity])||a.category.localeCompare(b.category)||String(a.path).localeCompare(String(b.path))||(a.line||0)-(b.line||0));
const summary={filesScanned:files.filter(isText).length,decisions:decisions.length,findings:findings.length,bySeverity:Object.fromEntries(['high','medium','low','info'].map(s=>[s,findings.filter(f=>f.severity===s).length])),byCategory:Object.fromEntries([...new Set(findings.map(f=>f.category))].sort().map(c=>[c,findings.filter(f=>f.category===c).length]))};
const result={version:1,generatedAt:new Date().toISOString(),summary,decisions,findings};
fs.mkdirSync(path.join(root,outDir),{recursive:true});fs.writeFileSync(path.join(root,outDir,'audit.json'),JSON.stringify(result,null,2)+'\n');
const md=['# Repository quality and governance audit','',`Scanned **${summary.filesScanned}** text files and extracted **${summary.decisions}** normative decisions.`,`Findings: **${summary.findings}** (${summary.bySeverity.high} high, ${summary.bySeverity.medium} medium, ${summary.bySeverity.low} low).`,'','## Findings',''];
for(const f of findings.slice(0,200))md.push(`- **${f.severity.toUpperCase()} · ${f.category} · ${f.rule}** — ${f.path||'repository'}${f.line?`:${f.line}`:''} — ${f.message}`);
fs.writeFileSync(path.join(root,outDir,'REPORT.md'),md.join('\n')+'\n');
console.log(JSON.stringify(summary));
if(arg('--fail-high','false')==='true'&&summary.bySeverity.high>0)process.exitCode=2;
