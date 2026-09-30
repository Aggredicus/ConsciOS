#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
const argv=process.argv.slice(2);const arg=(n,d=null)=>{const i=argv.indexOf(n);return i>=0?argv[i+1]:d};
const input=arg('--audit','artifacts/self-model/current/governance/audit.json'),out=arg('--out','artifacts/self-model/current/governance/issue-candidates.json');
const audit=JSON.parse(fs.readFileSync(input,'utf8'));
const candidates=(audit.findings||[]).filter(f=>f.severity==='high'||(f.severity==='medium'&&['governance','security'].includes(f.category))).map(f=>({findingId:f.id,title:`[${f.severity.toUpperCase()}] ${f.rule}: ${f.message.slice(0,90)}`,labels:['self-model','governance-review',f.category],relatedNodeIds:f.relatedNodeIds||[],decisionIds:f.decisionIds||[],body:[`Finding: \`${f.id}\``,`Category: **${f.category}**`,`Severity: **${f.severity}**`,f.path?`Location: \`${f.path}${f.line?`:${f.line}`:''}\``:null,'',f.message,'',f.excerpt?`Evidence: \`${String(f.excerpt).replace(/`/g,"'")}\``:null,'',`Related graph nodes: ${(f.relatedNodeIds||[]).map(x=>`\`${x}\``).join(', ')||'none'}`,`Related decisions: ${(f.decisionIds||[]).map(x=>`\`${x}\``).join(', ')||'none'}`,'','This is an audit-generated issue candidate, not an automatic policy verdict. Human/Guardian review is required before protected or ambiguous changes.'].filter(Boolean).join('\n')}));
fs.mkdirSync(path.dirname(out),{recursive:true});fs.writeFileSync(out,JSON.stringify({version:1,generatedAt:new Date().toISOString(),count:candidates.length,candidates},null,2)+'\n');console.log(JSON.stringify({out,count:candidates.length}));
