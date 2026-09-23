import assert from 'node:assert/strict';
import { runModularV0 } from '../../../runtime/v0-modular.mjs';

const expectedExpression='A new human instruction is the most goal-relevant information currently available. My confidence in this summary is 0.940. This output reports the deterministic functional state of ConsciOS v0 and is not evidence of subjective experience.';

const a=runModularV0();
const b=runModularV0();
assert.deepEqual(a,b,'modular v0 must replay identically');

const observations=a.events.filter(e=>e.epistemicStatus==='observation');
assert.equal(a.version,'0.6.0');
assert.equal(observations.length,4);
assert.equal(a.candidates.length,6);
assert.equal(a.workspace.length,2);
assert.deepEqual(a.workspace.map(e=>e.causalParents[0]),['cand-NoveltyProcessor-obs-user','cand-RelevanceProcessor-obs-user']);
assert.equal(a.world.activeHumanInstruction,true);
assert.equal(a.world.runtimeChangeObserved,false);
assert.equal(a.self.hasExternalLLM,false);
assert.equal(a.counterfactual.candidates.length,2);
assert.equal(a.counterfactual.recommendedCandidateId,'cf-neutral-summary');
assert.deepEqual(a.counterfactual.candidates.map(c=>c.action.kind),['no-op','neutral-summary']);
assert.equal(a.meta.confidence,.94);
assert.equal(a.homeostasis.status,'stable');
assert.equal(a.homeostasis.vocabulary,'operational-only');
assert.equal(a.guardian.decision,'allow');
assert.equal(a.guardian.actionId,'action-neutral-summary');
assert.equal(a.executive.status,'selected');
assert.equal(a.executive.selectedCandidateId,'cf-neutral-summary');
assert.equal(a.executive.action.kind,'neutral-summary');
assert.equal(a.expression.content,expectedExpression);
assert.deepEqual(a.expression.causalParents,['executive-selection',...a.workspace.map(w=>w.id)]);
assert.ok(!a.expression.causalParents.some(id=>a.suppressed.some(s=>s.id===id)),'Expression must not depend directly on suppressed candidates');
assert.equal(a.traceRoot,'expression-1');
assert.equal(a.memory.length,a.events.length,'every committed event should have one episodic record');

console.log(JSON.stringify({
  version:a.version,counterfactual:a.counterfactual.recommendedCandidateId,metaConfidence:a.meta.confidence,
  homeostasis:a.homeostasis.status,guardian:a.guardian.decision,executive:a.executive.selectedCandidateId,
  expression:a.expression.content,eventCount:a.events.length,memoryCount:a.memory.length
},null,2));
console.log('ConsciOS v0.6 modular causal-loop verification passed.');
