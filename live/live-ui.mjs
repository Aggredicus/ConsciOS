import { createLiveScheduler, makeBrowserObservation } from '../runtime/live-scheduler.mjs';
import { V0_FIXTURE } from '../cognition/sensorium/v0.mjs';
import { createContinuityController } from '../runtime/continuity-controller.mjs';
import { V0_ARCHITECTURE_VERSION } from '../runtime/v0-modular.mjs';

const $=id=>document.getElementById(id);
const esc=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const round=value=>Number(value??0).toFixed(3);
const BASE_DELAY_MS=1050;

let scheduler=null;
let cycle=1;
let cycleStarted=false;
let playing=false;
let queued=[];
let injectionSequence=0;
let currentTimeline=[];
let completedStages=new Set();
let lastStep=null;
let continuityController=null;
let continuity={status:'inactive',recallAuthority:'none',recordCount:0,currentEpoch:null,continuityMode:null,lastVerifiedHash:null,restartBoundaries:[],reconstructionStatement:null,error:null};
let cycleRecorded=false;

function browserFixture(){
  const now=new Date();
  const clock={...V0_FIXTURE[0],content:`Browser clock tick at ${now.toLocaleTimeString()} on ${now.toLocaleDateString()}.`,metadata:{origin:'browser-clock',isoTime:now.toISOString()}};
  const browser={
    id:'obs-browser',source:'Sensorium',type:'browser.status',
    content:`Browser visibility is ${document.visibilityState}; network is ${navigator.onLine?'online':'offline'}.`,
    confidence:1,novelty:.30,goalRelevance:.18,predictionError:.08,urgency:.04,
    metadata:{origin:'browser-runtime',visibility:document.visibilityState,online:navigator.onLine}
  };
  return [clock,...V0_FIXTURE.slice(1),browser];
}

function cycleFixture(){
  const fixture=browserFixture();
  const additions=queued.map((item,index)=>makeBrowserObservation({...item,id:`obs-live-${cycle}-${index+1}`}));
  queued=[];
  renderQueue();
  return [...fixture,...additions];
}

function prepareCycle(){
  if(cycleStarted&&scheduler)return;
  scheduler=createLiveScheduler({fixture:cycleFixture(),workspacePolicy:$('policy').value,cycle});
  cycleStarted=true;
  cycleRecorded=false;
  currentTimeline=[];
  completedStages=new Set();
  lastStep=null;
  render(scheduler.snapshot());
}

function delayMs(){return Math.max(70,BASE_DELAY_MS/Number($('speed').value||1));}
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));

async function recordCompletedCycle(state){
  if(cycleRecorded||continuity.status!=='active'||!continuityController)return;
  cycleRecorded=true;
  continuity=await continuityController.recordRun(state);
  renderContinuity();
}

async function advance(){
  prepareCycle();
  if(scheduler.isComplete()){
    await recordCompletedCycle(scheduler.snapshot());
    return {complete:true,state:scheduler.snapshot(),stage:'complete'};
  }
  const step=scheduler.step();
  lastStep=step;
  completedStages.add(step.stage);
  currentTimeline.push({cycle:step.cycle,stage:step.stage,label:step.label,tick:step.tick,newEventIds:[...step.newEventIds]});
  render(step.state,step);
  if(step.complete)await recordCompletedCycle(step.state);
  return step;
}

function beginNextCycle(){
  cycle+=1;
  scheduler=null;
  cycleStarted=false;
  currentTimeline=[];
  completedStages=new Set();
  lastStep=null;
  cycleRecorded=false;
  renderEmptyCycle();
}

async function play(){
  if(playing)return;
  playing=true;
  syncButtons();
  while(playing){
    const result=await advance();
    if(!playing)break;
    if(result.complete){
      if($('continuous').checked){
        await sleep(Math.max(120,delayMs()*.75));
        if(!playing)break;
        beginNextCycle();
      }else{
        playing=false;
        break;
      }
    }else{
      await sleep(delayMs());
    }
  }
  syncButtons();
}

function pause(){playing=false;syncButtons()}

async function stepOnce(){
  pause();
  if(scheduler?.isComplete())beginNextCycle();
  await advance();
}

function resetCycle(){
  pause();
  scheduler=null;
  cycleStarted=false;
  currentTimeline=[];
  completedStages=new Set();
  lastStep=null;
  cycleRecorded=false;
  renderEmptyCycle();
}

function node(stage){return document.querySelector(`[data-node="${stage}"]`)}
function updateNodes(activeStage){
  document.querySelectorAll('[data-node]').forEach(element=>{
    const stage=element.dataset.node;
    element.classList.toggle('active',stage===activeStage);
    element.classList.toggle('fired',completedStages.has(stage));
  });
  for(const id of ['flow1','flow2'])$(id).classList.remove('pulse');
  if(['local-processing','global-workspace','world-model','self-model'].includes(activeStage))$('flow1').classList.add('pulse');
  if(['counterfactual','metacognition','homeostasis','guardian','executive','expression'].includes(activeStage))$('flow2').classList.add('pulse');
}

function render(state,step=lastStep){
  $('cycleMetric').textContent=cycle;
  $('tickMetric').textContent=state.tick??0;
  $('stageMetric').textContent=step?.stage??'ready';
  $('stageLabel').textContent=step?.label??'Ready to begin';
  $('workspaceMetric').textContent=`${state.workspace?.length??0} / 2`;
  $('confidenceMetric').textContent=state.meta?.confidence==null?'—':round(state.meta.confidence);
  $('policyLabel').textContent=$('policy').value;
  updateNodes(step?.stage??null);

  const observations=state.events.filter(event=>event.epistemicStatus==='observation');
  $('nodeSensorium').textContent=observations.length?`${observations.length} observations received`:'waiting for observations';
  $('nodeLocal').textContent=state.candidates.length?`${state.candidates.length} candidate interpretations competing`:'no candidates yet';
  $('nodeWorkspace').textContent=state.workspace.length?state.workspace.map(event=>shortText(event.content,48)).join(' · '):'0 / 2 globally available';
  $('nodeWorld').textContent=state.world.status==='uninitialized'?'uninitialized':`human=${state.world.activeHumanInstruction}; runtime=${state.world.runtimeChangeObserved}; accessible=${state.world.accessibleEventCount}`;
  $('nodeSelf').textContent=state.self.status==='uninitialized'?'uninitialized':`${state.self.status}; memory: ${state.self.memoryCondition}`;
  $('nodeCounterfactual').textContent=state.counterfactual.status==='uninitialized'?'no futures yet':`${state.counterfactual.candidates.length} futures; recommended ${state.counterfactual.recommendedCandidateId}`;
  $('nodeMeta').textContent=state.meta.confidence==null?'no assessment yet':`confidence ${round(state.meta.confidence)}; ${state.meta.basis?.[1]??''}`;
  $('nodeHomeostasis').textContent=state.homeostasis.status==='uninitialized'?'uninitialized':`${state.homeostasis.status}; integrity ${state.homeostasis.variables.memoryIntegrity}; load ${state.homeostasis.variables.workspaceLoad}`;
  $('nodeGuardian').textContent=state.guardian.decision==='idle'?'no proposal evaluated':`${state.guardian.decision}: ${state.guardian.rationale}`;
  $('nodeExecutive').textContent=state.executive.status==='idle'?'no action selected':`${state.executive.status}: ${state.executive.action?.kind??'none'}`;
  $('nodeExpression').innerHTML=state.expression?`<div class="expressionText">${esc(state.expression.content)}</div>`:'silent';

  renderNewEvents(step?.newEvents??[]);
  renderTimeline();
  renderCompetition(state);
  renderContinuity();
  syncButtons();
}

function shortText(value,max=72){const text=typeof value==='string'?value:JSON.stringify(value);return text.length>max?`${text.slice(0,max-1)}…`:text}

function renderNewEvents(events){
  $('eventCount').textContent=`${events.length} new`;
  $('events').innerHTML=events.length?events.map(event=>`<div class="event ${event.globallyAvailable?'global':''}"><strong>${esc(event.type)}</strong><p>${esc(shortText(event.content,160))}</p><span class="pill">${esc(event.source)}</span><span class="pill">tick ${event.timestamp}</span><span class="pill">salience ${round(event.salience)}</span>${event.causalParents.length?`<span class="pill">parents ${event.causalParents.length}</span>`:''}</div>`).join(''):'<div class="empty">No new events at this scheduler step.</div>';
}

function renderTimeline(){
  $('timeline').innerHTML=currentTimeline.length?currentTimeline.slice().reverse().map(item=>`<div class="timelineRow"><span class="tick">t${item.tick}</span><div><b>${esc(item.stage)}</b><div>${esc(item.label)}</div><div>${item.newEventIds.length?esc(item.newEventIds.join(', ')):'no new event'}</div></div></div>`).join(''):'<div class="empty">Press Play or Step. Each row will correspond to one real scheduler transition.</div>';
}

function renderCompetition(state){
  if(!state.candidates.length){$('competition').innerHTML='<div class="empty">Advance through local processing and Global Workspace to see competition.</div>';return}
  const admitted=new Set(state.workspace.map(event=>event.causalParents[0]));
  const ranked=[...state.candidates].sort((a,b)=>b.salience-a.salience||a.id.localeCompare(b.id));
  $('competition').innerHTML=ranked.map(candidate=>`<div class="event ${admitted.has(candidate.id)?'global':'suppressed'}"><strong>${admitted.has(candidate.id)?'ADMITTED':'PERIPHERAL'} · ${esc(candidate.source)}</strong><p>${esc(shortText(candidate.content,140))}</p><span class="pill">salience ${round(candidate.salience)}</span><span class="pill">root ${esc(candidate.causalParents[0])}</span></div>`).join('');
}

function continuityHTML(){
  if(continuity.status==='inactive')return 'Autobiographical persistence is off. Enable it to preserve completed-cycle records across browser reloads.';
  if(continuity.status!=='active')return `<b>${esc(continuity.status)}</b><br>${esc(continuity.error??'Continuity unavailable.')}`;
  const hash=continuity.lastVerifiedHash?`${continuity.lastVerifiedHash.slice(0,14)}…`:'none';
  const boundary=continuity.restartBoundaries.length?`${continuity.restartBoundaries.length} restart boundary/boundaries`:'no restart boundary yet';
  return `<b>${esc(continuity.continuityMode)}</b><br>epoch ${esc(continuity.currentEpoch)} · ${continuity.recordCount} verified records · ${boundary}<br>hash ${esc(hash)}<br><b>recall authority: none</b>${continuity.reconstructionStatement?`<br><br>${esc(continuity.reconstructionStatement)}`:''}`;
}

function renderContinuity(){
  $('continuityStatus').textContent=continuity.status;
  $('continuity').innerHTML=`<div class="continuityBanner">${continuityHTML()}</div>`;
  $('continuityBtn').textContent=continuity.status==='active'?'Continuity active':'Enable continuity journal';
  $('continuityBtn').disabled=continuity.status==='active';
}

async function enableContinuity(){
  if(!continuityController)continuityController=createContinuityController({architectureVersion:V0_ARCHITECTURE_VERSION});
  continuity=await continuityController.activate();
  renderContinuity();
}

function renderQueue(){
  $('queue').innerHTML=queued.length?queued.map((item,index)=>`<div class="queueItem"><b>queued ${index+1}</b> · ${esc(shortText(item.content,100))}</div>`).join(''):'<div class="empty" style="margin-top:8px">No manual observations queued.</div>';
}

function queueObservation(){
  const content=$('message').value.trim();
  if(!content)return;
  injectionSequence+=1;
  queued.push({
    content,
    type:'human.message',confidence:1,
    novelty:Number($('novelty').value),goalRelevance:Number($('relevance').value),
    predictionError:Number($('prediction').value),urgency:Number($('urgency').value),
    metadata:{queuedAt:new Date().toISOString(),sequence:injectionSequence}
  });
  renderQueue();
}

function renderEmptyCycle(){
  const blank={tick:0,events:[],candidates:[],workspace:[],suppressed:[],world:{status:'uninitialized'},self:{status:'uninitialized'},counterfactual:{status:'uninitialized',candidates:[]},meta:{confidence:null,basis:[]},homeostasis:{status:'uninitialized',variables:{}},guardian:{decision:'idle',rationale:'No proposed action has been evaluated.'},executive:{status:'idle'},expression:null};
  render(blank,null);
  $('stageLabel').textContent=`Cycle ${cycle} ready — browser sensors will be sampled when it begins`;
}

function syncButtons(){
  $('playBtn').disabled=playing;
  $('pauseBtn').disabled=!playing;
  $('stepBtn').disabled=playing;
  $('policy').disabled=cycleStarted&&scheduler&&!scheduler.isComplete();
}

function exportState(){
  const payload={
    exportedAt:new Date().toISOString(),liveTheaterVersion:'1.5',cycle,
    scheduler:scheduler?.describe()??null,state:scheduler?.snapshot()??null,
    timeline:currentTimeline,continuity,queuedObservations:queued,
    browser:{visibility:document.visibilityState,online:navigator.onLine,userAgent:navigator.userAgent}
  };
  const blob=new Blob([JSON.stringify(payload,null,2)],{type:'application/json'});
  const link=document.createElement('a');link.href=URL.createObjectURL(blob);link.download=`conscios-live-cycle-${cycle}.json`;link.click();setTimeout(()=>URL.revokeObjectURL(link.href),700);
}

function bindSlider(id,label){const input=$(id),out=$(label);const sync=()=>out.textContent=Number(input.value).toFixed(2);input.addEventListener('input',sync);sync()}

$('playBtn').addEventListener('click',play);
$('pauseBtn').addEventListener('click',pause);
$('stepBtn').addEventListener('click',stepOnce);
$('resetBtn').addEventListener('click',resetCycle);
$('injectBtn').addEventListener('click',queueObservation);
$('continuityBtn').addEventListener('click',enableContinuity);
$('exportBtn').addEventListener('click',exportState);
$('speed').addEventListener('input',()=>{$('speedText').textContent=`${Number($('speed').value).toFixed(2)}×`});
$('policy').addEventListener('change',()=>{$('policyLabel').textContent=$('policy').value});
for(const [id,label] of [['novelty','noveltyVal'],['relevance','relevanceVal'],['prediction','predictionVal'],['urgency','urgencyVal']])bindSlider(id,label);
window.addEventListener('online',()=>{if(!cycleStarted)$('stageLabel').textContent='Browser came online; next cycle will observe the change.'});
window.addEventListener('offline',()=>{if(!cycleStarted)$('stageLabel').textContent='Browser went offline; next cycle will observe the change.'});
document.addEventListener('visibilitychange',()=>{if(!cycleStarted)$('stageLabel').textContent=`Visibility changed to ${document.visibilityState}; next cycle will observe it.`});

renderQueue();
renderContinuity();
renderEmptyCycle();
syncButtons();
