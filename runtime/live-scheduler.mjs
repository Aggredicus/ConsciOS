import { perceiveV0, V0_FIXTURE } from '../cognition/sensorium/v0.mjs';
import { localProcessV0, scoreV0, workspaceCompetitionV0, V0_WORKSPACE_CAPACITY } from '../cognition/workspace/v0-runtime.mjs';
import { sourceDiverseTopK, softDiversityTopK } from '../cognition/workspace/policies.mjs';
import { updateWorldModelV0 } from '../cognition/world-model/v0.mjs';
import { updateSelfModelV0 } from '../cognition/self-model/v0.mjs';
import { generateCounterfactualsV0 } from '../cognition/counterfactual/v0.mjs';
import { metacognizeV0 } from '../cognition/metacognition/v0.mjs';
import { assessHomeostasisV0 } from '../cognition/homeostasis/v0.mjs';
import { guardianGateV0 } from '../cognition/guardian/v0.mjs';
import { executiveSelectV0 } from '../cognition/executive/v0.mjs';
import { expressV0 } from '../cognition/expression/v0.mjs';
import { createV0Runtime, V0_ARCHITECTURE_VERSION } from './v0-modular.mjs';

export const LIVE_STAGE_ORDER = Object.freeze([
  'sensorium',
  'local-processing',
  'global-workspace',
  'world-model',
  'self-model',
  'counterfactual',
  'metacognition',
  'homeostasis',
  'guardian',
  'executive',
  'expression'
]);

export const LIVE_STAGE_LABELS = Object.freeze({
  'sensorium':'Sensorium receives observations',
  'local-processing':'Local processors generate candidates',
  'global-workspace':'Candidates compete for global access',
  'world-model':'World Model updates',
  'self-model':'Self Model updates',
  'counterfactual':'Counterfactual futures are generated',
  'metacognition':'Metacognition evaluates confidence',
  'homeostasis':'Homeostasis assesses operational integrity',
  'guardian':'Ethics & Welfare Guardian evaluates the proposal',
  'executive':'Executive selects or withholds action',
  'expression':'Expression renders the permitted report'
});

const clone=value=>typeof structuredClone==='function'?structuredClone(value):JSON.parse(JSON.stringify(value));

function normalizePolicy(policy){
  return ['raw','diverse','soft'].includes(policy)?policy:'raw';
}

function rankedCandidates(candidates){
  return [...candidates]
    .map(candidate=>({...candidate,rootObservationId:candidate.causalParents?.[0]??null}))
    .sort((a,b)=>b.salience-a.salience||a.id.localeCompare(b.id));
}

function competitionWithPolicy(state,{makeEvent,pushEvent},policy){
  if(policy==='raw') return workspaceCompetitionV0(state.candidates,{makeEvent,pushEvent,capacity:V0_WORKSPACE_CAPACITY});

  const ranked=rankedCandidates(state.candidates);
  const selected=policy==='diverse'
    ?sourceDiverseTopK(ranked,V0_WORKSPACE_CAPACITY)
    :softDiversityTopK(ranked,V0_WORKSPACE_CAPACITY,.25);
  const selectedIds=new Set(selected.map(candidate=>candidate.id));
  const winners=selected.map(selectedCandidate=>{
    const candidate=state.candidates.find(item=>item.id===selectedCandidate.id);
    return pushEvent(makeEvent({...candidate,
      id:`broadcast-${candidate.id}`,
      source:'GlobalWorkspace',
      target:'*',
      type:'workspace.broadcast',
      content:candidate.content,
      globallyAvailable:true,
      causalParents:[candidate.id],
      epistemicStatus:'inference',
      metadata:{workspacePolicy:policy,policyReason:selectedCandidate.policyReason,adjustedSalience:selectedCandidate.adjustedSalience}
    }));
  });
  return {winners,suppressed:state.candidates.filter(candidate=>!selectedIds.has(candidate.id))};
}

export function makeBrowserObservation({
  id='obs-live-human',
  content='A human supplied a live observation.',
  type='human.message',
  confidence=1,
  novelty=.7,
  goalRelevance=.8,
  predictionError=.4,
  urgency=.3,
  metadata={}
}={}){
  return Object.freeze({
    id:String(id),source:'Sensorium',type:String(type),content:String(content),
    confidence:Number(confidence),novelty:Number(novelty),goalRelevance:Number(goalRelevance),
    predictionError:Number(predictionError),urgency:Number(urgency),metadata:{...metadata,origin:'live-user-injection'}
  });
}

export function createLiveScheduler({fixture=V0_FIXTURE,workspacePolicy='raw',cycle=1}={}){
  let policy=normalizePolicy(workspacePolicy);
  let sourceFixture=[...fixture];
  let cycleNumber=cycle;
  let runtime;
  let stageIndex;
  let observations;
  let worldResult;
  let selfResult;
  let counterfactualResult;
  let metaResult;
  let homeostasisResult;
  let guardResult;
  let executiveResult;

  function initialize(){
    runtime=createV0Runtime();
    runtime.state.run=cycleNumber;
    stageIndex=0;
    observations=[];
    worldResult=selfResult=counterfactualResult=metaResult=homeostasisResult=guardResult=executiveResult=null;
  }
  initialize();

  function recordStep(stage,beforeCount){
    const newEvents=runtime.state.events.slice(beforeCount);
    return Object.freeze({
      cycle:cycleNumber,
      stage,
      stageIndex:stageIndex-1,
      label:LIVE_STAGE_LABELS[stage],
      newEventIds:newEvents.map(event=>event.id),
      newEvents:clone(newEvents),
      eventCount:runtime.state.events.length,
      tick:runtime.state.tick,
      complete:stageIndex>=LIVE_STAGE_ORDER.length,
      workspacePolicy:policy,
      state:clone(runtime.state)
    });
  }

  function step(){
    if(stageIndex>=LIVE_STAGE_ORDER.length) return Object.freeze({
      cycle:cycleNumber,stage:'complete',stageIndex, label:'Cycle complete',newEventIds:[],newEvents:[],
      eventCount:runtime.state.events.length,tick:runtime.state.tick,complete:true,workspacePolicy:policy,state:clone(runtime.state)
    });

    const stage=LIVE_STAGE_ORDER[stageIndex++];
    const beforeCount=runtime.state.events.length;
    const {state,makeEvent,pushEvent}=runtime;

    switch(stage){
      case 'sensorium':
        observations=perceiveV0({makeEvent,pushEvent,score:scoreV0,fixture:sourceFixture});
        break;
      case 'local-processing':
        state.candidates=localProcessV0(observations,{makeEvent,pushEvent,score:scoreV0});
        break;
      case 'global-workspace':':
        break;
    }

    if(stage==='global-workspace'){
      const competition=competitionWithPolicy(state,{makeEvent,pushEvent},policy);
      state.workspace=competition.winners;
      state.suppressed=competition.suppressed;
    }else if(stage==='world-model'){
      worldResult=updateWorldModelV0(state.workspace,{makeEvent,pushEvent});
      state.world=worldResult.world;
    }else if(stage==='self-model'){
      selfResult=updateSelfModelV0(state.workspace,{makeEvent,pushEvent,architectureVersion:V0_ARCHITECTURE_VERSION,workspaceCapacity:V0_WORKSPACE_CAPACITY});
      state.self=selfResult.self;
    }else if(stage==='counterfactual'){
      counterfactualResult=generateCounterfactualsV0({workspace:state.workspace,world:state.world,self:state.self},{makeEvent,pushEvent});
      state.counterfactual=counterfactualResult.counterfactual;
    }else if(stage==='metacognition'){
      metaResult=metacognizeV0({...state,counterfactualEvent:counterfactualResult.event},{makeEvent,pushEvent});
      state.meta=metaResult.meta;
    }else if(stage==='homeostasis'){
      homeostasisResult=assessHomeostasisV0(state,metaResult.event,{makeEvent,pushEvent,workspaceCapacity:V0_WORKSPACE_CAPACITY});
      state.homeostasis=homeostasisResult.homeostasis;
    }else if(stage==='guardian'){
      const proposedCandidate=state.counterfactual.candidates.find(candidate=>candidate.id===state.counterfactual.recommendedCandidateId)??null;
      guardResult=guardianGateV0({metaEvent:metaResult.event,homeostasisEvent:homeostasisResult.event,counterfactualEvent:counterfactualResult.event,proposedCandidate,homeostasis:state.homeostasis},{makeEvent,pushEvent});
      state.guardian=guardResult.guardian;
    }else if(stage==='executive'){
      executiveResult=executiveSelectV0({counterfactual:state.counterfactual,counterfactualEvent:counterfactualResult.event,guardian:state.guardian,guardianEvent:guardResult.event},{makeEvent,pushEvent});
      state.executive=executiveResult.executive;
    }else if(stage==='expression'){
      state.expression=expressV0({executive:state.executive,executiveEvent:executiveResult.event,workspace:state.workspace,meta:state.meta},{makeEvent,pushEvent});
      state.traceRoot=state.expression?.id??executiveResult.event.id;
    }

    return recordStep(stage,beforeCount);
  }

  return Object.freeze({
    step,
    snapshot:()=>clone(runtime.state),
    stage:()=>LIVE_STAGE_ORDER[stageIndex]??'complete',
    isComplete:()=>stageIndex>=LIVE_STAGE_ORDER.length,
    setFixture:fixture=>{if(stageIndex!==0)throw new Error('fixture can only change before a cycle starts');sourceFixture=[...fixture];},
    setWorkspacePolicy:next=>{if(stageIndex>2)throw new Error('workspace policy cannot change after competition');policy=normalizePolicy(next);},
    reset:({fixture=sourceFixture,workspacePolicy=policy,cycle=cycleNumber+1}={})=>{sourceFixture=[...fixture];policy=normalizePolicy(workspacePolicy);cycleNumber=cycle;initialize();return clone(runtime.state);},
    describe:()=>({cycle:cycleNumber,stageIndex,nextStage:LIVE_STAGE_ORDER[stageIndex]??'complete',workspacePolicy:policy,architectureVersion:V0_ARCHITECTURE_VERSION,fixtureSize:sourceFixture.length})
  });
}
