import assert from 'node:assert/strict';
import { runModularV0 } from '../../../runtime/v0-modular.mjs';
import { guardianGateV0 } from '../../../cognition/guardian/v0.mjs';
import { executiveSelectV0 } from '../../../cognition/executive/v0.mjs';

const state=runModularV0();
const byId=id=>state.events.find(e=>e.id===id);
for(const id of ['counterfactual-set','meta-assessment','homeostasis-assessment','guardian-decision','executive-selection','expression-1'])assert.ok(byId(id),`missing causal stage ${id}`);
assert.ok(byId('counterfactual-set').timestamp<byId('meta-assessment').timestamp);
assert.ok(byId('meta-assessment').timestamp<byId('homeostasis-assessment').timestamp);
assert.ok(byId('homeostasis-assessment').timestamp<byId('guardian-decision').timestamp);
assert.ok(byId('guardian-decision').timestamp<byId('executive-selection').timestamp);
assert.ok(byId('executive-selection').timestamp<byId('expression-1').timestamp);
assert.ok(byId('meta-assessment').causalParents.includes('counterfactual-set'));
assert.deepEqual(byId('homeostasis-assessment').causalParents,['meta-assessment']);
assert.ok(byId('guardian-decision').causalParents.includes('homeostasis-assessment'));
assert.ok(byId('executive-selection').causalParents.includes('guardian-decision'));
assert.equal(byId('expression-1').causalParents[0],'executive-selection');
assert.ok(!/(pain|fear|punish|agony|terror|starv)/i.test(JSON.stringify(state.homeostasis)),'Homeostasis contains suffering-oriented vocabulary');

let tick=0;const log=[];
const makeEvent=partial=>({...partial,timestamp:++tick,causalParents:[...(partial.causalParents??[])]});
const pushEvent=event=>(log.push(event),event);
const risky={id:'cf-risky',action:{id:'action-risky',kind:'neutral-summary'},reversibility:.5,continuityRisk:.6,distressAnalogueRisk:0,utility:.9,confidence:.8};
const counterfactual={status:'shadow-simulation-only',candidates:[risky],recommendedCandidateId:'cf-risky',evidence:[]};
const counterfactualEvent={id:'cf-test'};const metaEvent={id:'meta-test'};const homeostasisEvent={id:'homeo-test'};
const guard=guardianGateV0({metaEvent,homeostasisEvent,counterfactualEvent,proposedCandidate:risky,homeostasis:{status:'stable'}},{makeEvent,pushEvent});
assert.equal(guard.guardian.decision,'human-review');
const executive=executiveSelectV0({counterfactual,counterfactualEvent,guardian:guard.guardian,guardianEvent:guard.event},{makeEvent,pushEvent});
assert.equal(executive.executive.status,'withheld');
assert.equal(executive.executive.action,null);

console.log('ConsciOS v0.6 complete-loop verification passed, including Guardian human-review / Executive-withhold path.');
