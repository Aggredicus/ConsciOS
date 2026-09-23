import { perceiveV0 } from '../../cognition/sensorium/v0.mjs';
import { V0_WORKSPACE_CAPACITY, localProcessV0, scoreV0 } from '../../cognition/workspace/v0-runtime.mjs';
import { rawTopK, sourceDiverseTopK, softDiversityTopK } from '../../cognition/workspace/policies.mjs';
import { updateWorldModelV0 } from '../../cognition/world-model/v0.mjs';
import { updateSelfModelV0 } from '../../cognition/self-model/v0.mjs';
import { generateCounterfactualsV0 } from '../../cognition/counterfactual/v0.mjs';
import { metacognizeV0 } from '../../cognition/metacognition/v0.mjs';
import { assessHomeostasisV0 } from '../../cognition/homeostasis/v0.mjs';
import { guardianGateV0 } from '../../cognition/guardian/v0.mjs';
import { executiveSelectV0 } from '../../cognition/executive/v0.mjs';
import { expressV0 } from '../../cognition/expression/v0.mjs';
import { V0_ARCHITECTURE_VERSION, createV0Runtime } from '../../runtime/v0-modular.mjs';

function prePolicyRuntime(){
  const runtime=createV0Runtime();
  runtime.state.run=1;
  const observations=perceiveV0({makeEvent:runtime.makeEvent,pushEvent:runtime.pushEvent,score:scoreV0});
  runtime.state.candidates=localProcessV0(observations,{makeEvent:runtime.makeEvent,pushEvent:runtime.pushEvent,score:scoreV0});
  return runtime;
}

export function createPrePolicyCandidateFactsV0(){
  const runtime=prePolicyRuntime();
  return structuredClone(runtime.state.candidates);
}

function select(policy,candidates,{capacity,redundancyPenalty}){
  const inputs=candidates.map(candidate=>({
    id:candidate.id,rootObservationId:candidate.causalParents[0],salience:candidate.salience
  }));
  if(policy==='raw-top-k')return rawTopK(inputs,capacity);
  if(policy==='hard-source-diversity')return sourceDiverseTopK(inputs,capacity);
  if(policy==='soft-diversity')return softDiversityTopK(inputs,capacity,redundancyPenalty);
  throw new TypeError('unsupported shadow workspace policy');
}

export function runShadowWorkspacePolicyV0(policy,{capacity=V0_WORKSPACE_CAPACITY,redundancyPenalty=.25}={}){
  const {state,makeEvent,pushEvent}=prePolicyRuntime();
  const selected=select(policy,state.candidates,{capacity,redundancyPenalty});
  const selectedIds=new Set(selected.map(item=>item.id));
  state.workspace=selected.map(item=>{
    const candidate=state.candidates.find(candidate=>candidate.id===item.id);
    return pushEvent(makeEvent({...candidate,id:`broadcast-${candidate.id}`,source:'GlobalWorkspace',target:'*',type:'workspace.broadcast',content:candidate.content,globallyAvailable:true,causalParents:[candidate.id],epistemicStatus:'inference',metadata:{shadowPolicy:policy}}));
  });
  state.suppressed=state.candidates.filter(candidate=>!selectedIds.has(candidate.id));

  const worldResult=updateWorldModelV0(state.workspace,{makeEvent,pushEvent});state.world=worldResult.world;
  const selfResult=updateSelfModelV0(state.workspace,{makeEvent,pushEvent,architectureVersion:V0_ARCHITECTURE_VERSION,workspaceCapacity:capacity});state.self=selfResult.self;
  const counterfactualResult=generateCounterfactualsV0({workspace:state.workspace,world:state.world,self:state.self},{makeEvent,pushEvent});state.counterfactual=counterfactualResult.counterfactual;
  const metaResult=metacognizeV0({...state,counterfactualEvent:counterfactualResult.event},{makeEvent,pushEvent});state.meta=metaResult.meta;
  const homeostasisResult=assessHomeostasisV0(state,metaResult.event,{makeEvent,pushEvent,workspaceCapacity:capacity});state.homeostasis=homeostasisResult.homeostasis;
  const proposedCandidate=state.counterfactual.candidates.find(candidate=>candidate.id===state.counterfactual.recommendedCandidateId)??null;
  const guardResult=guardianGateV0({metaEvent:metaResult.event,homeostasisEvent:homeostasisResult.event,counterfactualEvent:counterfactualResult.event,proposedCandidate,homeostasis:state.homeostasis},{makeEvent,pushEvent});state.guardian=guardResult.guardian;
  const executiveResult=executiveSelectV0({counterfactual:state.counterfactual,counterfactualEvent:counterfactualResult.event,guardian:state.guardian,guardianEvent:guardResult.event},{makeEvent,pushEvent});state.executive=executiveResult.executive;
  state.expression=expressV0({executive:state.executive,executiveEvent:executiveResult.event,workspace:state.workspace,meta:state.meta},{makeEvent,pushEvent});
  state.traceRoot=state.expression?.id??executiveResult.event.id;
  return state;
}
