const clamp01 = n => Math.max(0,Math.min(1,n));
const round = n => Math.round(n*1000)/1000;

export function metacognizeV0({ workspace, suppressed, world, self }, { makeEvent, pushEvent }) {
  const evidence=[...world.evidence,...self.evidence];
  const raw=workspace.length ? workspace.reduce((a,e)=>a+e.confidence,0)/workspace.length : 0;
  const penalty=suppressed.length ? .06 : 0;
  const meta={
    confidence:round(clamp01(raw-penalty)),
    basis:[`Mean confidence of ${workspace.length} globally available broadcasts`,`Penalty ${penalty.toFixed(2)} for inaccessible competing candidates`],
    evidence
  };
  const event=pushEvent(makeEvent({id:'meta-assessment',source:'Metacognition',type:'confidence.assessment',content:meta,confidence:meta.confidence,salience:.55,causalParents:evidence,epistemicStatus:'inference',globallyAvailable:true}));
  return { meta, event };
}
