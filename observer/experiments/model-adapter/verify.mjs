import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createDeterministicMockModel } from '../../../runtime/models/deterministic-mock.mjs';
import { validateCognitiveModelInput, validateCognitiveModelOutput } from '../../../runtime/models/validation.mjs';

const input={
  requestId:'model-request-001',requestingModule:'Metacognition',inferenceType:'epistemic-summary',
  contextManifest:[
    {artifactId:'meta-assessment',epistemicStatus:'inference',content:{confidence:.94}},
    {artifactId:'counterfactual-set',epistemicStatus:'counterfactual',content:{candidateCount:2}}
  ],
  causalSourceIds:['meta-assessment','counterfactual-set'],maxResponseUnits:128,
  expectedEpistemicStatus:'inference',hiddenContextPolicy:'none'
};
assert.equal(validateCognitiveModelInput(input).valid,true);

const model=createDeterministicMockModel();
const first=await model.infer(input);const second=await model.infer(input);
assert.deepEqual(first,second,'deterministic model output changed across identical inputs');
assert.equal(first.provider.kind,'deterministic-mock');
assert.equal(first.provider.hiddenState,'none');
assert.deepEqual(first.content.accessibleArtifactIds,['meta-assessment','counterfactual-set']);
assert.deepEqual(first.causalSourceIds,input.causalSourceIds);
assert.equal(first.epistemicStatus,'inference');
assert.equal(validateCognitiveModelOutput(first).valid,true);

const timeout=await createDeterministicMockModel({mode:'timeout'}).infer(input);
assert.equal(timeout.status,'timeout');assert.equal(timeout.confidence,0);assert.equal(timeout.epistemicStatus,'error');
const error=await createDeterministicMockModel({mode:'error'}).infer(input);
assert.equal(error.status,'error');assert.equal(error.confidence,0);assert.equal(error.epistemicStatus,'error');
const malformed=await createDeterministicMockModel({mode:'malformed'}).infer(input);
assert.equal(validateCognitiveModelOutput(malformed).valid,false,'malformed output should fail validation');

assert.equal(validateCognitiveModelInput({...input,hiddenContextPolicy:'provider-secret'}).valid,false,'undeclared provider context must be rejected');
assert.equal(validateCognitiveModelInput({...input,contextManifest:undefined}).valid,false,'implicit context must be rejected');

for(const path of ['runtime/models/deterministic-mock.mjs','runtime/models/validation.mjs']){
  const source=readFileSync(path,'utf8');
  for(const forbidden of ['fetch(','XMLHttpRequest','WebSocket','http://','https://','process.env','apiKey','API_KEY'])assert.ok(!source.includes(forbidden),`${path} contains forbidden external/provider capability: ${forbidden}`);
}
const expression=readFileSync('cognition/expression/v0.mjs','utf8');
assert.ok(!expression.includes('runtime/models')&&!expression.includes('CognitiveModel')&&!expression.includes('.infer('),'Expression gained direct model access');

console.log('ConsciOS v0.7 deterministic CognitiveModel adapter verification passed. No generative model was activated.');
