import test from 'node:test';
import assert from 'node:assert/strict';
import { createKernel } from '../src/kernel.mjs';
import { createResearchLab } from '../src/lab.mjs';

function fakeResult(name,ecs,functional){
  const measurements={globalAvailability:{value:functional}};
  return{
    resultId:`result-${name}`,subject:{name,model:name},
    baseline:{score:{score:ecs,functionalScore:functional},measurements},
    matchedControl:null,intervention:null,
    summary:{baselineECS:ecs,baselineFunctional:functional,controlECS:null,controlFunctional:null,interventionECS:null,interventionFunctional:null,deltaECS:null,deltaFunctional:null,deltaMatchedECS:null,deltaMatchedFunctional:null,baselineCalls:1,controlCalls:null,interventionCalls:null},
    createdAt:'2026-10-04T00:00:00Z'
  };
}

test('research lab retains results and compares different models',()=>{
  const lab=createResearchLab({kernel:createKernel(),initialResults:[fakeResult('a',.3,.5),fakeResult('b',.4,.7)]});
  assert.equal(lab.results().length,2);
  const comparison=lab.compareModels('a','b','baseline');
  assert.ok(Math.abs(comparison.deltaECS-.1)<1e-12);
  assert.ok(Math.abs(comparison.deltaFunctional-.2)<1e-12);
});
