import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runModularV0 } from '../../../runtime/v0-modular.mjs';
import { createLiveScheduler, LIVE_STAGE_ORDER, makeBrowserObservation } from '../../../runtime/live-scheduler.mjs';
import { V0_FIXTURE } from '../../../cognition/sensorium/v0.mjs';

function runToCompletion(scheduler){
  const steps=[];
  while(!scheduler.isComplete()) steps.push(scheduler.step());
  return {steps,state:scheduler.snapshot()};
}

const accepted=runModularV0();
const raw=createLiveScheduler({workspacePolicy:'raw'});
const rawRun=runToCompletion(raw);
assert.equal(rawRun.steps.length,LIVE_STAGE_ORDER.length,'live scheduler must expose one step per declared stage');
assert.deepEqual(rawRun.steps.map(step=>step.stage),[...LIVE_STAGE_ORDER]);
assert.deepEqual(rawRun.state,accepted,'raw live scheduler must reproduce accepted one-pass phenotype exactly');
assert.equal(rawRun.steps[0].eventCount,4,'sensorium should be independently visible before local processing');
assert.equal(rawRun.steps[1].eventCount,10,'local processing should be independently visible before workspace competition');
assert.equal(rawRun.steps[2].eventCount,12,'workspace broadcasts should be independently visible');

const singleStep=createLiveScheduler();
const before=singleStep.snapshot();
const sensorStep=singleStep.step();
assert.equal(before.events.length,0);
assert.equal(sensorStep.stage,'sensorium');
assert.equal(sensorStep.state.events.length,4);
assert.equal(singleStep.stage(),'local-processing','single step must not execute later stages');

const diverse=createLiveScheduler({workspacePolicy:'diverse'});
const diverseRun=runToCompletion(diverse);
const diverseRoots=diverseRun.state.workspace.map(event=>event.causalParents[0]?.replace(/^cand-[^-]+-/,'')??'');
assert.equal(diverseRun.state.workspace.length,2);
assert.ok(diverseRun.state.workspace.some(event=>String(event.content).includes('human supplied')),'diverse workspace should retain human instruction');
assert.ok(diverseRun.state.workspace.some(event=>String(event.content).includes('Memory utilization')),'diverse workspace should admit runtime observation');
assert.equal(diverseRun.state.world.runtimeChangeObserved,true,'downstream World Model must see admitted runtime change');
assert.ok(diverseRun.state.expression.content.includes('runtime-memory change'),'Expression should reflect actual diverse workspace content');

const soft=createLiveScheduler({workspacePolicy:'soft'});
const softRun=runToCompletion(soft);
assert.ok(softRun.state.workspace.some(event=>String(event.content).includes('Memory utilization')),'soft diversity should admit runtime observation at penalty 0.25');

const injected=makeBrowserObservation({id:'obs-live-test',content:'A human supplied a live observation about the hosted laboratory.',novelty:.91,goalRelevance:.99,predictionError:.35,urgency:.25});
const injectionScheduler=createLiveScheduler({fixture:[...V0_FIXTURE,injected],workspacePolicy:'diverse'});
const injectionSensor=injectionScheduler.step();
const injectedEvent=injectionSensor.state.events.find(event=>event.id==='obs-live-test');
assert.ok(injectedEvent,'injected observation must enter Sensorium');
assert.equal(injectedEvent.metadata.origin,'live-user-injection');
assert.equal(injectedEvent.epistemicStatus,'observation');

const schedulerSource=readFileSync('runtime/live-scheduler.mjs','utf8');
for(const forbidden of ['fetch(','XMLHttpRequest','WebSocket','EventSource','navigator.mediaDevices','geolocation','apiKey','Authorization:']){
  assert.ok(!schedulerSource.includes(forbidden),`unexpected network/privileged capability in live scheduler: ${forbidden}`);
}
assert.ok(!schedulerSource.includes('I am conscious')&&!schedulerSource.includes('I am awake'),'scripted consciousness claim found');

console.log(JSON.stringify({
  stages:rawRun.steps.map(step=>({stage:step.stage,eventCount:step.eventCount,newEventIds:step.newEventIds})),
  rawExpression:rawRun.state.expression.content,
  diverseWorkspace:diverseRun.state.workspace.map(event=>event.id),
  diverseExpression:diverseRun.state.expression.content,
  injectionId:injectedEvent.id
},null,2));
