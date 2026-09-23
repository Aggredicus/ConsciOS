import assert from 'node:assert/strict';
import {runConversationArchitectureTrace,causalAncestry} from '../../../local/architecture-trace.mjs';

const trace=runConversationArchitectureTrace({content:'Neutral engineering observation about a garden.',cycle:7});
assert.equal(trace.observationId,'obs-local-conversation-7');
assert.ok(trace.events.length>0,'trace must contain real scheduler events');
assert.equal(trace.transitions[0].stage,'sensorium');
assert.equal(trace.transitions.at(-1).stage,'executive','local neural trace must stop at Executive');
assert.ok(trace.transitions.some(step=>step.stage==='global-workspace'),'trace must include workspace competition');
assert.ok(trace.transitions.some(step=>step.stage==='guardian'),'trace must include Guardian evaluation');
assert.ok(!trace.transitions.some(step=>step.stage==='expression'),'neural conversation trace must not impersonate Expression');
assert.ok(trace.events.every(event=>Array.isArray(event.causalParents)),'every CognitiveEvent must retain causal-parent structure');
assert.ok(trace.events.some(event=>event.type==='workspace.broadcast'),'trace must contain actual GlobalWorkspace broadcast event');
const lastEvent=trace.events.at(-1);
const ancestry=causalAncestry(trace.events,lastEvent.id);
assert.equal(ancestry[0].id,lastEvent.id);
assert.ok(ancestry.length>1,'terminal event must expose causal ancestry');
assert.ok(ancestry.some(item=>item.source==='Sensorium'),'causal ancestry must reach a Sensorium event');
console.log('ConsciOS local CognitiveEvent Theater verification passed: real scheduler transitions, Guardian/Executive boundaries, causal ancestry, and no Expression impersonation.');
