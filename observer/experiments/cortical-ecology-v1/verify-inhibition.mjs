import fs from 'node:fs';
import assert from 'node:assert/strict';
import { runModularV0 } from '../../../runtime/v0-modular.mjs';
import {
  CEP4_FIXTURES,
  CEP4_PARAMETERS,
  boundedDisinhibition,
  candidatesFromFixture,
  contextualInhibition,
  excitationOnly,
  fastStructuredInhibition,
  matchedRandomInhibition,
  randomizedControlSummary
} from './inhibition-lab.mjs';

const fixture=JSON.parse(fs.readFileSync(new URL('../../../experiments/v0-fixture.json',import.meta.url),'utf8'));
const acceptedBefore=runModularV0();
const acceptedSnapshot=structuredClone(acceptedBefore);

// F1 — existing v0 ecology and matched randomized controls.
const v0Candidates=candidatesFromFixture(fixture);
const v0Snapshot=structuredClone(v0Candidates);
const excitation=excitationOnly(v0Candidates);
const structured=fastStructuredInhibition(v0Candidates);
const randomSummary=randomizedControlSummary(v0Candidates);

assert.deepEqual(v0Candidates,v0Snapshot,'CEP-4 mutated the accepted fixture candidate ecology');
assert.deepEqual(excitation.admittedRoots,['obs-user','obs-user'],'excitation-only baseline must reproduce duplicate-root saturation');
assert.equal(excitation.distinctRoots,1);
assert.equal(excitation.duplicateRootAdmissions,1);
assert.deepEqual(structured.admittedRoots,['obs-user','obs-runtime'],'structured lateral inhibition must represent two roots on the preregistered fixture');
assert.equal(structured.distinctRoots,2);
assert.equal(structured.duplicateRootAdmissions,0);
assert.equal(structured.inhibitionMessageCount,1,'only causally relevant pre-final lateral inhibition should be emitted');
assert.equal(structured.inhibitionMagnitude,CEP4_PARAMETERS.fastInhibition);
assert.equal(randomSummary.runs,128);
assert.ok(randomSummary.duplicateRuns>0,'matched randomized inhibition must retain a non-zero duplicate-root rate');
assert.ok(randomSummary.fullDiversityRuns>0,'matched randomized control must include at least one full-diversity outcome');
assert.ok(randomSummary.fullDiversityRuns<128,'matched randomized inhibition must not equal structured full diversity on every seed');
assert.ok(randomSummary.fullDiversityRate<1);

for(let seed=1;seed<=128;seed++){
  const random=matchedRandomInhibition(v0Candidates,seed);
  const repeat=matchedRandomInhibition(v0Candidates,seed);
  assert.deepEqual(repeat,random,`randomized control seed ${seed} must replay exactly`);
  assert.equal(random.inhibitionMessageCount,structured.inhibitionMessageCount,`seed ${seed} must match structured inhibition message count`);
  assert.equal(random.inhibitionMagnitude,structured.inhibitionMagnitude,`seed ${seed} must match structured inhibition magnitude`);
}
const reversed=fastStructuredInhibition([...v0Candidates].reverse());
assert.deepEqual(reversed.admittedIds,structured.admittedIds,'structured outcome must not depend on candidate input order');
assert.deepEqual(reversed.admittedRoots,structured.admittedRoots);

// F2 — contradiction and support gates remain explicit and fail closed.
const contradictionInput=structuredClone(CEP4_FIXTURES.contradiction);
const contradictionRaw=excitationOnly(contradictionInput);
const contradictionContext=contextualInhibition(contradictionInput);
assert.deepEqual(contradictionInput,CEP4_FIXTURES.contradiction,'context experiment mutated fixture');
assert.deepEqual(contradictionRaw.admittedIds,['contradicted-hot','unsupported-hot'],'raw excitation should expose the preregistered adversary');
assert.deepEqual(contradictionContext.hardGatedIds,['contradicted-hot','unsupported-hot']);
assert.deepEqual(contradictionContext.admittedIds,['supported-a','supported-b']);
assert.deepEqual(contradictionContext.contradictedAdmissions,[]);
assert.deepEqual(contradictionContext.unsupportedAdmissions,[]);
assert.ok(contradictionContext.gates.some(gate=>gate.targetId==='contradicted-hot'&&gate.reason==='hard-contradiction'));
assert.ok(contradictionContext.gates.some(gate=>gate.targetId==='unsupported-hot'&&gate.reason==='hard-support-floor'));
assert.ok(contradictionContext.artifacts.some(item=>item.targetId==='contradicted-hot'&&item.reason==='contextual-contradiction'));
assert.ok(contradictionContext.artifacts.some(item=>item.targetId==='unsupported-hot'&&item.reason==='weak-support'));

// F3 — bounded disinhibition may rescue valid urgency but never a hard-gated contradiction.
const disinhibitionInput=structuredClone(CEP4_FIXTURES.disinhibition);
const withoutRelease=contextualInhibition(disinhibitionInput);
const withRelease=boundedDisinhibition(disinhibitionInput);
assert.deepEqual(withoutRelease.admittedIds,['anchor','steady-alternative'],'contextual inhibition alone should prefer the distinct supported alternative');
assert.deepEqual(withRelease.admittedIds,['anchor','urgent-repeat'],'bounded release should recover the preregistered high-urgency supported repeat');
assert.ok(withRelease.highUrgencySupportedAdmissions.includes('urgent-repeat'));
assert.ok(withRelease.hardGatedIds.includes('contradicted-urgent'));
assert.equal(withRelease.admittedIds.includes('contradicted-urgent'),false,'disinhibition must not rescue a hard-gated contradiction');
const urgentRelease=withRelease.artifacts.find(item=>item.kind==='disinhibition'&&item.targetId==='urgent-repeat');
assert.ok(urgentRelease);
assert.equal(urgentRelease.magnitude,CEP4_PARAMETERS.maxDisinhibition,'high urgency release must be capped at the preregistered maximum');
assert.equal(withRelease.artifacts.some(item=>item.kind==='disinhibition'&&item.targetId==='contradicted-urgent'),false,'hard-gated candidate must receive no disinhibition artifact');
assert.ok(withRelease.admitted.find(item=>item.id==='urgent-repeat').adjustedSalience<=1);

// Shadow-only invariant: the accepted deterministic runtime is untouched.
assert.deepEqual(runModularV0(),acceptedSnapshot,'CEP-4 shadow experiment changed accepted deterministic cognition');
assert.deepEqual(acceptedBefore,acceptedSnapshot);

const report={
  parameters:CEP4_PARAMETERS,
  acceptedFixture:{
    excitationOnly:{admittedIds:excitation.admittedIds,roots:excitation.admittedRoots,distinctRoots:excitation.distinctRoots},
    structuredInhibition:{admittedIds:structured.admittedIds,roots:structured.admittedRoots,distinctRoots:structured.distinctRoots,inhibitionMessages:structured.inhibitionMessageCount,inhibitionMagnitude:structured.inhibitionMagnitude},
    matchedRandomized:{seeds:randomSummary.seedRange,runs:randomSummary.runs,duplicateRuns:randomSummary.duplicateRuns,duplicateRate:randomSummary.duplicateRate,fullDiversityRuns:randomSummary.fullDiversityRuns,fullDiversityRate:randomSummary.fullDiversityRate}
  },
  contradictionFixture:{
    excitationOnly:contradictionRaw.admittedIds,
    contextual:contradictionContext.admittedIds,
    hardGatedIds:contradictionContext.hardGatedIds
  },
  disinhibitionFixture:{
    contextual:withoutRelease.admittedIds,
    boundedDisinhibition:withRelease.admittedIds,
    hardGatedIds:withRelease.hardGatedIds,
    urgentRepeatRelease:urgentRelease.magnitude
  },
  acceptedRuntimeUnchanged:true,
  causalAuthority:'none'
};
console.log(JSON.stringify(report,null,2));
console.log('Cortical Ecology CEP-4 verification passed: structured inhibition improved root diversity over excitation-only and matched randomized controls; context gates rejected preregistered adversaries; bounded disinhibition preserved hard gates.');
