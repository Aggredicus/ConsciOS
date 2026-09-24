import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { loadOwnership,communicationAllowed } from './conway-lib.mjs';

const root=process.cwd();const agents=loadOwnership(root);
const statuses=new Set(['observation','belief','hypothesis','prediction','interface-request','counterfactual','governance','audit','result','decision']);
function isObj(v){return v&&typeof v==='object'&&!Array.isArray(v)}
function uniqueStrings(v){return Array.isArray(v)&&v.every(x=>typeof x==='string'&&x.length>0)&&new Set(v).size===v.length}
function filesUnder(dir){if(!fs.existsSync(dir))return[];return fs.readdirSync(dir,{withFileTypes:true}).flatMap(e=>e.isDirectory()?filesUnder(path.join(dir,e.name)):/\.json$/.test(e.name)?[path.join(dir,e.name)]:[])}
function read(file){return JSON.parse(fs.readFileSync(file,'utf8'))}
function validateHandoff(h,file){
  assert.ok(isObj(h),`${file}: handoff must be object`);assert.equal(h.version,1,`${file}: version`);
  assert.match(h.id,/^H-[A-Za-z0-9._-]+$/,`${file}: id`);assert.ok(agents.has(h.producer),`${file}: unknown producer`);
  assert.ok(uniqueStrings(h.consumers)&&h.consumers.length,`${file}: consumers`);for(const c of h.consumers){assert.ok(agents.has(c),`${file}: unknown consumer ${c}`);assert.ok(communicationAllowed(h.producer,c,agents)||agents.get(h.producer).observes.includes('all'),`${file}: undeclared handoff ${h.producer} -> ${c}`)}
  assert.ok(statuses.has(h.epistemicStatus),`${file}: epistemicStatus`);assert.ok(typeof h.summary==='string'&&h.summary.trim(),`${file}: summary`);
  assert.ok(uniqueStrings(h.artifactPaths),`${file}: artifactPaths`);assert.ok(uniqueStrings(h.causalParents),`${file}: causalParents`);
  assert.ok(h.confidence===null||(typeof h.confidence==='number'&&h.confidence>=0&&h.confidence<=1),`${file}: confidence`);
  assert.ok(h.sourceCommit==='example'||/^[0-9a-f]{7,40}$/.test(h.sourceCommit),`${file}: sourceCommit`);
}
function validateContext(c,file){
  assert.ok(isObj(c),`${file}: context must be object`);assert.equal(c.version,1,`${file}: version`);assert.match(c.id,/^CTX-[A-Za-z0-9._-]+$/,`${file}: id`);assert.ok(agents.has(c.role),`${file}: role`);assert.ok(typeof c.task==='string'&&c.task.trim(),`${file}: task`);
  for(const key of ['sharedArtifacts','ownedArtifacts','interfaceArtifacts','incomingArtifacts','forbiddenRoots'])assert.ok(uniqueStrings(c[key]),`${file}: ${key}`);
  assert.ok(Array.isArray(c.contextExpansions),`${file}: contextExpansions`);for(const e of c.contextExpansions)assert.ok(isObj(e)&&typeof e.artifact==='string'&&e.artifact&&typeof e.reason==='string'&&e.reason.trim(),`${file}: invalid expansion`);
  assert.ok(Array.isArray(c.files),`${file}: files`);for(const item of c.files){assert.ok(isObj(item)&&typeof item.path==='string'&&/^[0-9a-f]{64}$/.test(item.sha256)&&['shared','owned','interface','incoming','expansion'].includes(item.source),`${file}: invalid file entry`)}
}

const handoffs=[...filesUnder(path.join(root,'artifacts/handoffs')),path.join(root,'artifacts/examples/handoff.example.json')].filter(fs.existsSync);
const contexts=[...filesUnder(path.join(root,'artifacts/context-manifests')),path.join(root,'artifacts/examples/context-manifest.example.json'),...process.argv.slice(2).map(x=>path.resolve(x))].filter(fs.existsSync);
for(const file of handoffs)validateHandoff(read(file),file);
for(const file of contexts)validateContext(read(file),file);
console.log(`Development artifact verification passed: ${handoffs.length} handoff(s), ${contexts.length} context manifest(s).`);
