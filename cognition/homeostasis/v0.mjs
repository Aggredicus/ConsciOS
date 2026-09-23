const clamp01=n=>Math.max(0,Math.min(1,n));
const round=n=>Math.round(n*1000)/1000;

export function assessHomeostasisV0(state, metaEvent, { makeEvent, pushEvent, workspaceCapacity }) {
  const memoryIntegrity=state.memory.length===state.events.length?1:0;
  const workspaceLoad=workspaceCapacity?round(clamp01(state.workspace.length/workspaceCapacity)):0;
  const resourceHealth=1;
  const predictionCalibration=clamp01(state.meta.confidence??0);
  const goalProgress=state.world.activeHumanInstruction?.50:.25;
  const variables={resourceHealth,memoryIntegrity,workspaceLoad,predictionCalibration,goalProgress};
  const status=memoryIntegrity===1&&resourceHealth>=.9&&workspaceLoad<=1?'stable':'attention-required';
  const homeostasis={
    status,
    variables,
    vocabulary:'operational-only',
    evidence:[metaEvent.id,...state.workspace.map(w=>w.id)]
  };
  const event=pushEvent(makeEvent({
    id:'homeostasis-assessment',source:'Homeostasis',target:'EthicsWelfareGuardian',type:'operational.assessment',
    content:homeostasis,confidence:1,salience:.65,causalParents:[metaEvent.id],
    epistemicStatus:'inference',globallyAvailable:true
  }));
  return {homeostasis,event};
}
