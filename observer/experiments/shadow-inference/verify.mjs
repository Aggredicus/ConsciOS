import assert from 'node:assert/strict';
import { runModularV0 } from '../../../runtime/v0-modular.mjs';
import { createDeterministicMockModel } from '../../../runtime/models/deterministic-mock.mjs';
import { buildShadowWorldStateInput, runShadowWorldStateV0 } from '../../shadow-inference/v0.mjs';

const state=runModularV0();
const before=structuredClone(state);
const input=buildShadowWorldStateInput(state);

assert.deepEqual(input.contextManifest.map(a=>a.artifactId),state.workspace.map(e=>e.id),'shadow context must equal admitted workspace artifacts exactly');
assert.ok(input.contextManifest.every(a=>state.workspace.some(e=>e.id===a.artifactId)),'shadow context contains a non-workspace artifact');
assert.equal(input.hiddenContextPolicy,'none');

const record=await runShadowWorldStateV0(state);
assert.equal(record.owner,'ObserverScientist');
assert.equal(record.causalAuthority,'none');
assert.equal(record.status,'ok');
assert.equal(record.output.provider.kind,'deterministic-mock');
assert.equal(record.output.provider.hiddenState,'none');
assert.equal(record.comparison.status,'compared');
assert.equal(record.comparison.matched,true,'shadow world-state inference should match deterministic rule-based World Model in control fixture');
assert.deepEqual(record.output.causalSourceIds,state.workspace.map(e=>e.id));
assert.deepEqual(state,before,'shadow inference mutated the primary cognitive state');

const shadowIds=new Set([record.id,record.input.requestId]);
for(const event of state.events){
  assert.ok(!shadowIds.has(event.id),'shadow record entered primary event graph');
  assert.ok(event.causalParents.every(parent=>!shadowIds.has(parent)),'primary causal ancestry references a shadow artifact');
}
assert.ok(state.workspace.every(event=>!shadowIds.has(event.id)),'shadow artifact entered Global Workspace');
assert.ok(state.expression&&state.expression.content===before.expression.content,'shadow inference changed outward Expression');

const timeoutState=runModularV0();
const timeoutBefore=structuredClone(timeoutState);
const timeoutRecord=await runShadowWorldStateV0(timeoutState,{model:createDeterministicMockModel({mode:'timeout'})});
assert.equal(timeoutRecord.status,'timeout');
assert.equal(timeoutRecord.causalAuthority,'none');
assert.equal(timeoutRecord.comparison.status,'unavailable');
assert.deepEqual(timeoutState,timeoutBefore,'shadow timeout interrupted or mutated primary loop');

const errorState=runModularV0();
const errorBefore=structuredClone(errorState);
const errorRecord=await runShadowWorldStateV0(errorState,{model:createDeterministicMockModel({mode:'error'})});
assert.equal(errorRecord.status,'error');
assert.deepEqual(errorState,errorBefore,'shadow provider error interrupted or mutated primary loop');

console.log('ConsciOS v0.8 shadow-inference verification passed. Model inference remained Observer-owned with causalAuthority:none.');
