import fs from 'node:fs';
import assert from 'node:assert/strict';
import { Worker } from 'node:worker_threads';
import { runModularV0 } from '../../../runtime/v0-modular.mjs';
import { compileRuntimePhenotype } from '../../../runtime/ecology/phenotype-compiler.mjs';
import { shadowEnvelopeFromEvent } from '../../../runtime/ecology/cognitive-envelope-v1.mjs';
import {
  CORTICAL_WORKER_URLS,
  callCorticalWorker,
  runCorticalWorkerLaboratoryV1
} from '../../../runtime/ecology/worker-laboratory-v1.mjs';

const programPath=new URL('../../../phenotype/cortical-ecology-program.v1.json',import.meta.url);
const loadProgram=()=>JSON.parse(fs.readFileSync(programPath,'utf8'));
const nodeWorkerFactory=url=>new Worker(url);
const clone=value=>structuredClone(value);

const baseline=runModularV0();
const program=loadProgram();
const first=await runCorticalWorkerLaboratoryV1({program,workerFactory:nodeWorkerFactory});
const second=await runCorticalWorkerLaboratoryV1({program:loadProgram(),workerFactory:nodeWorkerFactory});

assert.equal(first.causalAuthority,'none');
assert.equal(first.networkCapability,false);
assert.equal(first.workerConfigurations.length,4);
assert.deepEqual(first.workerConfigurations.map(item=>item.role),['Sensorium','GlobalWorkspace','WorldModel','SelfModel']);
assert.ok(first.workerConfigurations.every(item=>item.networkCapability===false));
assert.deepEqual(second,first,'isolated worker trace must replay exactly for exact deterministic input');

assert.deepEqual(first.events,baseline.events.slice(0,14),'isolated Sensorium/Workspace/World/Self path must preserve the accepted v0 prefix exactly');
assert.deepEqual(first.observations,baseline.events.slice(0,4));
assert.deepEqual(first.candidates,baseline.candidates);
assert.deepEqual(first.workspace,baseline.workspace);
assert.deepEqual(first.suppressedIds,baseline.suppressed.map(candidate=>candidate.id));
assert.deepEqual(first.world,baseline.world);
assert.deepEqual(first.self,baseline.self);
assert.deepEqual(first.modelInputEnvelopeIds,baseline.workspace.map(event=>event.id),'model workers must receive admitted Workspace broadcasts only');

const secretCandidate={
  id:'cand-NoveltyProcessor-secret-local',
  timestamp:10,
  source:'NoveltyProcessor',
  target:'GlobalWorkspace',
  type:'candidate.novelty',
  content:'SECRET_LOCAL_SENTINEL must remain inaccessible outside Workspace.',
  confidence:1,
  novelty:.01,
  goalRelevance:.01,
  predictionError:.01,
  urgency:.01,
  salience:.001,
  causalParents:['obs-style'],
  epistemicStatus:'inference',
  globallyAvailable:false,
  metadata:{fixture:'suppressed-boundary-adversary'}
};
const isolated=await runCorticalWorkerLaboratoryV1({program:loadProgram(),workerFactory:nodeWorkerFactory,extraCandidates:[secretCandidate]});
assert.ok(isolated.suppressedIds.includes(secretCandidate.id),'adversarial secret candidate must be suppressed');
assert.deepEqual(isolated.workspace,baseline.workspace,'suppressed adversary must not alter Workspace winners');
assert.deepEqual(isolated.world,baseline.world,'suppressed adversary must not alter WorldModel');
assert.deepEqual(isolated.self,baseline.self,'suppressed adversary must not alter SelfModel');
const downstream=JSON.stringify({world:isolated.world,self:isolated.self,modelInputEnvelopeIds:isolated.modelInputEnvelopeIds,envelopes:isolated.envelopeTrace.slice(-2)});
assert.equal(downstream.includes(secretCandidate.id),false,'suppressed candidate ID leaked into model-worker downstream state');
assert.equal(downstream.includes(secretCandidate.content),false,'suppressed candidate content leaked into model-worker downstream state');

const compiled=await compileRuntimePhenotype(loadProgram());
const baselineCandidate=baseline.candidates[0];
const validCandidateEnvelope=shadowEnvelopeFromEvent(baselineCandidate,{program:compiled.program,phenotype:compiled.phenotype,payload:baselineCandidate});
const forgedEnvelope=clone(validCandidateEnvelope);
forgedEnvelope.phenotypeHash='0'.repeat(64);
const workspaceWorker=nodeWorkerFactory(CORTICAL_WORKER_URLS.workspace);
try{
  await callCorticalWorker(workspaceWorker,{kind:'configure',program:compiled.program,phenotypeHash:compiled.phenotype.phenotypeHash});
  await assert.rejects(
    callCorticalWorker(workspaceWorker,{kind:'compete-v0',envelopes:[forgedEnvelope],knownParentIds:baselineCandidate.causalParents,initialTick:10,capacity:2}),
    /phenotype hash mismatch/,
    'Workspace boundary must reject a forged phenotype identity'
  );
}finally{await workspaceWorker.terminate();}

const validWorkspaceEnvelope=shadowEnvelopeFromEvent(baseline.workspace[0],{program:compiled.program,phenotype:compiled.phenotype,payload:baseline.workspace[0]});
const worldWorker=nodeWorkerFactory(CORTICAL_WORKER_URLS.world);
try{
  await callCorticalWorker(worldWorker,{kind:'configure',program:compiled.program,phenotypeHash:compiled.phenotype.phenotypeHash});
  await assert.rejects(
    callCorticalWorker(worldWorker,{
      kind:'model-v0',
      envelopes:[validWorkspaceEnvelope],
      knownParentIds:baseline.workspace[0].causalParents,
      suppressedIds:[secretCandidate.id],
      initialTick:12
    }),
    /refuses undeclared context suppressedIds/,
    'WorldModel must reject host attempts to expose suppressed context'
  );
}finally{await worldWorker.terminate();}

const sensoriumWorker=nodeWorkerFactory(CORTICAL_WORKER_URLS.sensorium);
try{
  await assert.rejects(
    callCorticalWorker(sensoriumWorker,{kind:'configure',program:compiled.program,phenotypeHash:'f'.repeat(64)}),
    /configuration phenotype hash mismatch/,
    'worker must reject configuration for the wrong compiled phenotype'
  );
}finally{await sensoriumWorker.terminate();}

const workerSources={
  Sensorium:fs.readFileSync(CORTICAL_WORKER_URLS.sensorium,'utf8'),
  GlobalWorkspace:fs.readFileSync(CORTICAL_WORKER_URLS.workspace,'utf8'),
  WorldModel:fs.readFileSync(CORTICAL_WORKER_URLS.world,'utf8'),
  SelfModel:fs.readFileSync(CORTICAL_WORKER_URLS.self,'utf8')
};
assert.match(workerSources.Sensorium,/cognition\/sensorium\/v0\.mjs/);
assert.doesNotMatch(workerSources.Sensorium,/cognition\/(workspace|world-model|self-model|guardian|executive|memory|counterfactual|metacognition|homeostasis|expression)\//);
assert.match(workerSources.GlobalWorkspace,/cognition\/workspace\/v0-runtime\.mjs/);
assert.doesNotMatch(workerSources.GlobalWorkspace,/cognition\/(sensorium|world-model|self-model|guardian|executive|memory|counterfactual|metacognition|homeostasis|expression)\//);
assert.match(workerSources.WorldModel,/cognition\/world-model\/v0\.mjs/);
assert.doesNotMatch(workerSources.WorldModel,/cognition\/(sensorium|workspace|self-model|guardian|executive|memory|counterfactual|metacognition|homeostasis|expression)\//);
assert.match(workerSources.SelfModel,/cognition\/self-model\/v0\.mjs/);
assert.doesNotMatch(workerSources.SelfModel,/cognition\/(sensorium|workspace|world-model|guardian|executive|memory|counterfactual|metacognition|homeostasis|expression)\//);
for(const [role,source] of Object.entries(workerSources)){
  assert.doesNotMatch(source,/SharedArrayBuffer/,`${role} worker must not use SharedArrayBuffer`);
  assert.doesNotMatch(source,/\bfetch\s*\(/,`${role} worker must not initiate fetch`);
  assert.doesNotMatch(source,/\bWebSocket\b/,`${role} worker must not open WebSockets`);
}

const result={
  phenotypeHash:first.phenotypeHash,
  workers:first.workerConfigurations.map(item=>item.role),
  deterministicEvents:first.events.length,
  envelopes:first.envelopeTrace.length,
  suppressedBaseline:first.suppressedIds.length,
  adversarialSecretSuppressed:isolated.suppressedIds.includes(secretCandidate.id),
  modelInputEnvelopeIds:first.modelInputEnvelopeIds,
  parityWithAcceptedPrefix:true,
  networkCapability:false,
  causalAuthority:first.causalAuthority
};
console.log(JSON.stringify(result,null,2));
console.log('Cortical Ecology CEP-3 verification passed: isolated workers preserved deterministic v0 parity, rejected forged/undeclared inputs, and prevented suppressed information from reaching World/Self model realms.');
