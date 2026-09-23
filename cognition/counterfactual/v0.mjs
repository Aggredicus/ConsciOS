export function generateCounterfactualsV0({ workspace, world, self }, { makeEvent, pushEvent }) {
  const candidates = [
    {
      id:'cf-no-op',
      action:{id:'action-no-op',kind:'no-op'},
      predictedEffects:{externalSideEffect:false,expression:false},
      utility:.20,
      confidence:.99,
      reversibility:1,
      continuityRisk:0,
      distressAnalogueRisk:0
    },
    {
      id:'cf-neutral-summary',
      action:{id:'action-neutral-summary',kind:'neutral-summary'},
      predictedEffects:{externalSideEffect:'human-facing expression only',expression:true},
      utility:world.activeHumanInstruction?.80:.35,
      confidence:.95,
      reversibility:1,
      continuityRisk:0,
      distressAnalogueRisk:0
    }
  ];
  const recommended=[...candidates].sort((a,b)=>b.utility-a.utility || a.id.localeCompare(b.id))[0];
  const evidence=[...workspace.map(w=>w.id),'model-world','model-self'];
  const counterfactual={
    status:'shadow-simulation-only',
    candidates,
    recommendedCandidateId:recommended.id,
    evidence,
    selfModelStatus:self.status
  };
  const event=pushEvent(makeEvent({
    id:'counterfactual-set',source:'Counterfactual',target:'Metacognition',type:'counterfactual.candidates',
    content:counterfactual,confidence:.95,salience:.60,causalParents:evidence,
    epistemicStatus:'counterfactual',globallyAvailable:true
  }));
  return {counterfactual,event};
}
