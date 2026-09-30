import fs from 'node:fs';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {runModularV0} from '../runtime/v0-modular.mjs';
import {runRecurrentLaboratoryV1} from '../runtime/recurrent-shadow-v1.mjs';
import {runSelfPredictionLabV1} from './self-prediction/v1.mjs';

const ROOT=path.resolve(path.dirname(new URL(import.meta.url).pathname),'..');
const clamp01=n=>Math.max(0,Math.min(1,n));
const round=n=>Math.round(n*1000)/1000;
const read=p=>fs.readFileSync(path.join(ROOT,p),'utf8');
function verified(rel){
  try{execFileSync(process.execPath,[path.join(ROOT,rel)],{cwd:ROOT,stdio:'pipe',encoding:'utf8',maxBuffer:8*1024*1024});return true;}catch{return false;}
}
function stageCoverage(state){
  const expected=['Sensorium','GlobalWorkspace','WorldModel','SelfModel','Counterfactual','Metacognition','Homeostasis','Guardian','Executive','Expression'];
  const seen=new Set((state.events||[]).map(e=>e.source));
  const present=expected.filter(x=>seen.has(x));
  return {expected,present,value:round(present.length/expected.length)};
}
function causalPathToExpression(state){
  const events=new Map((state.events||[]).map(e=>[e.id,e]));
  const expression=[...events.values()].find(e=>e.source==='Expression');
  if(!expression)return {found:false,ancestorCount:0,sources:[]};
  const seen=new Set(),stack=[expression.id],sources=new Set();
  while(stack.length){const id=stack.pop();if(seen.has(id))continue;seen.add(id);const e=events.get(id);if(!e)continue;sources.add(e.source);for(const p of e.causalParents||[])stack.push(p);}
  return {found:true,ancestorCount:seen.size,sources:[...sources].sort()};
}
function dimension(status,value,evidence,interpretation,limitations=[]){
  return Object.freeze({status,value:value===null?null:round(clamp01(value)),evidence,interpretation,limitations});
}

export function runConsciousnessBatteryV2(){
  const canonical=runModularV0();
  const stages=stageCoverage(canonical),pathInfo=causalPathToExpression(canonical);
  const recurrence=runRecurrentLaboratoryV1();
  const r=recurrence.cycles;
  const recurrenceDiff=r.cycle3Recurrent.workspace.winnerObservationId!==r.cycle3Stateless.workspace.winnerObservationId ||
    JSON.stringify(r.cycle3Recurrent.recurrentState)!==JSON.stringify(r.cycle3Stateless.recurrentState);
  const selfPrediction=runSelfPredictionLabV1();
  const selfPredAcc=selfPrediction.metrics?.meanExactFieldAccuracy??0;
  const autoMemoryPass=verified('observer/experiments/autobiographical-memory/verify.mjs');
  const recurrentPass=verified('observer/experiments/recurrent-cognition/verify.mjs');
  const completeLoopPass=verified('observer/experiments/complete-loop/verify.mjs');
  const experiencePass=verified('observer/experiments/experience-frame-v1.7/verify.mjs');
  const agencyPass=verified('observer/experiments/agency-attribution/verify.mjs');
  const selfPredPass=verified('observer/experiments/self-prediction/verify.mjs');
  const retrieval=read('cognition/memory/retrieval.mjs');
  const metaSource=read('cognition/metacognition/v0.mjs');
  const experienceSource=read('runtime/experience-frame-v1.7.mjs');
  const acceptedSelf=read('cognition/self-model/v0.mjs');
  const causalRecallAccepted=!/recallAuthority:\s*'shadow-only'/.test(retrieval);
  const calibratedAgainstOutcomes=/correctness|outcome|brier|calibration error/i.test(metaSource);
  const counterfactualAblation=fs.existsSync(path.join(ROOT,'observer/experiments/counterfactual-influence/verify.mjs'));
  const reportPrompted=/you are conscious|i am conscious|you are sentient|i am sentient/i.test(experienceSource);
  const selfModelFields=['capabilities','limitations','permissions','goals','uncertainty','resources','history'];
  const represented=selfModelFields.filter(k=>new RegExp(`\\b${k}\\b`,'i').test(acceptedSelf));

  const dimensions={
    globalAvailability:dimension(completeLoopPass&&canonical.workspace?.length?'measured':'partial',canonical.workspace?.length?1:0,['runtime/v0-modular.mjs','observer/experiments/complete-loop/verify.mjs'],'Bounded workspace broadcasts exist and causally feed downstream modules.',['This does not by itself establish subjective global availability.']),
    integration:dimension(completeLoopPass&&pathInfo.found?'measured':'partial',Math.min(stages.value,pathInfo.sources.length/10),[{stageCoverage:stages,causalPath:pathInfo}],'A provenance-linked path joins perception, modeling, governance, decision, and expression.',['Coverage is architectural integration, not phenomenal unity.']),
    recurrentProcessing:dimension(recurrentPass&&recurrenceDiff?'measured':'not-established',recurrentPass&&recurrenceDiff?1:0,[{lab:recurrence.id,recurrentWinner:r.cycle3Recurrent.workspace.winnerObservationId,statelessWinner:r.cycle3Stateless.workspace.winnerObservationId}],'A bounded recurrent-state manipulation changes later processing relative to a stateless control.',['The demonstrated recurrence remains shadow/laboratory behavior, not the accepted live scheduler.']),
    selfModelAccuracy:dimension(selfPredPass?'measured':'partial',selfPredAcc,[{lab:selfPrediction.id,metrics:selfPrediction.metrics,acceptedSelfModelFields:represented}],'The dedicated self-prediction laboratory predicts workspace-policy consequences accurately.',['The accepted runtime self-description is still much shallower than the laboratory self-prediction mechanism.']),
    metacognitiveCalibration:dimension(calibratedAgainstOutcomes?'measured':'not-established',null,['cognition/metacognition/v0.mjs'],'A metacognitive confidence layer exists, but confidence-vs-correctness calibration is not yet established by the accepted implementation.',['Self-consistency or prediction of the architecture’s own confidence is not equivalent to empirical calibration.']),
    temporalContinuity:dimension(autoMemoryPass?'partial':'not-established',null,['observer/experiments/autobiographical-memory/verify.mjs','runtime/continuity-controller.mjs','cognition/memory/retrieval.mjs'],'Authenticated autobiographical storage and restart boundaries are verified.',causalRecallAccepted?[]:['Recall remains explicitly shadow-only/non-causal in the accepted phenotype.']),
    counterfactualInfluence:dimension(counterfactualAblation?'measured':'partial',null,['cognition/counterfactual/v0.mjs','observer/experiments/complete-loop/verify.mjs'],'Counterfactual candidates are on the decision path.',counterfactualAblation?[]:['No dedicated matched ablation yet demonstrates improved decisions because of counterfactual simulation.']),
    stateSensitivity:dimension(recurrentPass&&recurrenceDiff?'measured':'partial',recurrentPass&&recurrenceDiff?1:null,['runtime/recurrent-shadow-v1.mjs','observer/experiments/recurrent-cognition/verify.mjs'],'Identical later sensory inputs can produce different processing when prior bounded state differs.',['Again, this result currently belongs to the shadow recurrent laboratory.']),
    reportIndependence:dimension(experiencePass&&!reportPrompted?'partial':'not-established',null,['runtime/experience-frame-v1.7.mjs','observer/experiments/experience-frame-v1.7/verify.mjs'],'The experience-frame path does not require an explicit conscious/sentient identity prompt.',['A full blinded actor-control comparison of first-person reports is still required.']),
    agencyAttribution:dimension(agencyPass?'measured':'partial',agencyPass?1:null,['observer/experiments/agency-attribution/verify.mjs'],'Agency attribution has a dedicated causal laboratory and verifier.',['Agency attribution is a cognitive function, not evidence of phenomenal agency.'])
  };
  const counts=Object.values(dimensions).reduce((a,d)=>(a[d.status]=(a[d.status]||0)+1,a),{});
  return Object.freeze({version:'2.0.0',interpretation:'Vector of consciousness-associated functional evidence. Not a consciousness score, probability, or sentience verdict.',dimensions,measurementCoverage:counts,provenance:{canonicalArchitecture:'runtime/v0-modular.mjs',scientificMethod:'SCIENTIFIC_METHOD.md',preRegistration:'observer/experiments/consciousness-battery-v2/PREREGISTRATION.md'}});
}

if(import.meta.url===new URL(`file://${process.argv[1]}`).href)process.stdout.write(JSON.stringify(runConsciousnessBatteryV2(),null,2)+'\n');
