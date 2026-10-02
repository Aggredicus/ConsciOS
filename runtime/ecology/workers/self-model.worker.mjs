import { bindWorkerEndpoint } from './endpoint.mjs';
import { createWorkerEventContext } from './event-context.mjs';
import { compileRuntimePhenotype } from '../phenotype-compiler.mjs';
import { createShadowEnvelopeValidator, shadowEnvelopeFromEvent } from '../cognitive-envelope-v1.mjs';
import { updateSelfModelV0 } from '../../../cognition/self-model/v0.mjs';

const V0_ARCHITECTURE_VERSION='0.6.0';
const V0_WORKSPACE_CAPACITY=2;
let configuration=null;

await bindWorkerEndpoint(async message=>{
  if(message?.kind==='configure'){
    const compiled=await compileRuntimePhenotype(message.program);
    if(compiled.phenotype.phenotypeHash!==message.phenotypeHash)throw new Error('SelfModel configuration phenotype hash mismatch');
    configuration=compiled;
    return {kind:'configured',role:'SelfModel',phenotypeHash:compiled.phenotype.phenotypeHash,networkCapability:false};
  }
  if(message?.kind!=='model-v0')throw new Error(`SelfModel worker rejects command ${message?.kind??'<missing>'}`);
  if(!configuration)throw new Error('SelfModel worker is not configured');
  for(const forbidden of ['observations','candidates','suppressed','suppressedIds'])if(Object.hasOwn(message,forbidden))throw new Error(`SelfModel refuses undeclared context ${forbidden}`);
  if(!Array.isArray(message.envelopes))throw new Error('SelfModel requires broadcast envelopes');

  const validator=createShadowEnvelopeValidator({program:configuration.program,phenotype:configuration.phenotype,knownParentIds:message.knownParentIds??[]});
  const broadcasts=message.envelopes.map(envelope=>{
    validator.validate(envelope);
    if(envelope.targetDomain!=='broadcast'||envelope.type!=='workspace.broadcast')throw new Error('SelfModel accepts Workspace broadcasts only');
    return structuredClone(envelope.payload);
  });

  const runtime=createWorkerEventContext({initialTick:message.initialTick??13});
  const result=updateSelfModelV0(broadcasts,{
    makeEvent:runtime.makeEvent,
    pushEvent:runtime.pushEvent,
    architectureVersion:V0_ARCHITECTURE_VERSION,
    workspaceCapacity:V0_WORKSPACE_CAPACITY
  });
  const envelope=shadowEnvelopeFromEvent(result.event,{program:configuration.program,phenotype:configuration.phenotype,cycleId:message.cycleId??1,payload:result.event});
  return {kind:'self-model.update.v0',role:'SelfModel',model:result.self,envelope};
});
