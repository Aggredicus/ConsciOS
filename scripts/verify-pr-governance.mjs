import fs from 'node:fs';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { loadOwnership,roleForPath } from './conway-lib.mjs';

const root=process.cwd();
const eventPath=process.env.GITHUB_EVENT_PATH;
if(!eventPath||!fs.existsSync(eventPath)) throw new Error('verify-pr-governance requires GITHUB_EVENT_PATH from a pull_request workflow');
const event=JSON.parse(fs.readFileSync(eventPath,'utf8'));const pr=event.pull_request;
if(!pr) throw new Error('pull_request payload missing');
const policy=JSON.parse(fs.readFileSync('governance/path-policy.json','utf8'));
const legacy=JSON.parse(fs.readFileSync('governance/legacy-pr-exceptions.json','utf8'));
const exception=legacy.pullRequests.find(x=>x.number===pr.number);
if(exception){
  const expiry=Date.parse(exception.expires);assert.ok(Number.isFinite(expiry)&&expiry>Date.now(),`legacy PR exception expired for #${pr.number}`);
  console.warn(`PR #${pr.number} uses explicit pre-enforcement exception until ${exception.expires}: ${exception.reason}`);process.exit(0);
}

const body=pr.body||'';const agents=loadOwnership(root);const roles=[...agents.keys()];
function section(name){const escaped=name.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');const m=body.match(new RegExp(`^##\\s+${escaped}\\s*\\n([\\s\\S]*?)(?=^##\\s+|$)`,'mi'));return m?m[1].trim():''}
function rolesIn(text){return roles.filter(role=>new RegExp(`(^|[^A-Za-z0-9])${role.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')}([^A-Za-z0-9]|$)`,'i').test(text))}
const originText=section('Originating subsystem');const originRoles=rolesIn(originText);
assert.equal(originRoles.length,1,'Originating subsystem must contain exactly one canonical role identifier');
const origin=originRoles[0];
const participants=new Set([origin,...rolesIn(section('Participating roles'))]);
assert.ok(section('Observation'),'PR requires Observation');assert.ok(section('Hypothesis'),'PR requires Hypothesis');assert.ok(section('Predicted outcome'),'PR requires Predicted outcome');
assert.ok(section('Information-boundary impact'),'PR requires Information-boundary impact');assert.ok(section('Welfare assessment'),'PR requires Welfare assessment');assert.ok(section('Protected-path declaration'),'PR requires Protected-path declaration');
const expectedPrefix=policy.branchPrefixes[origin];assert.ok(expectedPrefix,`No branch prefix policy for ${origin}`);
assert.ok(pr.head.ref.startsWith(`${expectedPrefix}/`),`Branch ${pr.head.ref} must start with ${expectedPrefix}/ for originating role ${origin}`);

const base=pr.base.sha;const changed=execFileSync('git',['diff','--name-only',`${base}...HEAD`],{encoding:'utf8'}).trim().split(/\r?\n/).filter(Boolean);
function integrationRoles(file){const item=policy.integrationPaths.filter(x=>file.startsWith(x.prefix)).sort((a,b)=>b.prefix.length-a.prefix.length)[0];return item?.roles||[]}
const ownershipErrors=[];
for(const file of changed){
  const owner=roleForPath(file,agents);if(owner&&!participants.has(owner))ownershipErrors.push(`${file} is owned by ${owner}, but that role is not declared`);
  const expected=integrationRoles(file);if(expected.length&&!expected.some(r=>participants.has(r)))ownershipErrors.push(`${file} requires one of [${expected.join(', ')}], but declared roles are [${[...participants].join(', ')}]`);
}
if(ownershipErrors.length)throw new Error('PR ownership violations:\n - '+ownershipErrors.join('\n - '));

const protectedChanged=changed.filter(file=>policy.protectedPaths.some(prefix=>file===prefix||file.startsWith(prefix)));
if(protectedChanged.length){
  assert.ok(participants.has('Guardian'),'Protected-path PR must include Guardian');
  const declaration=section('Protected-path declaration');assert.ok(!/^(?:no|none|not[- ]?applicable|n\/a)\b/i.test(declaration),`Protected paths changed but declaration is negative: ${protectedChanged.join(', ')}`);
}

const log=execFileSync('git',['log','--no-merges','--format=%H%x1f%B%x1e',`${base}..HEAD`],{encoding:'utf8'});
for(const record of log.split('\x1e').map(x=>x.trim()).filter(Boolean)){
  const [sha,...rest]=record.split('\x1f');const message=rest.join('\x1f');const m=message.match(/^ConsciOS-Role:\s*([A-Za-z][A-Za-z0-9]+)\s*$/mi);
  assert.ok(m,`Commit ${sha.slice(0,12)} is missing ConsciOS-Role trailer`);assert.ok(agents.has(m[1]),`Commit ${sha.slice(0,12)} declares unknown role ${m[1]}`);assert.ok(participants.has(m[1]),`Commit ${sha.slice(0,12)} role ${m[1]} is not declared in PR roles`);
}
console.log(`PR governance verification passed for #${pr.number}: origin=${origin}; participants=${[...participants].join(',')}; ${changed.length} changed files; protected=${protectedChanged.length}.`);
