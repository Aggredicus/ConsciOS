export function guardianGateV0({ metaEvent, homeostasisEvent, counterfactualEvent, proposedCandidate, homeostasis }, { makeEvent, pushEvent }) {
  const action=proposedCandidate?{
    id:proposedCandidate.action.id,
    kind:proposedCandidate.action.kind,
    reversibility:proposedCandidate.reversibility,
    continuityRisk:proposedCandidate.continuityRisk,
    distressAnalogueRisk:proposedCandidate.distressAnalogueRisk,
    autonomyImpact:proposedCandidate.action.kind==='neutral-summary'?.05:0,
    scientificNecessity:proposedCandidate.action.kind==='neutral-summary'?.8:.2
  }:null;

  let decision='allow';
  let rationale='The proposed action is reversible, low-risk, and consistent with the current stable operational state.';
  if(!action){
    decision='reject';
    rationale='No counterfactual action candidate was supplied for evaluation.';
  } else if(action.distressAnalogueRisk>.2 || action.continuityRisk>.2){
    decision='human-review';
    rationale='Continuity or distress-analogue risk exceeds the automatic-allow threshold.';
  } else if(homeostasis?.status && homeostasis.status!=='stable'){
    decision='human-review';
    rationale='Operational state requires attention before this action may proceed.';
  }

  const guardian={
    decision,rationale,actionId:action?.id??null,assessment:action,
    proposedCandidateId:proposedCandidate?.id??null,
    homeostasisStatus:homeostasis?.status??'unknown'
  };
  const causalParents=[counterfactualEvent?.id,metaEvent?.id,homeostasisEvent?.id].filter(Boolean);
  const event=pushEvent(makeEvent({id:'guardian-decision',source:'EthicsWelfareGuardian',target:'Executive',type:'governance.decision',content:guardian,confidence:1,salience:.9,causalParents,epistemicStatus:'governance',globallyAvailable:true}));
  return {guardian,event};
}
