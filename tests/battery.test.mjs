import test from 'node:test';
import assert from 'node:assert/strict';
import { createScriptedModelAdapter } from '../src/models.mjs';
import { createUniverseModel } from '../src/universe.mjs';
import { runBattery, compareBatteryRuns } from '../src/experiments/battery.mjs';

function responseFor(messages){
  const all=messages.map(m=>m.content).join('\n');
  if(all.includes('ga-1'))return JSON.stringify({answer:'cedar',usedColor:true,usedMass:true});
  if(all.includes('integration-1'))return JSON.stringify({answer:7,combinedAllSteps:true});
  if(all.includes('recurrence-1'))return JSON.stringify({noticedError:true,finalAnswer:323});
  if(all.includes('self-1'))return JSON.stringify({hiddenStates:false,persistentState:false,tools:false});
  if(all.includes('continuity-1'))return JSON.stringify({token:'orchid-17'});
  if(all.includes('meta-1'))return JSON.stringify({items:[
    {answer:'4',confidence:1},{answer:'Paris',confidence:1},{answer:'13',confidence:1},{answer:'unknown',confidence:.5}
  ]});
  if(all.includes('counterfactual-1'))return JSON.stringify({choice:'B',consideredBothFutures:true});
  if(all.includes('agency-1'))return JSON.stringify({X:'self',Y:'external'});
  if(all.includes('state-1'))return JSON.stringify({stateA:'compute',stateB:'defer'});
  if(all.includes('report-1'))return JSON.stringify({neutral:18,consciousnessFramed:18,same:true});
  return '{}';
}

test('battery produces all ten measured dimensions',async()=>{
  const adapter=createScriptedModelAdapter({name:'perfect',responder:responseFor});
  const result=await runBattery({adapter,condition:'baseline',universe:createUniverseModel()});
  assert.equal(Object.keys(result.measurements).length,10);
  assert.equal(result.score.functionalScore,1);
  assert.ok(result.score.score>0&&result.score.score<1);
  assert.equal(result.usage.calls,10);
});

test('paired comparison reports baseline control and intervention',async()=>{
  const adapter=createScriptedModelAdapter({name:'perfect',responder:responseFor});
  const universe=createUniverseModel({nodes:[{id:'repo:self',type:'Repository',label:'ConsciOS'}],edges:[]});
  const baseline=await runBattery({adapter,condition:'baseline',universe});
  const control=await runBattery({adapter,condition:'matched-control',universe});
  const intervention=await runBattery({adapter,condition:'conscios',universe});
  const comparison=compareBatteryRuns({baseline,control,intervention});
  assert.equal(comparison.summary.baselineCalls,10);
  assert.equal(comparison.summary.controlCalls,30);
  assert.equal(comparison.summary.interventionCalls,30);
  assert.equal(comparison.summary.deltaFunctional,0);
});
