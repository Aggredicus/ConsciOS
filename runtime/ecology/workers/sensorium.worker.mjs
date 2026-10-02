import { bindWorkerEndpoint } from './endpoint.mjs';
import { createWorkerEventContext } from './event-context.mjs';
import { compileRuntimePhenotype } from '../phenotype-compiler.mjs';
import { shadowEnvelopeFromEvent } from '../cognitive-envelope-v1.mjs';
import { perceiveV0 } from '../../../cognition/sensorium/v0.mjs';

const V0_WEIGHTS=Object.freeze({novelty:.30,goalRelevance:.30,predictionError:.25,urgency:.15});
const scoreSensoriumV0=event=>{
  const raw=event.novelty*V0_WEIGHTS.novelty+
    event.goalRelevance*V0_WEIGHTS.goalRelevance+
    event.predictionError*V0_WEIGHTS.predictionError+
    event.urgency*V0_WEIGHTS.urgency;
  return Math.round(Math.max(0,Math.min(1,raw))*1000)/1000;
};

let configuration=null;

await bindWorkerEndpoint(async message=>{
  if(message?.kind==='configure'){
    const compiled=await compileRuntimePhenotype(message.program);
    if(compiled.phenotype.phenotypeHash!==message.phenotypeHash)throw new Error('Sensorium configuration phenotype hash mismatch');
    configuration=compiled;
    return {kind:'configured',role:'Sensorium',phenotypeHash:compiled.phenotype.phenotypeHash,networkCapability:false};
  }
  if(message?.kind!=='run-fixture-v0')throw new Error(`Sensorium worker rejects command ${message?.kind??'<missing>'}`);
  if(!configuration)throw new Error('Sensorium worker is not configured');
  const runtime=createWorkerEventContext();
  const observations=perceiveV0({makeEvent:runtime.makeEvent,pushEvent:runtime.pushEvent,score:scoreSensoriumV0});
  const envelopes=observations.map(event=>shadowEnvelopeFromEvent(event,{
    program:configuration.program,
    phenotype:configuration.phenotype,
    cycleId:message.cycleId??1,
    targetOverride:'GlobalWorkspace',
    payload:event
  }));
  return {kind:'sensorium.observations.v0',role:'Sensorium',envelopes};
});
