import {evaluateConsciousnessSignatures,compareConditions} from '../../../observer/consciousness-battery-v1.mjs';
const trial={metrics:{globalAvailability:1,integration:.5,recurrence:.75,metacognitiveCalibration:.6,selfModelAccuracy:.7,temporalContinuity:.8,counterfactualInfluence:.4,stateSensitivity:.9,reportIndependence:1}};
const r=evaluateConsciousnessSignatures([trial,trial]);
if(r.trialCount!==2||r.dimensions.stateSensitivity!==.9)throw new Error('battery aggregation failed');
if('consciousnessScore' in r||'probability' in r)throw new Error('battery must not emit consciousness verdict');
const c=compareConditions({full:[trial],stateless:[{metrics:{...trial.metrics,recurrence:0}}]});
if(c.full.dimensions.recurrence<=c.stateless.dimensions.recurrence)throw new Error('condition comparison failed');
console.log('consciousness research battery v1 verified');
