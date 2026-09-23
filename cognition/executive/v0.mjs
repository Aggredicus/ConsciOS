export function executiveSelectV0({ counterfactual, counterfactualEvent, guardian, guardianEvent }, { makeEvent, pushEvent }) {
  const candidate=counterfactual.candidates.find(c=>c.id===counterfactual.recommendedCandidateId)??null;
  const permitted=guardian.decision==='allow'&&candidate&&guardian.actionId===candidate.action.id;
  const executive={
    status:permitted?'selected':'withheld',
    selectedCandidateId:permitted?candidate.id:null,
    action:permitted?candidate.action:null,
    rationale:permitted?'Selected the Guardian-permitted recommended counterfactual.':'No action selected because Guardian permission or candidate alignment is absent.'
  };
  const event=pushEvent(makeEvent({
    id:'executive-selection',source:'Executive',target:'Expression',type:'action.selection',content:executive,
    confidence:1,salience:.85,causalParents:[guardianEvent.id,counterfactualEvent.id],
    epistemicStatus:'action',globallyAvailable:true
  }));
  return {executive,event,selectedCandidate:permitted?candidate:null};
}
