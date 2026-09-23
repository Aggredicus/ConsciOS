import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runConversationArchitectureTrace} from '../../../local/architecture-trace.mjs';
import {summarizeArchitectureTrace,recurrentVsStatelessControl} from '../../../local/scientific-controls.mjs';

const trace=runConversationArchitectureTrace({content:'neutral scientific-control probe',cycle:7});
const summary=summarizeArchitectureTrace(trace);
assert.equal(summary.cycle,7);
assert.equal(summary.eventCount,trace.events.length);
assert.ok(summary.workspaceOccupancy>=0);
assert.ok(summary.meanCandidateSalience===null||Number.isFinite(summary.meanCandidateSalience));
assert.ok(summary.meanPredictionError===null||Number.isFinite(summary.meanPredictionError));
assert.ok(!Object.hasOwn(summary,'consciousnessScore'),'scientific panel must not invent a consciousness score');

const control=recurrentVsStatelessControl();
assert.equal(control.owner,'ObserverScientist');
assert.equal(control.causalAuthority,'none');
assert.equal(control.inputMatched,true,'recurrent/stateless comparison must hold current sensory input fixed');
assert.equal(control.recurrent.expectedRuntimeIncrease,.8);
assert.equal(control.stateless.expectedRuntimeIncrease,.5);
assert.equal(control.recurrent.runtimePredictionError,.2);
assert.equal(control.stateless.runtimePredictionError,.5);
assert.equal(control.recurrent.workspaceWinner,'neutral-competitor');
assert.equal(control.stateless.workspaceWinner,'runtime-probe');
assert.equal(control.recurrent.metacognitiveConfidence,.97);
assert.equal(control.stateless.metacognitiveConfidence,.88);
assert.ok(control.recurrent.recurrentAnchor,'recurrent condition must disclose its causal anchor');
assert.equal(control.stateless.recurrentAnchor,null);

const ui=readFileSync('local/local-ui.mjs','utf8');
const html=readFileSync('local/index.html','utf8');
for(const required of ['summarizeArchitectureTrace','recurrentVsStatelessControl','temporalMetrics','recurrenceControl'])assert.ok(ui.includes(required)||html.includes(required),`local lab missing scientific control ${required}`);
for(const forbidden of ['consciousnessScore','phenomenalScore','computeConsciousness'])assert.ok(!ui.includes(forbidden),`UI code contains prohibited aggregate scoring mechanism: ${forbidden}`);
assert.ok(ui.includes('not a consciousness score')||html.includes('not a consciousness score'),'UI must explicitly disclose that scientific controls are not a consciousness score');
assert.ok(html.includes('functional architecture'));
console.log('ConsciOS local scientific controls verified: temporal functional metrics and matched-input recurrent/stateless comparison, with no aggregate consciousness score.');
