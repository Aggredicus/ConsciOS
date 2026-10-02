import { compileRuntimePhenotype } from './phenotype-compiler.mjs';
import { createShadowEnvelopeValidator, shadowEnvelopeFromEvent } from './cognitive-envelope-v1.mjs';
import { createWorkerEventContext } from './workers/event-context.mjs';
import { localProcessV0, scoreV0, V0_WORKSPACE_CAPACITY } from '../../cognition/workspace/v0-runtime.mjs';

const WORKER_URLS=Object.freeze({
  sensorium:new URL('./workers/sensorium.worker.mjs',import.meta.url),
  workspace:new URL('./workers/workspace.worker.mjs',import.meta.url),
  world:new URL('./workers/world-model.worker.mjs',import.meta.url),
  self:new URL('./workers/self-model.worker.mjs',import.meta.url)
});

let requestCounter=0;
function nextRequestId(){return `cortical-worker-request-${++requestCounter}`;}

export function callCorticalWorker(worker,message){
  const requestId=nextRequestId();
  const request={...structuredClone(message),requestId};
  return new Promise((resolve,reject)=>{
    let settled=false;
    const cleanup=()=>{
      if(typeof worker.removeEventListener==='function'){
        worker.removeEventListener('message',onBrowserMessage);
        worker.removeEventListener('error',onBrowserError);
      }
      if(typeof worker.off==='function'){
        worker.off('message',onNodeMessage);
        worker.off('error',onNodeError);
        worker.off('exit',onNodeExit);
      }
    };
    const finish=(error,value)=>{
      if(settled)return;
      settled=true;cleanup();
      error?reject(error):resolve(value);
    };
    const consume=response=>{
      if(response?.requestId!==requestId)return;
      if(response.ok===true)return finish(null,response.value);
      const error=new Error(response?.error?.message??'Worker rejected request');
      error.name=response?.error?.name??'WorkerError';
      finish(error);
    };
    const onBrowserMessage=event=>consume(event.data);
    const onNodeMessage=response=>consume(response);
    const onBrowserError=event=>finish(new Error(event?.message??'Worker realm failed'));
    const onNodeError=error=>finish(error);
    const onNodeExit=code=>{if(code!==0)finish(new Error(`Worker realm exited with code ${code}`));};

    if(typeof worker.addEventListener==='function'){
      worker.addEventListener('message',onBrowserMessage);
      worker.addEventListener('error',onBrowserError);
    }else if(typeof worker.on==='function'){
      worker.on('message',onNodeMessage);
      worker.on('error',onNodeError);
      worker.on('exit',onNodeExit);
    }else return finish(new Error('Unsupported Worker interface'));
    worker.postMessage(request);
  });
}

function defaultWorkerFactory(url){
  if(typeof globalThis.Worker!=='function')throw new Error('Browser Worker is unavailable; supply workerFactory for this environment');
  return new globalThis.Worker(url,{type:'module'});
}

async function terminateWorker(worker){
  try{await worker.terminate();}catch{}
}

export async function runCorticalWorkerLaboratoryV1({program,workerFactory=defaultWorkerFactory,cycleId=1,extraCandidates=[]}={}){
  const compiled=await compileRuntimePhenotype(program);
  const workers={
    sensorium:workerFactory(WORKER_URLS.sensorium,'Sensorium'),
    workspace:workerFactory(WORKER_URLS.workspace,'GlobalWorkspace'),
    world:workerFactory(WORKER_URLS.world,'WorldModel'),
    self:workerFactory(WORKER_URLS.self,'SelfModel')
  };
  const workerList=Object.values(workers);
  try{
    const configure=await Promise.all(Object.entries(workers).map(async ([name,worker])=>{
      const result=await callCorticalWorker(worker,{kind:'configure',program:compiled.program,phenotypeHash:compiled.phenotype.phenotypeHash});
      if(result.phenotypeHash!==compiled.phenotype.phenotypeHash)throw new Error(`${name} returned the wrong phenotype hash`);
      return result;
    }));

    const sensoriumResult=await callCorticalWorker(workers.sensorium,{kind:'run-fixture-v0',cycleId});
    const auditValidator=createShadowEnvelopeValidator({program:compiled.program,phenotype:compiled.phenotype});
    for(const envelope of sensoriumResult.envelopes)auditValidator.validate(envelope);
    const observations=sensoriumResult.envelopes.map(envelope=>structuredClone(envelope.payload));

    const hostRuntime=createWorkerEventContext({initialTick:Math.max(0,...observations.map(event=>event.timestamp))});
    const baselineCandidates=localProcessV0(observations,{makeEvent:hostRuntime.makeEvent,pushEvent:hostRuntime.pushEvent,score:scoreV0});
    const candidates=[...baselineCandidates,...structuredClone(extraCandidates)];
    const candidateEnvelopes=candidates.map(event=>shadowEnvelopeFromEvent(event,{program:compiled.program,phenotype:compiled.phenotype,cycleId,payload:event}));
    for(const envelope of candidateEnvelopes)auditValidator.validate(envelope);

    const initialWorkspaceTick=Math.max(...candidates.map(event=>event.timestamp));
    const workspaceResult=await callCorticalWorker(workers.workspace,{
      kind:'compete-v0',cycleId,envelopes:candidateEnvelopes,
      knownParentIds:observations.map(event=>event.id),
      initialTick:initialWorkspaceTick,capacity:V0_WORKSPACE_CAPACITY
    });
    for(const envelope of workspaceResult.envelopes)auditValidator.validate(envelope);
    const workspace=workspaceResult.envelopes.map(envelope=>structuredClone(envelope.payload));
    const winningCandidateIds=workspace.flatMap(event=>event.causalParents);

    const [worldResult,selfResult]=await Promise.all([
      callCorticalWorker(workers.world,{
        kind:'model-v0',cycleId,envelopes:workspaceResult.envelopes,
        knownParentIds:winningCandidateIds,initialTick:Math.max(...workspace.map(event=>event.timestamp))
      }),
      callCorticalWorker(workers.self,{
        kind:'model-v0',cycleId,envelopes:workspaceResult.envelopes,
        knownParentIds:winningCandidateIds,initialTick:Math.max(...workspace.map(event=>event.timestamp))+1
      })
    ]);
    auditValidator.validate(worldResult.envelope);
    auditValidator.validate(selfResult.envelope);

    const worldEvent=structuredClone(worldResult.envelope.payload);
    const selfEvent=structuredClone(selfResult.envelope.payload);
    const events=[...observations,...baselineCandidates,...workspace,worldEvent,selfEvent];
    const envelopeTrace=[...sensoriumResult.envelopes,...candidateEnvelopes,...workspaceResult.envelopes,worldResult.envelope,selfResult.envelope];

    return Object.freeze({
      schemaVersion:'1.0.0',
      experiment:'cortical-worker-laboratory-v1',
      causalAuthority:'none',
      phenotypeHash:compiled.phenotype.phenotypeHash,
      workerConfigurations:Object.freeze(configure.map(item=>Object.freeze({...item}))),
      observations:Object.freeze(observations),
      candidates:Object.freeze(candidates),
      workspace:Object.freeze(workspace),
      suppressedIds:Object.freeze([...workspaceResult.suppressedIds]),
      world:Object.freeze(structuredClone(worldResult.model)),
      self:Object.freeze(structuredClone(selfResult.model)),
      events:Object.freeze(events),
      envelopeTrace:Object.freeze(envelopeTrace),
      modelInputEnvelopeIds:Object.freeze(workspaceResult.envelopes.map(envelope=>envelope.messageId)),
      networkCapability:false
    });
  }finally{
    await Promise.all(workerList.map(terminateWorker));
  }
}

export const CORTICAL_WORKER_URLS=WORKER_URLS;
