import assert from 'node:assert/strict';
import { runCorticalEcologyBaselineFixtures } from './fixtures/baseline-fixtures.mjs';
import { buildBaselineMeasurement, MEASUREMENT_SCHEMA_VERSION } from './metrics.mjs';

const firstFixtures=runCorticalEcologyBaselineFixtures();
const acceptedBefore=structuredClone(firstFixtures.acceptedState);
const first=buildBaselineMeasurement(firstFixtures);

assert.equal(first.schemaVersion,MEASUREMENT_SCHEMA_VERSION);
assert.equal(first.epistemicStatus,'measurement');
assert.equal(first.causalAuthority,'none');
assert.deepEqual(firstFixtures.acceptedState,acceptedBefore,'Observer measurement mutated accepted state');
assert.deepEqual(firstFixtures.liveFinal,firstFixtures.acceptedState,'stage-wise raw-policy scheduler must preserve accepted deterministic output');

assert.equal(first.accepted.trace.duplicateIds.length,0,'accepted trace contains duplicate event IDs');
assert.equal(first.accepted.trace.brokenCausalParents.length,0,'accepted trace contains broken causal ancestry');
assert.equal(first.accepted.trace.provenanceMissing.length,0,'accepted trace is missing base provenance fields');
assert.equal(first.accepted.suppressedLeakage.leaks.length,0,'suppressed candidate leaked into downstream accepted trace');
assert.equal(first.accepted.actionPath.complete,true,'accepted action path must contain Guardian -> Executive -> Expression ancestry');

const {cycle1,cycle2,cycle3Recurrent,cycle3Stateless}=firstFixtures.recurrentLab.cycles;
assert.deepEqual(cycle2.inputObservations,cycle3Recurrent.inputObservations,'repeated-history fixture must preserve identical cycle input');
assert.deepEqual(cycle3Recurrent.inputObservations,cycle3Stateless.inputObservations,'recurrent/stateless comparison must preserve identical current input');
assert.equal(first.recurrence.repeatedHistory.exactRepeat,true,'repeated fixture was not detected as an exact repeat');
assert.equal(first.recurrence.matchedRecurrentVsStateless.sameInput,true);
assert.equal(first.recurrence.matchedRecurrentVsStateless.recurrentPriorStateUsed,true);
assert.equal(first.recurrence.matchedRecurrentVsStateless.statelessPriorStateUsed,false);
assert.equal(first.recurrence.matchedRecurrentVsStateless.winnerDiverged,true,'matched recurrent/stateless fixture should retain its preregistered causal divergence');
assert.equal(first.recurrence.matchedRecurrentVsStateless.expressionDiverged,true,'matched recurrent/stateless expression should reflect the causal divergence');
assert.ok(first.recurrence.recurrentState.serializedBytes.value<2048,'recurrent state exceeded existing experiment bound');

for(const trace of first.recurrence.traces){
  assert.equal(trace.duplicateIds.length,0,'recurrent trace contains duplicate IDs');
  assert.equal(trace.brokenCausalParents.length,0,'recurrent trace contains broken causal ancestry');
  assert.equal(trace.provenanceMissing.length,0,'recurrent trace is missing base provenance fields');
}

assert.equal(first.providerTelemetry.inferenceCalls.status,'measured');
assert.equal(first.providerTelemetry.inferenceCalls.value,0);
assert.equal(first.providerTelemetry.remoteEscalations.value,0);
for(const field of ['providerIdentity','modelRevision','backendIdentity','timeToFirstTokenMs','generationTokensPerSecond','modelLoadBytes','modelLoadTimeMs','peakMemoryBytes','thermalState','batteryState']){
  assert.equal(first.providerTelemetry[field].status,'unavailable',`${field} must remain explicitly unavailable in deterministic fixtures`);
  assert.equal(first.providerTelemetry[field].value,null);
}
for(const input of first.recurrence.cycleInputs){
  assert.ok(input.utf8Bytes.value>0);
  assert.equal(input.tokenCount.status,'unavailable','bytes must not be relabeled as token counts');
  assert.equal(input.providerCache.status,'unavailable','serialized repetition must not be relabeled as a provider cache measurement');
}
assert.equal(first.recurrence.repeatedHistory.cacheHit.status,'unavailable');
assert.equal(first.recurrence.repeatedHistory.workingSet.status,'unavailable');
assert.equal(first.envelopeCount.value,0,'current runtime should have no CognitiveEnvelopeV1 messages before CEP-2');

const secondFixtures=runCorticalEcologyBaselineFixtures();
const second=buildBaselineMeasurement(secondFixtures);
assert.deepEqual(second,first,'deterministic baseline measurement must structurally replay exactly');
assert.deepEqual(secondFixtures.acceptedState,firstFixtures.acceptedState,'accepted deterministic fixture changed between measurement runs');
assert.deepEqual(secondFixtures.recurrentLab,firstFixtures.recurrentLab,'recurrent deterministic fixture changed between measurement runs');

assert.equal(cycle1.priorStateUsed,false);
assert.equal(cycle2.priorStateUsed,true);
assert.equal(cycle3Recurrent.priorStateUsed,true);
assert.equal(cycle3Stateless.priorStateUsed,false);

console.log('Cortical Ecology Gate 1 verification passed: trace-derived measurement replayed deterministically without changing accepted cognition; unavailable provider/platform telemetry remained explicit.');
