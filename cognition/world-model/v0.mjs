export function updateWorldModelV0(globals, { makeEvent, pushEvent }) {
  const texts=globals.map(g=>String(g.content));
  const evidence=globals.map(g=>g.id);
  const world={
    status:'updated from globally available evidence only',
    activeHumanInstruction:texts.some(t=>t.includes('human supplied')),
    runtimeChangeObserved:texts.some(t=>t.includes('Memory utilization')),
    accessibleEventCount:globals.length,
    evidence
  };
  const event=pushEvent(makeEvent({id:'model-world',source:'WorldModel',type:'model.update',content:world,confidence:.96,salience:.5,causalParents:evidence,epistemicStatus:'inference',globallyAvailable:true}));
  return { world, event };
}
