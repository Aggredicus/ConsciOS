function unique(values){return [...new Set((values??[]).filter(value=>typeof value==='string'&&value.length>0))]}
function intersection(values,known){const set=new Set(known);return unique(values).filter(value=>set.has(value))}
function clamp01(value){return Math.max(0,Math.min(1,value))}
function round(value){return Math.round(value*1000)/1000}

export function createActionEffectPrediction({executive,executiveEvent}){
  if(!executive||executive.status!=='selected'||!executive.action)throw new Error('agency prediction requires an Executive-selected action');
  if(!executiveEvent?.id)throw new Error('agency prediction requires the Executive event ID');
  const expectedEffects=[];
  if(executive.action.kind==='neutral-summary')expectedEffects.push({type:'expression.report',target:'Human'});
  return Object.freeze({
    predictionId:`agency-prediction-${executive.action.id}`,
    actionId:executive.action.id,
    actionKind:executive.action.kind,
    executiveEventId:executiveEvent.id,
    expectedEffects,
    expectedCausalParentId:executiveEvent.id,
    confidence:expectedEffects.length?.98:.60,
    epistemicStatus:'prediction'
  });
}

function effectAgreement(prediction,transition){
  if(prediction.expectedEffects.length===0)return {matched:false,typeMatch:false,targetMatch:false};
  const expected=prediction.expectedEffects[0];
  const typeMatch=transition.type===expected.type;
  const targetMatch=transition.target===expected.target;
  return {matched:typeMatch&&targetMatch,typeMatch,targetMatch};
}

export function attributeAgency(prediction,transition,{selfActionCauseIds=[],externalActionCauseIds=[]}={}){
  if(!prediction?.predictionId)throw new TypeError('prediction is required');
  if(!transition?.id)throw new TypeError('transition is required');
  const parents=unique(transition.causalParents);
  const selfEvidence=intersection(parents,selfActionCauseIds);
  const externalEvidence=intersection(parents,externalActionCauseIds);
  const predictedParentPresent=parents.includes(prediction.expectedCausalParentId);
  const agreement=effectAgreement(prediction,transition);

  let attribution='ambiguous';
  let confidence=.25;
  let rationale='Causal evidence is insufficient to assign the transition to self or environment.';

  if(selfEvidence.length>0&&externalEvidence.length===0&&predictedParentPresent&&agreement.matched){
    attribution='self-caused';
    confidence=.98;
    rationale='A known self-action cause is a direct causal parent and the observed effect matches the pre-action prediction.';
  }else if(externalEvidence.length>0&&selfEvidence.length===0){
    attribution='externally-caused';
    confidence=.97;
    rationale='A known external action cause is a direct causal parent and no known self-action cause is present.';
  }else if(selfEvidence.length>0&&externalEvidence.length===0){
    attribution='ambiguous';
    confidence=agreement.matched?.62:.48;
    rationale='Self-action provenance exists, but predicted-effect or expected-parent evidence is incomplete.';
  }else if(selfEvidence.length>0&&externalEvidence.length>0){
    attribution='ambiguous';
    confidence=.40;
    rationale='Both self-action and external-action causes appear in direct provenance.';
  }else if(agreement.matched){
    attribution='ambiguous';
    confidence=.35;
    rationale='The surface effect matches the prediction, but no trusted action provenance identifies its cause.';
  }

  return Object.freeze({
    transitionId:transition.id,
    predictionId:prediction.predictionId,
    attribution,
    confidence:round(clamp01(confidence)),
    rationale,
    evidence:{
      causalParents:parents,
      selfActionCauseIds:selfEvidence,
      externalActionCauseIds:externalEvidence,
      predictedParentPresent,
      effectAgreement:agreement
    },
    ignoredClaims:{
      claimedCause:transition.metadata?.claimedCause??null,
      note:'Human-readable cause claims are retained for audit but do not determine attribution.'
    }
  });
}
