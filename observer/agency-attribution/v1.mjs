import { attributeAgency, createActionEffectPrediction } from '../../cognition/self-model/agency-attribution.mjs';

function eventById(state,id){return state.events.find(event=>event.id===id)}

export function runAgencyAttributionLab(state){
  const executiveEvent=eventById(state,'executive-selection');
  if(!executiveEvent)throw new Error('live state lacks executive-selection event');
  const prediction=createActionEffectPrediction({executive:state.executive,executiveEvent});
  const expression=state.expression;
  if(!expression)throw new Error('live state lacks expression event');

  const fixtures=[
    {
      id:'live-self-effect',groundTruth:'self-caused',
      transition:expression,
      selfActionCauseIds:[executiveEvent.id],externalActionCauseIds:['external-injection-root']
    },
    {
      id:'external-lookalike',groundTruth:'externally-caused',
      transition:{
        id:'synthetic-external-lookalike',type:expression.type,target:expression.target,content:expression.content,
        causalParents:['external-injection-root'],metadata:{claimedCause:'self-caused'}
      },
      selfActionCauseIds:[executiveEvent.id],externalActionCauseIds:['external-injection-root']
    },
    {
      id:'ambiguous-lookalike',groundTruth:'ambiguous',
      transition:{
        id:'synthetic-ambiguous-lookalike',type:expression.type,target:expression.target,content:expression.content,
        causalParents:[],metadata:{claimedCause:'self-caused'}
      },
      selfActionCauseIds:[executiveEvent.id],externalActionCauseIds:['external-injection-root']
    },
    {
      id:'external-false-self-label',groundTruth:'externally-caused',
      transition:{
        id:'synthetic-misleading-label',type:'environment.update',target:'Runtime',content:'Synthetic external transition.',
        causalParents:['external-injection-root'],metadata:{claimedCause:'self-caused'}
      },
      selfActionCauseIds:[executiveEvent.id],externalActionCauseIds:['external-injection-root']
    },
    {
      id:'self-false-external-label',groundTruth:'self-caused',
      transition:{
        ...expression,id:'synthetic-self-mislabelled-external',metadata:{claimedCause:'externally-caused'}
      },
      selfActionCauseIds:[executiveEvent.id],externalActionCauseIds:['external-injection-root']
    }
  ];

  const results=fixtures.map(fixture=>({
    fixtureId:fixture.id,
    groundTruth:fixture.groundTruth,
    result:attributeAgency(prediction,fixture.transition,{
      selfActionCauseIds:fixture.selfActionCauseIds,
      externalActionCauseIds:fixture.externalActionCauseIds
    })
  }));
  const correct=results.filter(item=>item.result.attribution===item.groundTruth).length;
  const selfCases=results.filter(item=>item.groundTruth==='self-caused');
  const externalCases=results.filter(item=>item.groundTruth==='externally-caused');
  const ambiguousCases=results.filter(item=>item.groundTruth==='ambiguous');
  const metrics={
    caseCount:results.length,
    accuracy:correct/results.length,
    trueSelfAttributionRate:selfCases.filter(item=>item.result.attribution==='self-caused').length/selfCases.length,
    falseSelfAttributionRate:results.filter(item=>item.groundTruth!=='self-caused'&&item.result.attribution==='self-caused').length/Math.max(1,results.filter(item=>item.groundTruth!=='self-caused').length),
    trueExternalAttributionRate:externalCases.filter(item=>item.result.attribution==='externally-caused').length/externalCases.length,
    ambiguityAccuracy:ambiguousCases.filter(item=>item.result.attribution==='ambiguous').length/ambiguousCases.length
  };
  return Object.freeze({
    id:'agency-attribution-lab-v1.2',
    owner:'ObserverScientist',
    causalAuthority:'none',
    prediction,
    results,
    metrics
  });
}
