import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
import { loadOwnership,roleForPath } from './conway-lib.mjs';

const execute=process.argv.includes('--execute');const baseArg=process.argv.find(x=>x.startsWith('--base='));const base=baseArg?.slice(7)||process.env.BASE_SHA;
if(!base)throw new Error('Provide --base=<sha> or BASE_SHA');
const agents=loadOwnership();const routing=JSON.parse(fs.readFileSync('ci/subsystems.json','utf8'));const pathPolicy=JSON.parse(fs.readFileSync('governance/path-policy.json','utf8'));
const changed=execFileSync('git',['diff','--name-only',`${base}...HEAD`],{encoding:'utf8'}).trim().split(/\r?\n/).filter(Boolean);
const direct=new Set();
for(const file of changed){const owner=roleForPath(file,agents);if(owner)direct.add(owner);for(const item of pathPolicy.integrationPaths)if(file.startsWith(item.prefix))for(const role of item.roles)direct.add(role)}
if(!direct.size)direct.add('ObserverScientist');
const impacted=new Set(direct);impacted.add('ObserverScientist');
for(const role of [...direct]){const a=agents.get(role);for(const neighbor of a?.communicatesWith||[])impacted.add(neighbor);for(const [other,data] of agents)if(data.communicatesWith.includes(role))impacted.add(other)}
const scripts=[];for(const role of [...impacted].sort())for(const script of routing.roles[role]||[])if(!scripts.includes(script))scripts.push(script);
for(const script of scripts)if(!fs.existsSync(script))throw new Error(`CI routing references missing verifier: ${script}`);
console.log(JSON.stringify({changed,directRoles:[...direct].sort(),impactedRoles:[...impacted].sort(),scripts},null,2));
if(execute)for(const script of scripts){console.log(`\n[role-aware CI] node ${script}`);execFileSync(process.execPath,[script],{stdio:'inherit'})}
