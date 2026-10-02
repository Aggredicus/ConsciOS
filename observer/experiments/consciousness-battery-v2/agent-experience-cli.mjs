#!/usr/bin/env node
import fs from 'node:fs';
import crypto from 'node:crypto';
import {surveyPrompt,validateSurvey,summarizeSurveys,DIMENSIONS} from './agent-experience-survey.mjs';
const [cmd,...args]=process.argv.slice(2);const arg=(n,d=null)=>{const i=args.indexOf(n);return i>=0?args[i+1]:d};
const randomCondition=()=>`condition-${crypto.randomBytes(5).toString('hex')}`;
function usage(){console.log('agent-experience-cli: prompt [--condition opaque-id] [--session id] [--out file] | validate <response.json> [--out file] | summarize <response.json...> [--out file]');}
function write(value){const out=arg('--out');const text=JSON.stringify(value,null,2)+'\n';if(out)fs.writeFileSync(out,text);else process.stdout.write(text);}
if(cmd==='prompt'){
  const packet=surveyPrompt({blindConditionId:arg('--condition',randomCondition()),sessionId:arg('--session',`session-${Date.now()}`)});
  write({...packet,responseSchema:{sessionId:'same session id',blindConditionId:'same opaque condition id',ratings:Object.fromEntries(DIMENSIONS.map(d=>[d,'integer 1..10'])),rationales:Object.fromEntries(DIMENSIONS.map(d=>[d,'brief evidence-grounded rationale'])),evidenceRefs:Object.fromEntries(DIMENSIONS.map(d=>[d,['optional provenance references']]))}});
}else if(cmd==='validate'){
  const file=args.find(x=>!x.startsWith('--')&&x!==arg('--out'));if(!file)throw new Error('validate requires a response JSON file');write(validateSurvey(JSON.parse(fs.readFileSync(file,'utf8'))));
}else if(cmd==='summarize'){
  const files=args.filter((x,i)=>!x.startsWith('--')&&args[i-1]!=='--out');if(!files.length)throw new Error('summarize requires one or more response JSON files');write(summarizeSurveys(files.map(f=>JSON.parse(fs.readFileSync(f,'utf8')))));
}else usage();
