import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import { runModularV0 } from '../../../runtime/v0-modular.mjs';
import { runSelfPredictionLabV1 } from '../../self-prediction/v1.mjs';

const live=runModularV0();
const liveBefore=structuredClone(live);
const lab=runSelfPredictionLabV1();

assert.equal(lab.owner,'ObserverScientist');
assert.equal(lab.causalAuthority,'none');
assert.match(lab.preRegistration,/before any shadow policy runtime is executed/);
assert.equal(lab.metrics.trialCount,3);
assert.equal(lab.metrics.exactTrialAccuracy,1);
assert.equal(lab.metrics.meanExactFieldAccuracy,1);
assert.equal(lab.metrics.meanMetaAbsoluteError,0);

const raw=lab.trials.find(trial=>trial.policy==='raw-top-k');
const hard=lab.trials.find(trial=>trial.policy==='hard-source-diversity');
const soft=lab.trials.find(trial=>trial.policy==='soft-diversity');
assert.deepEqual(raw.prediction.predicted.selectedRootObservationIds,['obs-user','obs-user']);
assert.equal(raw.prediction.predicted.world.runtimeChangeObserved,false);
assert.equal(raw.prediction.predicted.expressionFeatures.mentionsRuntimeMemory,false);
assert.equal(raw.prediction.predicted.metaConfidence,.94);
for(const trial of [hard,soft]){
  assert.deepEqual(trial.prediction.predicted.selectedRootObservationIds,['obs-user','obs-runtime']);
  assert.equal(trial.prediction.predicted.world.runtimeChangeObserved,true);
  assert.equal(trial.prediction.predicted.expressionFeatures.mentionsRuntimeMemory,true);
  assert.equal(trial.prediction.predicted.metaConfidence,.93);
  assert.equal(trial.evaluation.allExact,true);
}

assert.deepEqual(live,liveBefore,'self-prediction laboratory mutated the accepted runtime state');
assert.equal(live.expression.content,liveBefore.expression.content);

const predictorSource=readFileSync('cognition/self-model/self-prediction.mjs','utf8');
assert.ok(!predictorSource.includes('workspace/policies.mjs'),'Self-Model predictor imports the actual Workspace policy implementation');
assert.ok(!predictorSource.includes('shadow-workspace-runtime'),'Self-Model predictor imports the Observer executor');
const labSource=readFileSync('observer/self-prediction/v1.mjs','utf8');
assert.ok(labSource.indexOf('const predictions=')<labSource.indexOf('const observations='),'predictions must be pre-registered before shadow executions');

console.log('ConsciOS v1.3 self-prediction verification passed: 3/3 exact architecture-perturbation predictions with zero accepted-phenotype mutation.');
