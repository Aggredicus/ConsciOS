import { bindWorkerEndpoint } from './endpoint.mjs';
import { createWorkerEventContext } from './event-context.mjs';
import { compileRuntimePhenotype } from '../phenotype-compiler.mjs';
import { createShadowEnvelopeValidator, shadowEnvelopeFromEvent } from '../cognitive-envelope-v1.mjs';
import { updateWorldModelV0 } from '../../../cognition/world-model/v0.mjs';

let configuration=null;

await bindWorkerEndpoint(async message=>{
  if(message?.kind==='configure'){
    const compiled=await compileRuntimePhenotype(message.program);
    if(compiled.phenotype.phenotypeHash!==message.phenotypeHash)throw new Error('WorldModel configuration phenotype hash mismatch');
    configuration=compiled;
    return {kind:'configured',role:'WorldModel',phenotypeHash:compiled.phenotype.phenotypeHash,networkCapability:false};
  }
  if(message?.kind!=='model-v0')throw new Error(`WorldModel worker rejects command ${message?.kind??'<missing>'}`);
  if(!configuration)throw new Error('WorldModel worker is not configured');
  for(const forbidden of ['observations','candidates','suppressed','suppressedIds'])if(Object.hasOwn(message,forbidden))throw new Error(`WorldModel refuses undeclared context ${forbidden}`);
  if(!Array.isArray(message.envelopes))throw new Error('WorldModel requires broadcast envelopes');

  const validator=createShadowEnvelopeValidator({program:configuration.program,phenotype:configuration.phenotype,knownParentIds:message.knownParentIds??[]});
  const broadcasts=message.envelopes.map(envelope=>{
    validator.validate(envelope);
    if(envelope.targetDomain!=='broadcast'||envelope.type!=='workspace.broadcast')throw new Error('WorldModel accepts Workspace broadcasts only');
    return structuredClone(envelope.payload);
  });

  const runtime=createWorkerEventContext({initialTick:message.initialTick??12});
  const result=updateWorldModelV0(broadcasts,{makeEvent:runtime.makeEvent,pushEvent:runtime.pushEvent});
  const envelope=shadowEnvelopeFromEvent(result.event,{program:configuration.program,phenotype:configuration.phenotype,cycleId:message.cycleId??1,payload:result.event});
  return {kind:'world-model.update.v0',role:'WorldModel',model:result.world,envelope};
});
