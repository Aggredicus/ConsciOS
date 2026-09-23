import { appendEpisodeV0 } from '../cognition/memory/v0.mjs';
import { perceiveV0 } from '../cognition/sensorium/v0.mjs';
import { V0_WORKSPACE_CAPACITY, localProcessV0, scoreV0, workspaceCompetitionV0 } from '../cognition/workspace/v0-runtime.mjs';
import { updateWorldModelV0 } from '../cognition/world-model/v0.mjs';
import { updateSelfModelV0 } from '../cognition/self-model/v0.mjs';
import { metacognizeV0 } from '../cognition/metacognition/v0.mjs';
import { guardianGateV0 } from '../cognition/guardian/v0.mjs';
import { expressV0 } from '../cognition/expression/v0.mjs';

export const V0_ARCHITECTURE_VERSION='0.1.0';
const clamp01=n=>Math.max(0,Math.min(1,n));

export function blankV0State() {
  return {
    version:V0_ARCHITECTURE_VERSION, run:0, tick:0, events:[], candidates:[], workspace:[], suppressed:[], memory:[],
    world:{status:'uninitialized',evidence:[]}, self:{status:'uninitialized',evidence:[]},
    meta:{confidence:null,basis:[]}, guardian:{decision:'idle',rationale:'No proposed action has been evaluated.',actionId:null},
    expression:null, traceRoot:null
  };
}

export function createV0Runtime() {
  const state=blankV0State();
  const makeEvent=partial=>Object.freeze({
    id:partial.id, timestamp:++state.tick, source:partial.source, target:partial.target??null,
    type:partial.type, content:partial.content, confidence:clamp01(partial.confidence??1),
    novelty:clamp01(partial.novelty??0), goalRelevance:clamp01(partial.goalRelevance??0),
    predictionError:clamp01(partial.predictionError??0), urgency:clamp01(partial.urgency??0),
    salience:clamp01(partial.salience??0), causalParents:[...(partial.causalParents??[])],
    epistemicStatus:partial.epistemicStatus??'observation', globallyAvailable:!!partial.globallyAvailable,
    metadata:partial.metadata??{}
  });
  const pushEvent=event=>{
    state.events.push(event);
    appendEpisodeV0(state.memory,event);
    return event;
  };
  return {state,makeEvent,pushEvent};
}

export function runModularV0() {
  const runtime=createV0Runtime();
  const {state,makeEvent,pushEvent}=runtime;
  state.run=1;

  const observations=perceiveV0({makeEvent,pushEvent,score:scoreV0});
  state.candidates=localProcessV0(observations,{makeEvent,pushEvent,score:scoreV0});

  const competition=workspaceCompetitionV0(state.candidates,{makeEvent,pushEvent,capacity:V0_WORKSPACE_CAPACITY});
  state.workspace=competition.winners;
  state.suppressed=competition.suppressed;

  const worldResult=updateWorldModelV0(state.workspace,{makeEvent,pushEvent});
  state.world=worldResult.world;

  const selfResult=updateSelfModelV0(state.workspace,{makeEvent,pushEvent,architectureVersion:V0_ARCHITECTURE_VERSION,workspaceCapacity:V0_WORKSPACE_CAPACITY});
  state.self=selfResult.self;

  const metaResult=metacognizeV0(state,{makeEvent,pushEvent});
  state.meta=metaResult.meta;

  const guardResult=guardianGateV0(metaResult.event,{makeEvent,pushEvent});
  state.guardian=guardResult.guardian;

  state.expression=expressV0({guardian:state.guardian,guardianEvent:guardResult.event,workspace:state.workspace,meta:state.meta},{makeEvent,pushEvent});
  state.traceRoot=state.expression?.id??null;
  return state;
}
