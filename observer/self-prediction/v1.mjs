import { predictWorkspacePolicyOutcome } from '../../cognition/self-model/self-prediction.mjs';
import { createPrePolicyCandidateFactsV0, runShadowWorkspacePolicyV0 } from './shadow-workspace-runtime.mjs';

const POLICIES=['raw-top-k','hard-source-diversity','soft-diversity'];
function rootIds(state){
  const candidateById=new Map(state.candidates.map(candidate=>[candidate.id,candidate]));
  return state.workspace.map(broadcast=>candidateById.get(broadcast.causalParents[0])?.causalParents?.[0]??null);
}
function observedSummary(state){
  const roots=rootIds(state);
  const expression=state.expression?.content??'';
  return {
    winnerCount:state.workspace.length,
    selectedCandidateIds:state.workspace.map(broadcast=>broadcast.causalParents[0]),
    selectedRootObservationIds:roots,
    distinctRootObservationCount:new Set(roots).size,
    suppressedCandidateCount:state.suppressed.length,
    world:{
      activeHumanInstruction:state.world.activeHumanInstruction,
      runtimeChangeObserved:state.world.runtimeChangeObserved,
      accessibleEventCount:state.world.accessibleEventCount
    },
    metaConfidence:state.meta.confidence,
    expressionFeatures:{
      mentionsHumanInstruction:expression.includes('new human instruction'),
      mentionsRuntimeMemory:expression.includes('runtime-memory change'),
      expectedConfidence:state.meta.confidence
    }
  };
}
function compare(predicted,observed){
  const exactFields=['winnerCount','distinctRootObservationCount','suppressedCandidateCount'];
  const exactResults=exactFields.map(field=>({field,match:predicted[field]===observed[field]}));
  const arrayFields=['selectedCandidateIds','selectedRootObservationIds'];
  for(const field of arrayFields)exactResults.push({field,match:JSON.stringify(predicted[field])===JSON.stringify(observed[field])});
  for(const field of ['activeHumanInstruction','runtimeChangeObserved','accessibleEventCount'])exactResults.push({field:`world.${field}`,match:predicted.world[field]===observed.world[field]});
  for(const field of ['mentionsHumanInstruction','mentionsRuntimeMemory'])exactResults.push({field:`expressionFeatures.${field}`,match:predicted.expressionFeatures[field]===observed.expressionFeatures[field]});
  const metaAbsoluteError=Math.abs(predicted.metaConfidence-observed.metaConfidence);
  const expressionConfidenceAbsoluteError=Math.abs(predicted.expressionFeatures.expectedConfidence-observed.expressionFeatures.expectedConfidence);
  return {
    exactResults,
    exactAccuracy:exactResults.filter(result=>result.match).length/exactResults.length,
    metaAbsoluteError,
    expressionConfidenceAbsoluteError,
    allExact:exactResults.every(result=>result.match)&&metaAbsoluteError===0&&expressionConfidenceAbsoluteError===0
  };
}

export function runSelfPredictionLabV1(){
  const candidateFacts=createPrePolicyCandidateFactsV0();
  const predictions=POLICIES.map(policy=>predictWorkspacePolicyOutcome(candidateFacts,{policy,capacity:2,redundancyPenalty:.25}));
  const observations=POLICIES.map(policy=>({policy,state:runShadowWorkspacePolicyV0(policy,{capacity:2,redundancyPenalty:.25})}));
  const trials=predictions.map(prediction=>{
    const observed=observedSummary(observations.find(item=>item.policy===prediction.policy).state);
    return {policy:prediction.policy,prediction,observed,evaluation:compare(prediction.predicted,observed)};
  });
  return Object.freeze({
    id:'self-prediction-lab-v1.3',
    owner:'ObserverScientist',
    causalAuthority:'none',
    preRegistration:'All three predictions are generated from pre-policy candidate facts before any shadow policy runtime is executed.',
    trials,
    metrics:{
      trialCount:trials.length,
      exactTrialAccuracy:trials.filter(trial=>trial.evaluation.allExact).length/trials.length,
      meanExactFieldAccuracy:trials.reduce((sum,trial)=>sum+trial.evaluation.exactAccuracy,0)/trials.length,
      meanMetaAbsoluteError:trials.reduce((sum,trial)=>sum+trial.evaluation.metaAbsoluteError,0)/trials.length
    }
  });
}
