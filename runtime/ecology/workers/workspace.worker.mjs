import { bindWorkerEndpoint } from './endpoint.mjs';
import { createWorkerEventContext } from './event-context.mjs';
import { compileRuntimePhenotype } from '../phenotype-compiler.mjs';
import { createShadowEnvelopeValidator, shadowEnvelopeFromEvent } from '../cognitive-envelope-v1.mjs';
import { workspaceCompetitionV0, V0_WORKSPACE_CAPACITY } from '../../../cognition/workspace/v0-runtime.mjs';

let configuration=null;

await bindWorkerEndpoint(async message=>{
  if(message?.kind==='configure'){
    const compiled=await compileRuntimePhenotype(message.program);
    if(compiled.phenotype.phenotypeHash!==message.phenotypeHash)throw new Error('Workspace configuration phenotype hash mismatch');
    configuration=compiled;
    return {kind:'configured',role:'GlobalWorkspace',phenotypeHash:compiled.phenotype.phenotypeHash,networkCapability:false};
  }
  if(message?.kind!=='compete-v0')throw new Error(`Workspace worker rejects command ${message?.kind??'<missing>'}`);
  if(!configuration)throw new Error('Workspace worker is not configured');
  if(!Array.isArray(message.envelopes))throw new Error('Workspace requires candidate envelopes');

  const validator=createShadowEnvelopeValidator({
    program:configuration.program,
    phenotype:configuration.phenotype,
    knownParentIds:message.knownParentIds??[]
  });
  const candidates=message.envelopes.map(envelope=>{
    validator.validate(envelope);
    if(envelope.targetDomain!=='cortex')throw new Error('Workspace candidate must target cortex');
    if(!envelope.payload||typeof envelope.payload!=='object')throw new Error('Workspace candidate payload must contain the source event');
    return structuredClone(envelope.payload);
  });

  const runtime=createWorkerEventContext({initialTick:message.initialTick??10});
  const competition=workspaceCompetitionV0(candidates,{
    makeEvent:runtime.makeEvent,
    pushEvent:runtime.pushEvent,
    capacity:message.capacity??V0_WORKSPACE_CAPACITY
  });
  const envelopes=competition.winners.map(event=>shadowEnvelopeFromEvent(event,{
    program:configuration.program,
    phenotype:configuration.phenotype,
    cycleId:message.cycleId??1,
    payload:event
  }));
  return {
    kind:'workspace.competition.v0',
    role:'GlobalWorkspace',
    envelopes,
    suppressedIds:competition.suppressed.map(candidate=>candidate.id)
  };
});
