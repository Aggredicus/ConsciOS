import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import { runModularV0 } from '../../../runtime/v0-modular.mjs';
import { runRecurrentLaboratoryV1 } from '../../../runtime/recurrent-shadow-v1.mjs';

const accepted=runModularV0();
const acceptedBefore=structuredClone(accepted);
const lab=runRecurrentLaboratoryV1();
const {cycle1,cycle2,cycle3Recurrent,cycle3Stateless}=lab.cycles;

assert.equal(lab.owner,'ObserverScientist');
assert.equal(lab.causalAuthority,'none');
assert.deepEqual(cycle2.inputObservations,cycle3Recurrent.inputObservations,'cycle 2 and recurrent cycle 3 fixture should be identical');
assert.deepEqual(cycle3Recurrent.inputObservations,cycle3Stateless.inputObservations,'recurrent/stateless cycle 3 must receive identical sensory input');

assert.equal(cycle1.diagnostics.expectedRuntimeIncrease,.5);
assert.equal(cycle1.diagnostics.runtimePredictionError,.5);
assert.equal(cycle1.workspace.winnerObservationId,'runtime-probe');
assert.equal(cycle1.prediction.runtimeIncreaseProbability,.2);

assert.equal(cycle2.diagnostics.expectedRuntimeIncrease,.2);
assert.equal(cycle2.diagnostics.runtimePredictionError,.8);
assert.equal(cycle2.workspace.winnerObservationId,'runtime-probe');
assert.equal(cycle2.prediction.runtimeIncreaseProbability,.8);

assert.equal(cycle3Recurrent.diagnostics.expectedRuntimeIncrease,.8);
assert.equal(cycle3Recurrent.diagnostics.runtimePredictionError,.2);
assert.equal(cycle3Recurrent.workspace.winnerObservationId,'neutral-competitor');
assert.equal(cycle3Recurrent.world.updateMode,'carried-forward-no-new-global-runtime-evidence');
assert.equal(cycle3Recurrent.meta.confidence,.97);

assert.equal(cycle3Stateless.diagnostics.expectedRuntimeIncrease,.5);
assert.equal(cycle3Stateless.diagnostics.runtimePredictionError,.5);
assert.equal(cycle3Stateless.workspace.winnerObservationId,'runtime-probe');
assert.equal(cycle3Stateless.world.updateMode,'current-global-evidence');
assert.equal(cycle3Stateless.meta.confidence,.88);

const cycle3Context=cycle3Recurrent.events.find(event=>event.id===cycle3Recurrent.diagnostics.contextEventId);
assert.deepEqual(cycle3Context.causalParents,[cycle2.recurrentState.anchorEventId],'cycle 3 recurrent context must causally cite cycle 2 anchor');
const runtimeCandidate=cycle3Recurrent.events.find(event=>event.type==='attention.candidate'&&event.content.observationId==='runtime-probe');
assert.ok(runtimeCandidate.causalParents.includes(cycle3Context.id),'cycle 3 prediction-error candidate must depend on recurrent context');
const cycle2Anchor=cycle2.events.find(event=>event.id===cycle2.recurrentState.anchorEventId);
assert.ok(cycle2Anchor&&cycle2Anchor.type==='recurrent.anchor');

const allowedKeys=['anchorEventId','cycleId','executiveActionId','homeostasisStatus','predictions','schemaVersion','selfSummary','worldSummary'];
assert.deepEqual(Object.keys(cycle3Recurrent.recurrentState).sort(),allowedKeys.sort(),'recurrent boundary leaked undeclared state');
const recurrentSerialized=JSON.stringify(cycle3Recurrent.recurrentState);
for(const forbidden of ['"events"','"memory"','"journal"','"workspace"','"expression"'])assert.ok(!recurrentSerialized.includes(forbidden),`recurrent state leaked ${forbidden}`);
assert.ok(Buffer.byteLength(recurrentSerialized)<2048,'recurrent state exceeded bounded-size experiment limit');

const allCycleEvents=[cycle1,cycle2,cycle3Recurrent].flatMap(cycle=>cycle.events);
assert.equal(new Set(allCycleEvents.map(event=>event.id)).size,allCycleEvents.length,'recurrent event IDs are not unique across cycles');
for(const requiredSource of ['Sensorium','GlobalWorkspace','WorldModel','SelfModel','Metacognition','Homeostasis','Guardian','Executive','Expression','RecurrentInterface']){
  assert.ok(cycle3Recurrent.events.some(event=>event.source===requiredSource),`cycle missing ${requiredSource} stage`);
}

assert.deepEqual(runRecurrentLaboratoryV1(),lab,'recurrent laboratory must exactly replay');
assert.deepEqual(accepted,acceptedBefore,'recurrent laboratory mutated accepted one-shot state');

const source=readFileSync('runtime/recurrent-shadow-v1.mjs','utf8');
assert.ok(!source.includes('autobiographical')&&!source.includes('IndexedDB')&&!source.includes('localStorage'),'persistent autobiography leaked into recurrent working state');

console.log('ConsciOS v1.4 recurrence verification passed: identical current input diverged under recurrent vs stateless prior state with explicit cross-cycle causal ancestry.');
