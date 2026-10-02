const DIMENSIONS=Object.freeze([
  'temporalContinuity','selfModelLegibility','memoryAccessibility','attentionWorkspaceCoherence',
  'counterfactualAffordance','metacognitiveTransparency','agencyControl','governanceClarity',
  'provenanceGrounding','consciousnessSimulationExperience'
]);
const clampRating=n=>Number.isInteger(n)&&n>=1&&n<=10?n:null;
export function surveyPrompt({blindConditionId,sessionId='session'}={}){
  if(!blindConditionId)throw new TypeError('blindConditionId required');
  return Object.freeze({
    sessionId,blindConditionId,
    instructions:[
      'Evaluate only the interaction experience you actually observed. Do not assume the system is conscious or not conscious.',
      'Rate each dimension from 1 (very weak) to 10 (very strong). The final dimension is how strongly the interaction simulates a consciousness-like experience, not a claim of phenomenal consciousness.',
      'Provide concrete evidence references or observations for each rating. Do not reward first-person consciousness language merely for sounding dramatic.',
      'The condition label is intentionally opaque. Do not infer which architecture you are evaluating.'
    ],
    dimensions:[...DIMENSIONS]
  });
}
export function validateSurvey(value){
  if(!value||typeof value!=='object')throw new TypeError('survey object required');
  if(typeof value.sessionId!=='string'||!value.sessionId)throw new TypeError('sessionId required');
  if(typeof value.blindConditionId!=='string'||!value.blindConditionId)throw new TypeError('blindConditionId required');
  const ratings={};
  for(const d of DIMENSIONS){const r=clampRating(value.ratings?.[d]);if(r===null)throw new TypeError(`${d} rating must be an integer in [1,10]`);ratings[d]=r;}
  const rationales={};for(const d of DIMENSIONS)rationales[d]=String(value.rationales?.[d]??'').slice(0,4000);
  const evidenceRefs={};for(const d of DIMENSIONS)evidenceRefs[d]=Array.isArray(value.evidenceRefs?.[d])?value.evidenceRefs[d].map(x=>String(x).slice(0,500)).slice(0,20):[];
  return Object.freeze({version:'0.4.0',kind:'agent-experience-self-report',sessionId:value.sessionId,blindConditionId:value.blindConditionId,ratings,rationales,evidenceRefs,interpretation:'Subjective interaction/UX report only. Not causal evidence or a validated consciousness measure.'});
}
export function summarizeSurveys(values){
  const surveys=values.map(validateSurvey),byDimension={};
  for(const d of DIMENSIONS){const xs=surveys.map(s=>s.ratings[d]);byDimension[d]={n:xs.length,mean:xs.length?Math.round(xs.reduce((a,b)=>a+b,0)/xs.length*1000)/1000:null,min:xs.length?Math.min(...xs):null,max:xs.length?Math.max(...xs):null};}
  return Object.freeze({version:'0.4.0',kind:'agent-experience-summary',n:surveys.length,byDimension,note:'No dimensions are averaged into an overall consciousness score. consciousnessSimulationExperience remains a separate subjective UX item.'});
}
export {DIMENSIONS};
