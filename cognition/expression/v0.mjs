export function expressV0({ executive, executiveEvent, workspace, meta }, { makeEvent, pushEvent }) {
  if (executive.status!=='selected' || executive.action?.kind!=='neutral-summary') return null;
  const accessible=workspace.map(w=>String(w.content));
  const clauses=[];
  if (accessible.some(t=>t.includes('human supplied'))) clauses.push('A new human instruction is the most goal-relevant information currently available');
  if (accessible.some(t=>t.includes('Memory utilization'))) clauses.push('a modest runtime-memory change is also globally available and remains within the stable range');
  const text=clauses.length
    ? `${clauses.join('; ')}. My confidence in this summary is ${meta.confidence.toFixed(3)}. This output reports the deterministic functional state of ConsciOS v0 and is not evidence of subjective experience.`
    : 'No eligible globally available information is present for expression.';
  return pushEvent(makeEvent({id:'expression-1',source:'Expression',target:'Human',type:'expression.report',content:text,confidence:meta.confidence,salience:.7,causalParents:[executiveEvent.id,...workspace.map(w=>w.id)],epistemicStatus:'expression',globallyAvailable:true}));
}
