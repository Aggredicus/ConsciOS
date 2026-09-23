export function updateSelfModelV0(globals, { makeEvent, pushEvent, architectureVersion, workspaceCapacity }) {
  const runtimeEvidence=globals.filter(g=>String(g.content).includes('Memory utilization')).map(g=>g.id);
  const self={
    status:'operational deterministic browser process',
    architectureVersion,
    hasExternalLLM:false,
    workspaceCapacity,
    memoryCondition:runtimeEvidence.length?'stable with modest utilization increase':'no globally available runtime update',
    evidence:runtimeEvidence
  };
  const event=pushEvent(makeEvent({id:'model-self',source:'SelfModel',type:'model.update',content:self,confidence:.94,salience:.5,causalParents:runtimeEvidence,epistemicStatus:'inference',globallyAvailable:true}));
  return { self, event };
}
