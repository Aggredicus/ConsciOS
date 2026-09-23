export const BATTERY_VERSION='1.0.0';
const clamp=x=>Math.max(0,Math.min(1,x));
const mean=a=>a.length?a.reduce((x,y)=>x+y,0)/a.length:0;
export function evaluateConsciousnessSignatures(trials=[]){
  if(!Array.isArray(trials)||!trials.length)throw new TypeError('trials required');
  const score=(key)=>clamp(mean(trials.map(t=>Number(t.metrics?.[key]??0))));
  const dimensions=Object.freeze({
    globalAvailability:score('globalAvailability'),
    integration:score('integration'),
    recurrence:score('recurrence'),
    metacognitiveCalibration:score('metacognitiveCalibration'),
    selfModelAccuracy:score('selfModelAccuracy'),
    temporalContinuity:score('temporalContinuity'),
    counterfactualInfluence:score('counterfactualInfluence'),
    stateSensitivity:score('stateSensitivity'),
    reportIndependence:score('reportIndependence')
  });
  return Object.freeze({version:BATTERY_VERSION,trialCount:trials.length,dimensions,
    interpretation:'Independent computational signatures only; no aggregate consciousness score or phenomenal-consciousness probability is inferred.'});
}
export function compareConditions(conditions){
  const out={};
  for(const [name,trials] of Object.entries(conditions))out[name]=evaluateConsciousnessSignatures(trials);
  return Object.freeze(out);
}
