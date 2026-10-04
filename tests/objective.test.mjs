import test from 'node:test';
import assert from 'node:assert/strict';
import { DIMENSIONS, scoreConsciousnessEvidence } from '../src/objective.mjs';

test('no measurements yields zero scores and unit loss',()=>{
  const r=scoreConsciousnessEvidence({});
  assert.equal(r.score,0);assert.equal(r.functionalScore,0);assert.equal(r.loss,1);assert.equal(r.coverage,0);
});

test('perfect complete measurements preserve functional score while reliability affects ECS',()=>{
  const m=Object.fromEntries(Object.keys(DIMENSIONS).map(n=>[n,{value:1,reliability:.55,evidenceTier:'behavioral'}]));
  const r=scoreConsciousnessEvidence(m);
  assert.equal(r.functionalScore,1);
  assert.equal(r.score,.55);
  assert.equal(r.coverage,1);
});

test('missing dimensions reduce coverage',()=>{
  const r=scoreConsciousnessEvidence({globalAvailability:{value:1,reliability:1}});
  assert.equal(r.coverage,.1);assert.equal(r.functionalScore,.1);assert.equal(r.score,.1);
});

test('weak core dimension bottlenecks geometric functional score',()=>{
  const m=Object.fromEntries(Object.keys(DIMENSIONS).map(n=>[n,{value:1,reliability:1}]));
  m.recurrence.value=.01;
  assert.ok(scoreConsciousnessEvidence(m).functionalScore<.7);
});
