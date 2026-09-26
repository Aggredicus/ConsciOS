import fs from 'node:fs';
import assert from 'node:assert/strict';
import { runModularV0 } from '../../../runtime/v0-modular.mjs';
import { compileRuntimePhenotype, validateRegulatoryProgram } from '../../../runtime/ecology/phenotype-compiler.mjs';
import { createShadowEnvelopeValidator, shadowEnvelopeFromEvent } from '../../../runtime/ecology/cognitive-envelope-v1.mjs';

const programPath=new URL('../../../phenotype/cortical-ecology-program.v1.json',import.meta.url);
const loadProgram=()=>JSON.parse(fs.readFileSync(programPath,'utf8'));
const clone=value=>structuredClone(value);

const sourceProgram=loadProgram();
const sourceSnapshot=clone(sourceProgram);
assert.equal(validateRegulatoryProgram(sourceProgram),true);
const first=await compileRuntimePhenotype(sourceProgram);
const second=await compileRuntimePhenotype(loadProgram());
assert.deepEqual(sourceProgram,sourceSnapshot,'phenotype compilation mutated its source program');
assert.deepEqual(second.phenotype,first.phenotype,'same regulatory program must compile to the same phenotype');
assert.match(first.phenotype.phenotypeHash,/^[0-9a-f]{64}$/);
assert.equal(first.phenotype.activeRoles.length,11);
assert.equal(first.phenotype.providerPermissions.length,0,'current deterministic phenotype must not gain provider authority');
assert.equal(first.phenotype.causalAuthority,'none');
assert.equal(first.phenotype.mode,'shadow');
assert.equal(Object.isFrozen(first.program),true);
assert.equal(Object.isFrozen(first.program.roles),true);
assert.equal(Object.isFrozen(first.phenotype),true);
assert.throws(()=>{first.program.budgets.workspaceCapacity=99;},TypeError,'compiled regulatory program must be immutable');
assert.equal(first.program.budgets.workspaceCapacity,2);

const acceptedBefore=runModularV0();
const acceptedSnapshot=clone(acceptedBefore);
const routableEvents=acceptedBefore.events.filter(event=>event.target||event.globallyAvailable===true);
const allEventIds=acceptedBefore.events.map(event=>event.id);
const validator=createShadowEnvelopeValidator({program:first.program,phenotype:first.phenotype,knownParentIds:allEventIds});
const envelopes=[];
for(const event of routableEvents){
  const envelope=shadowEnvelopeFromEvent(event,{program:first.program,phenotype:first.phenotype});
  const result=validator.validate(envelope);
  assert.equal(result.accepted,true);
  envelopes.push(envelope);
}
assert.ok(envelopes.length>=10,'expected a meaningful shadow-envelope projection of the accepted trace');
assert.deepEqual(acceptedBefore,acceptedSnapshot,'shadow envelope projection mutated accepted cognition');
assert.deepEqual(runModularV0(),acceptedSnapshot,'phenotype compilation/envelope validation changed deterministic runtime behavior');

const guardianEnvelope=envelopes.find(envelope=>envelope.sourceRole==='Guardian');
assert.ok(guardianEnvelope,'Guardian event must resolve from its runtime source alias');
assert.equal(guardianEnvelope.sourceDomain,'integrity');
assert.equal(guardianEnvelope.targetDomain,'action');
assert.equal(guardianEnvelope.epistemicStatus,'governance');
const expressionEnvelope=envelopes.find(envelope=>envelope.sourceRole==='Expression');
assert.equal(expressionEnvelope.targetDomain,'external');

const base=envelopes[0];
function reject(mutator,pattern){
  const candidate=clone(base);
  mutator(candidate);
  const isolated=createShadowEnvelopeValidator({program:first.program,phenotype:first.phenotype,knownParentIds:allEventIds});
  assert.throws(()=>isolated.validate(candidate),pattern);
}
reject(candidate=>{candidate.phenotypeHash='0'.repeat(64);},/phenotype hash mismatch/);
reject(candidate=>{candidate.targetDomain='external';},/undeclared edge/);
reject(candidate=>{candidate.sourceRole='UnknownRole';},/unknown source role/);
reject(candidate=>{candidate.epistemicStatus='governance';},/cannot author epistemic status/);
reject(candidate=>{candidate.ttlCycles=first.program.budgets.maxEnvelopeTtlCycles+1;},/ttlCycles exceeds regulatory budget/);
reject(candidate=>{candidate.providerProvenance={providerId:'unreviewed-cloud-model'};},/not permitted by this phenotype/);
reject(candidate=>{candidate.capabilityContextId='undeclared-capability';},/undeclared capability context/);
reject(candidate=>{candidate.payloadSchema='https://example.invalid/schema';},/undeclared payload schema/);

const sourceAliasFixture={...acceptedBefore.events.find(event=>event.target),id:'unknown-source-test',source:'UnregisteredProcessor'};
assert.throws(()=>shadowEnvelopeFromEvent(sourceAliasFixture,{program:first.program,phenotype:first.phenotype}),/Unknown source alias/);
const unknownTargetFixture={...acceptedBefore.events.find(event=>event.target),id:'unknown-target-test',target:'UnregisteredTarget'};
assert.throws(()=>shadowEnvelopeFromEvent(unknownTargetFixture,{program:first.program,phenotype:first.phenotype}),/Unknown target role or alias/);

if(envelopes.length>=2){
  const ordered=createShadowEnvelopeValidator({program:first.program,phenotype:first.phenotype,knownParentIds:allEventIds});
  ordered.validate(envelopes[0]);
  const retrograde=clone(envelopes[1]);
  retrograde.logicalTime=Math.max(0,envelopes[0].logicalTime-1);
  assert.throws(()=>ordered.validate(retrograde),/non-monotonic logicalTime/);
}

const badRoleProgram=loadProgram();
badRoleProgram.roles.push({...badRoleProgram.roles[0],role:'ShadowDuplicate',sourceAliases:['Sensorium']});
assert.throws(()=>validateRegulatoryProgram(badRoleProgram),/source alias Sensorium is claimed/);
const badEdgeProgram=loadProgram();
badEdgeProgram.edges.push({sourceRole:'UnregisteredRole',targetDomain:'cortex',kind:'invalid'});
assert.throws(()=>validateRegulatoryProgram(badEdgeProgram),/unknown source role/);

const summary={
  phenotypeHash:first.phenotype.phenotypeHash,
  activeRoles:first.phenotype.activeRoles.length,
  declaredEdges:first.phenotype.edges.length,
  providerPermissions:first.phenotype.providerPermissions.length,
  projectedEnvelopes:envelopes.length,
  causalAuthority:first.phenotype.causalAuthority,
  acceptedExpression:acceptedBefore.expression?.content??null
};
console.log(JSON.stringify(summary,null,2));
console.log('Cortical Ecology CEP-2 verification passed: deterministic phenotype compilation and fail-closed envelope validation remained shadow-only and behavior-preserving.');
