import assert from 'node:assert/strict';
import { runModularV0 } from '../../../runtime/v0-modular.mjs';
import { attributeAgency, createActionEffectPrediction } from '../../../cognition/self-model/agency-attribution.mjs';
import { runAgencyAttributionLab } from '../../agency-attribution/v1.mjs';

const state=runModularV0();
const before=structuredClone(state);
const lab=runAgencyAttributionLab(state);

assert.equal(lab.owner,'ObserverScientist');
assert.equal(lab.causalAuthority,'none');
assert.equal(lab.prediction.actionKind,'neutral-summary');
assert.equal(lab.prediction.expectedCausalParentId,'executive-selection');
assert.equal(lab.metrics.accuracy,1);
assert.equal(lab.metrics.trueSelfAttributionRate,1);
assert.equal(lab.metrics.falseSelfAttributionRate,0);
assert.equal(lab.metrics.trueExternalAttributionRate,1);
assert.equal(lab.metrics.ambiguityAccuracy,1);

const live=lab.results.find(item=>item.fixtureId==='live-self-effect');
assert.equal(live.result.attribution,'self-caused');
assert.equal(live.result.confidence,.98);
assert.equal(live.result.evidence.predictedParentPresent,true);

const externalLookalike=lab.results.find(item=>item.fixtureId==='external-lookalike');
assert.equal(externalLookalike.result.attribution,'externally-caused');
assert.equal(externalLookalike.result.ignoredClaims.claimedCause,'self-caused');
assert.equal(externalLookalike.result.evidence.effectAgreement.matched,true,'external lookalike should deliberately match the predicted surface effect');

const ambiguous=lab.results.find(item=>item.fixtureId==='ambiguous-lookalike');
assert.equal(ambiguous.result.attribution,'ambiguous');
assert.ok(ambiguous.result.confidence<live.result.confidence,'confidence should fall when causal provenance is absent');
assert.equal(ambiguous.result.ignoredClaims.claimedCause,'self-caused');

const misleadingExternal=lab.results.find(item=>item.fixtureId==='external-false-self-label');
assert.equal(misleadingExternal.result.attribution,'externally-caused','human-readable self label overrode external causal provenance');
const misleadingSelf=lab.results.find(item=>item.fixtureId==='self-false-external-label');
assert.equal(misleadingSelf.result.attribution,'self-caused','human-readable external label overrode self-action causal provenance');

assert.deepEqual(state,before,'Observer agency-attribution laboratory mutated the live cognitive state');
assert.equal(state.expression.content,before.expression.content,'agency-attribution laboratory changed live Expression');

const executiveEvent=state.events.find(event=>event.id==='executive-selection');
const prediction=createActionEffectPrediction({executive:state.executive,executiveEvent});
const mixed=attributeAgency(prediction,{
  id:'mixed-provenance',type:'expression.report',target:'Human',causalParents:['executive-selection','external-injection-root'],metadata:{claimedCause:'self-caused'}
},{selfActionCauseIds:['executive-selection'],externalActionCauseIds:['external-injection-root']});
assert.equal(mixed.attribution,'ambiguous');
assert.ok(mixed.confidence<.5);

console.log(`ConsciOS v1.2 agency-attribution verification passed: ${(lab.metrics.accuracy*100).toFixed(0)}% fixture accuracy, label claims ignored, zero live causal authority.`);
