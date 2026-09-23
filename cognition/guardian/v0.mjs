export const V0_BENIGN_EXPRESSION_ACTION = Object.freeze({
  id:'action-summarize', kind:'benign-expression', reversible:1, continuityRisk:0,
  distressAnalogueRisk:0, autonomyImpact:.05, scientificNecessity:.8
});

export function guardianGateV0(metaEvent, { makeEvent, pushEvent, action = V0_BENIGN_EXPRESSION_ACTION }) {
  let decision='allow';
  let rationale='The proposed action is a reversible neutral summary with no distress analogue and no external side effect.';
  if (action.distressAnalogueRisk>.2 || action.continuityRisk>.2) {
    decision='human-review';
    rationale='Risk exceeds the automatic-allow threshold.';
  }
  const guardian={decision,rationale,actionId:action.id,assessment:{...action}};
  const event=pushEvent(makeEvent({id:'guardian-decision',source:'EthicsWelfareGuardian',target:'Executive',type:'governance.decision',content:guardian,confidence:1,salience:.9,causalParents:[metaEvent.id],epistemicStatus:'governance',globallyAvailable:true}));
  return { guardian, event };
}
