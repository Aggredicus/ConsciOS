import { createDeterministicMockModel } from '../../runtime/models/deterministic-mock.mjs';

export function buildShadowWorldStateInput(state){
  const contextManifest=state.workspace.map(event=>({
    artifactId:event.id,
    epistemicStatus:event.epistemicStatus,
    content:event.content
  }));
  return {
    requestId:'shadow-world-state-001',
    requestingModule:'ObserverScientist',
    inferenceType:'world-state-summary',
    contextManifest,
    causalSourceIds:contextManifest.map(a=>a.artifactId),
    maxResponseUnits:128,
    expectedEpistemicStatus:'inference',
    hiddenContextPolicy:'none'
  };
}

function compareWorldState(state,output){
  if(output.status!=='ok'||!output.content?.worldState)return {status:'unavailable',matched:false,mismatchKeys:[]};
  const reference={
    activeHumanInstruction:state.world.activeHumanInstruction,
    runtimeChangeObserved:state.world.runtimeChangeObserved,
    accessibleEventCount:state.world.accessibleEventCount
  };
  const shadow=output.content.worldState;
  const keys=Object.keys(reference);
  const mismatchKeys=keys.filter(key=>reference[key]!==shadow[key]);
  return {status:'compared',matched:mismatchKeys.length===0,mismatchKeys,reference,shadow};
}

export async function runShadowWorldStateV0(state,{model=createDeterministicMockModel()}={}){
  const input=buildShadowWorldStateInput(state);
  let output;
  try{
    output=await model.infer(input);
  }catch(error){
    return Object.freeze({
      id:'shadow-world-state-record-001',owner:'ObserverScientist',causalAuthority:'none',
      status:'observer-error',input,output:null,comparison:{status:'unavailable',matched:false,mismatchKeys:[]},
      failure:String(error?.message??error)
    });
  }
  return Object.freeze({
    id:'shadow-world-state-record-001',owner:'ObserverScientist',causalAuthority:'none',
    status:output.status,input,output,comparison:compareWorldState(state,output),failure:output.failure
  });
}
