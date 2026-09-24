import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';
import { spawnSync, execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const repoRoot=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../../..');
const boundaryVerifier=path.join(repoRoot,'scripts/verify-conway-boundaries.mjs');
const prVerifier=path.join(repoRoot,'scripts/verify-pr-governance.mjs');

function write(root,file,content){const target=path.join(root,file);fs.mkdirSync(path.dirname(target),{recursive:true});fs.writeFileSync(target,content)}
function runNode(script,cwd,env={}){return spawnSync(process.execPath,[script],{cwd,encoding:'utf8',env:{...process.env,...env}})}

const fullOwnership=(selfPartners='GlobalWorkspace, Memory, Counterfactual, Metacognition')=>`version: 2
agents:
  Sensorium: {owns: [cognition/sensorium/**], communicates_with: [GlobalWorkspace]}
  GlobalWorkspace: {owns: [cognition/workspace/**], communicates_with: [Sensorium, WorldModel, SelfModel, Memory]}
  WorldModel: {owns: [cognition/world-model/**], communicates_with: [GlobalWorkspace, Memory, Counterfactual, Metacognition]}
  SelfModel: {owns: [cognition/self-model/**], communicates_with: [${selfPartners}]}
  Memory: {owns: [cognition/memory/**], communicates_with: [GlobalWorkspace, WorldModel, SelfModel, Metacognition]}
  Counterfactual: {owns: [cognition/counterfactual/**], communicates_with: [WorldModel, SelfModel, Metacognition, Executive]}
  Metacognition: {owns: [cognition/metacognition/**], communicates_with: [WorldModel, SelfModel, Memory, Counterfactual, Homeostasis]}
  Homeostasis: {owns: [cognition/homeostasis/**], communicates_with: [Metacognition, Guardian]}
  Guardian: {owns: [cognition/guardian/**], communicates_with: [Homeostasis, Executive, ObserverScientist, WelfareAuditor]}
  Executive: {owns: [cognition/executive/**], communicates_with: [Counterfactual, Guardian, Expression]}
  Expression: {owns: [cognition/expression/**], communicates_with: [Executive, GlobalWorkspace]}
  ObserverScientist: {owns: [observer/**], communicates_with: [Sensorium, GlobalWorkspace, Guardian, ScientificAuditor, WelfareAuditor], observes: [all]}
  ScientificAuditor: {owns: [audits/scientific/**], communicates_with: [ObserverScientist, Guardian], observes: [all]}
  WelfareAuditor: {owns: [audits/welfare/**], communicates_with: [ObserverScientist, Guardian], observes: [all]}
`;

// Negative control 1: undeclared cognitive import must fail.
const boundary=fs.mkdtempSync(path.join(os.tmpdir(),'conscios-boundary-negative-'));
write(boundary,'agents/OWNERSHIP.yaml',fullOwnership());
write(boundary,'agents/BOUNDARY_EXCEPTIONS.json','{"version":1,"exceptions":[]}\n');
write(boundary,'cognition/self-model/test.mjs',"import '../guardian/test.mjs';\nexport const self=true;\n");
write(boundary,'cognition/guardian/test.mjs','export const guardian=true;\n');
let result=runNode(boundaryVerifier,boundary);
assert.notEqual(result.status,0,'undeclared SelfModel -> Guardian import unexpectedly passed');
assert.match(result.stderr+result.stdout,/undeclared role edge SelfModel -> Guardian/);

// Positive control: same dependency passes when the edge is explicitly declared.
write(boundary,'agents/OWNERSHIP.yaml',fullOwnership('GlobalWorkspace, Memory, Counterfactual, Metacognition, Guardian'));
result=runNode(boundaryVerifier,boundary);
assert.equal(result.status,0,`declared SelfModel -> Guardian edge failed: ${result.stderr}`);

// Negative control 2: expired exception is rejected even before source analysis.
write(boundary,'agents/OWNERSHIP.yaml',fullOwnership());
write(boundary,'agents/BOUNDARY_EXCEPTIONS.json',JSON.stringify({version:1,exceptions:[{source:'SelfModel',target:'Guardian',reason:'fixture',expires:'2000-01-01T00:00:00Z'}]},null,2));
result=runNode(boundaryVerifier,boundary);
assert.notEqual(result.status,0,'expired boundary exception unexpectedly passed');
assert.match(result.stderr+result.stdout,/expired boundary exception/);
fs.rmSync(boundary,{recursive:true,force:true});

// Negative control 3: PR governance rejects a commit without role provenance, then accepts an amended compliant commit.
const prRoot=fs.mkdtempSync(path.join(os.tmpdir(),'conscios-pr-negative-'));
write(prRoot,'agents/OWNERSHIP.yaml',`version: 1\nagents:\n  GlobalWorkspace: {owns: [cognition/workspace/**], communicates_with: []}\n  Guardian: {owns: [cognition/guardian/**], communicates_with: []}\n`);
write(prRoot,'governance/path-policy.json',JSON.stringify({version:1,branchPrefixes:{GlobalWorkspace:'workspace',Guardian:'guardian'},integrationPaths:[],protectedPaths:[]},null,2));
write(prRoot,'governance/legacy-pr-exceptions.json','{"version":1,"pullRequests":[]}\n');
write(prRoot,'cognition/workspace/v0.mjs','export const value=0;\n');
execFileSync('git',['init','-q'],{cwd:prRoot});execFileSync('git',['config','user.email','ci@example.invalid'],{cwd:prRoot});execFileSync('git',['config','user.name','CI Fixture'],{cwd:prRoot});execFileSync('git',['add','.'],{cwd:prRoot});execFileSync('git',['commit','-qm','fixture base'],{cwd:prRoot});
const baseSha=execFileSync('git',['rev-parse','HEAD'],{cwd:prRoot,encoding:'utf8'}).trim();execFileSync('git',['checkout','-qb','workspace/fixture'],{cwd:prRoot});
write(prRoot,'cognition/workspace/v0.mjs','export const value=1;\n');execFileSync('git',['add','.'],{cwd:prRoot});execFileSync('git',['commit','-qm','Workspace fixture without trailer'],{cwd:prRoot});
const body=`## Originating subsystem\nGlobalWorkspace\n\n## Participating roles\n\n## Observation\nfixture\n\n## Hypothesis\nfixture\n\n## Predicted outcome\nfixture\n\n## Information-boundary impact\nnone\n\n## Welfare assessment\nnot applicable\n\n## Protected-path declaration\nNo protected paths.\n`;
const event={pull_request:{number:999,body,head:{ref:'workspace/fixture'},base:{sha:baseSha}}};const eventFile=path.join(prRoot,'event.json');fs.writeFileSync(eventFile,JSON.stringify(event));
result=runNode(prVerifier,prRoot,{GITHUB_EVENT_PATH:eventFile});assert.notEqual(result.status,0,'commit without ConsciOS-Role trailer unexpectedly passed');assert.match(result.stderr+result.stdout,/missing ConsciOS-Role trailer/);
execFileSync('git',['commit','--amend','-qm','Workspace fixture\n\nConsciOS-Role: GlobalWorkspace'],{cwd:prRoot});
result=runNode(prVerifier,prRoot,{GITHUB_EVENT_PATH:eventFile});assert.equal(result.status,0,`compliant PR provenance fixture failed: ${result.stderr}`);
fs.rmSync(prRoot,{recursive:true,force:true});

console.log('Inverse Conway enforcement negative controls passed: illegal edge, expired exception, and missing commit-role provenance all fail closed.');
