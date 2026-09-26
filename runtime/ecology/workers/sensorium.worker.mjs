import { bindWorkerEndpoint } from './endpoint.mjs';
import { createWorkerEventContext } from './event-context.mjs';
import { compileRuntimePhenotype } from '../phenotype-compiler.mjs';
import { shadowEnvelopeFromEvent } from '../cognitive-envelope-v1.mjs';
import { perceiveV0 } from '../../../cognition/sensorium/v0.mjs';
import { scoreV0 } from '../../../cognition/workspace/v0-runtime.mjs';

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
  const observations=perceiveV0({makeEvent:runtime.makeEvent,pushEvent:runtime.pushEvent,score:scoreV0});
  const envelopes=observations.map(event=>shadowEnvelopeFromEvent(event,{
    program:configuration.program,
    phenotype:configuration.phenotype,
    cycleId:message.cycleId??1,
    targetOverride:'GlobalWorkspace',
    payload:event
  }));
  return {kind:'sensorium.observations.v0',role:'Sensorium',envelopes};
});
