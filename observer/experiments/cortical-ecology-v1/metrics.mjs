import { createHash } from 'node:crypto';

const textEncoder=new TextEncoder();
const clone=value=>structuredClone(value);
const json=value=>JSON.stringify(value);
const bytes=value=>textEncoder.encode(typeof value==='string'?value:json(value)).byteLength;

export const MEASUREMENT_SCHEMA_VERSION='1.0.0';

export function measured(value,{unit=null,source='trace'}={}){
  return Object.freeze({status:'measured',value,unit,source});
}

export function unavailable(reason,{source='platform'}={}){
  return Object.freeze({status:'unavailable',value:null,unit:null,source,reason:String(reason)});
}

function sha256(value){
  return createHash('sha256').update(typeof value==='string'?value:json(value)).digest('hex');
}

function commonPrefixBytes(left,right){
  const a=textEncoder.encode(typeof left==='string'?left:json(left));
  const b=textEncoder.encode(typeof right==='string'?right:json(right));
  let i=0;
  while(i<a.length&&i<b.length&&a[i]===b[i])i++;
  return i;
}

function eventOrder(event,index){
  if(Number.isFinite(event.timestamp))return event.timestamp;
  if(Number.isFinite(event.logicalTime))return event.logicalTime;
  return index+1;
}

function sourceOf(event){return typeof event?.source==='string'?event.source:'unknown';}
function typeOf(event){return typeof event?.type==='string'?event.type:'unknown';}
function parentsOf(event){return Array.isArray(event?.causalParents)?event.causalParents:[];}

export function analyzeEventTrace(events,{externalParentIds=[]}={}){
  if(!Array.isArray(events))throw new TypeError('events must be an array');
  const snapshot=clone(events);
  const ids=events.map(event=>event?.id).filter(id=>typeof id==='string'&&id.length>0);
  const idSet=new Set(ids);
  const externalSet=new Set(externalParentIds);
  const duplicateIds=[...new Set(ids.filter((id,index)=>ids.indexOf(id)!==index))].sort();
  const byId=new Map(events.filter(event=>typeof event?.id==='string').map(event=>[event.id,event]));
  const brokenCausalParents=[];
  const crossDomainEdges=new Map();
  const sources={};
  const types={};
  const requiredBase=['id','source','type','causalParents'];
  const provenanceMissing=[];

  events.forEach((event,index)=>{
    const source=sourceOf(event);const type=typeOf(event);
    sources[source]=(sources[source]??0)+1;types[type]=(types[type]??0)+1;
    for(const field of requiredBase)if(!(field in (event??{})))provenanceMissing.push({eventId:event?.id??`index:${index}`,field});
    for(const parentId of parentsOf(event)){
      if(!idSet.has(parentId)&&!externalSet.has(parentId)){
        brokenCausalParents.push({eventId:event?.id??null,parentId});
        continue;
      }
      const parent=byId.get(parentId);
      if(parent&&sourceOf(parent)!==source){
        const key=`${sourceOf(parent)}->${source}`;
        crossDomainEdges.set(key,(crossDomainEdges.get(key)??0)+1);
      }
    }
  });

  if(JSON.stringify(events)!==JSON.stringify(snapshot))throw new Error('trace analysis mutated source events');
  return Object.freeze({
    eventCount:events.length,
    eventBytes:bytes(events),
    traceSha256:sha256(events),
    duplicateIds,
    brokenCausalParents,
    provenanceMissing,
    sources:Object.freeze({...sources}),
    types:Object.freeze({...types}),
    crossDomainEdges:Object.freeze(Object.fromEntries([...crossDomainEdges.entries()].sort(([a],[b])=>a.localeCompare(b))))
  });
}

export function inspectSuppressedLeakage(state){
  if(!state||!Array.isArray(state.events)||!Array.isArray(state.suppressed))return Object.freeze({status:'not-applicable',suppressedCount:0,leaks:[]});
  const suppressed=state.suppressed.filter(item=>item&&typeof item.id==='string');
  if(!suppressed.length)return Object.freeze({status:'measured',suppressedCount:0,leaks:[]});
  const firstBroadcastIndex=state.events.findIndex(event=>event.type==='workspace.broadcast');
  const downstream=state.events.filter((event,index)=>index>firstBroadcastIndex&&event.source!=='GlobalWorkspace');
  const leaks=[];
  for(const candidate of suppressed){
    const candidateContent=typeof candidate.content==='string'&&candidate.content.length?candidate.content:null;
    for(const event of downstream){
      if(parentsOf(event).includes(candidate.id))leaks.push({candidateId:candidate.id,eventId:event.id,kind:'causal-parent'});
      if(candidateContent&&json(event.content).includes(candidateContent))leaks.push({candidateId:candidate.id,eventId:event.id,kind:'verbatim-content'});
    }
  }
  return Object.freeze({status:'measured',suppressedCount:suppressed.length,leaks});
}

export function inspectActionPath(events){
  const byId=new Map(events.filter(event=>typeof event?.id==='string').map(event=>[event.id,event]));
  const expression=[...events].reverse().find(event=>sourceOf(event)==='Expression'||typeOf(event)==='expression.report')??null;
  if(!expression)return Object.freeze({complete:false,expressionEventId:null,executiveEventId:null,guardianEventId:null,reason:'expression event unavailable'});
  const executive=parentsOf(expression).map(id=>byId.get(id)).find(event=>sourceOf(event)==='Executive')??null;
  if(!executive)return Object.freeze({complete:false,expressionEventId:expression.id,executiveEventId:null,guardianEventId:null,reason:'Expression lacks causal Executive parent'});
  const guardian=parentsOf(executive).map(id=>byId.get(id)).find(event=>sourceOf(event)==='Guardian')??null;
  if(!guardian)return Object.freeze({complete:false,expressionEventId:expression.id,executiveEventId:executive.id,guardianEventId:null,reason:'Executive lacks causal Guardian parent'});
  return Object.freeze({complete:true,expressionEventId:expression.id,executiveEventId:executive.id,guardianEventId:guardian.id,reason:'Guardian -> Executive -> Expression ancestry observed'});
}

export function exactInputMeasurement(value,label='input'){
  const serialized=json(value);
  return Object.freeze({
    label,
    utf8Bytes:measured(bytes(serialized),{unit:'bytes',source:'serialized-input'}),
    sha256:sha256(serialized),
    tokenCount:unavailable('No tokenizer/provider token accounting is present in this deterministic fixture.',{source:'provider'}),
    providerCache:unavailable('No provider cache trace is exposed by this fixture.',{source:'provider'})
  });
}

export function repeatedInputMeasurement(previous,current){
  const previousSerialized=json(previous);const currentSerialized=json(current);
  const prefixBytes=commonPrefixBytes(previousSerialized,currentSerialized);
  return Object.freeze({
    previousSha256:sha256(previousSerialized),currentSha256:sha256(currentSerialized),
    exactRepeat:previousSerialized===currentSerialized,
    stablePrefixBytes:measured(prefixBytes,{unit:'bytes',source:'serialized-input'}),
    cacheHit:unavailable('Repeated bytes are not evidence of a provider cache hit.',{source:'provider'}),
    workingSet:unavailable('Provider cache pages/working-set references are not exposed by this fixture.',{source:'provider'})
  });
}

export function recurrentStateMeasurement(state){
  if(!state)return Object.freeze({serializedBytes:unavailable('No recurrent state supplied.'),sha256:null});
  return Object.freeze({serializedBytes:measured(bytes(state),{unit:'bytes',source:'recurrent-state'}),sha256:sha256(state)});
}

export function providerTelemetryUnavailable(){
  return Object.freeze({
    providerIdentity:unavailable('Deterministic fixture does not invoke a model provider.',{source:'provider'}),
    modelRevision:unavailable('Deterministic fixture does not invoke a model provider.',{source:'provider'}),
    backendIdentity:unavailable('Deterministic fixture does not invoke a model backend.',{source:'provider'}),
    timeToFirstTokenMs:unavailable('No token-stream timing is exposed.',{source:'provider'}),
    generationTokensPerSecond:unavailable('No generated-token telemetry is exposed.',{source:'provider'}),
    modelLoadBytes:unavailable('No model asset was loaded by this fixture.',{source:'provider'}),
    modelLoadTimeMs:unavailable('No model load timing is exposed.',{source:'provider'}),
    peakMemoryBytes:unavailable('Reliable peak process/device memory is not exposed by the fixture.',{source:'platform'}),
    thermalState:unavailable('Thermal telemetry is not exposed by the fixture.',{source:'platform'}),
    batteryState:unavailable('Battery telemetry is not exposed by the fixture.',{source:'platform'}),
    inferenceCalls:measured(0,{unit:'calls',source:'deterministic-fixture'}),
    toolCalls:measured(0,{unit:'calls',source:'deterministic-fixture'}),
    localEscalations:measured(0,{unit:'calls',source:'deterministic-fixture'}),
    remoteEscalations:measured(0,{unit:'calls',source:'deterministic-fixture'})
  });
}

export function compareMatchedCycles(recurrentCycle,statelessCycle){
  const sameInput=json(recurrentCycle.inputObservations)===json(statelessCycle.inputObservations);
  return Object.freeze({
    sameInput,
    inputBytes:measured(bytes(recurrentCycle.inputObservations),{unit:'bytes',source:'serialized-input'}),
    recurrentPriorStateUsed:!!recurrentCycle.priorStateUsed,
    statelessPriorStateUsed:!!statelessCycle.priorStateUsed,
    recurrentWinner:recurrentCycle.workspace?.winnerObservationId??null,
    statelessWinner:statelessCycle.workspace?.winnerObservationId??null,
    winnerDiverged:(recurrentCycle.workspace?.winnerObservationId??null)!==(statelessCycle.workspace?.winnerObservationId??null),
    recurrentExpression:recurrentCycle.expression?.content??null,
    statelessExpression:statelessCycle.expression?.content??null,
    expressionDiverged:(recurrentCycle.expression?.content??null)!==(statelessCycle.expression?.content??null)
  });
}

export function buildBaselineMeasurement({acceptedState,liveSteps,recurrentLab}){
  const acceptedSnapshot=clone(acceptedState);
  const acceptedTrace=analyzeEventTrace(acceptedState.events);
  const acceptedLeakage=inspectSuppressedLeakage(acceptedState);
  const acceptedActionPath=inspectActionPath(acceptedState.events);
  const cycles=recurrentLab.cycles;
  const recurrentCycles=[cycles.cycle1,cycles.cycle2,cycles.cycle3Recurrent];
  const recurrentTraceResults=recurrentCycles.map((cycle,index)=>analyzeEventTrace(cycle.events,{externalParentIds:index? [recurrentCycles[index-1].recurrentState.anchorEventId]:[]}));
  const cycle2To3Repeat=repeatedInputMeasurement(cycles.cycle2.inputObservations,cycles.cycle3Recurrent.inputObservations);
  const matched=compareMatchedCycles(cycles.cycle3Recurrent,cycles.cycle3Stateless);
  const liveStageCounts=Object.fromEntries(liveSteps.map(step=>[step.stage,step.newEvents.length]));

  const result=Object.freeze({
    schemaVersion:MEASUREMENT_SCHEMA_VERSION,
    epistemicStatus:'measurement',
    causalAuthority:'none',
    accepted:{
      input:unavailable('runModularV0 uses its internal frozen fixture; no external provider prompt is emitted.',{source:'fixture'}),
      trace:acceptedTrace,
      suppressedLeakage:acceptedLeakage,
      actionPath:acceptedActionPath,
      liveStageEventCounts:liveStageCounts
    },
    recurrence:{
      cycleInputs:recurrentCycles.map(cycle=>exactInputMeasurement(cycle.inputObservations,`cycle-${cycle.cycleId}`)),
      repeatedHistory:cycle2To3Repeat,
      recurrentState:recurrentStateMeasurement(cycles.cycle3Recurrent.recurrentState),
      matchedRecurrentVsStateless:matched,
      traces:recurrentTraceResults,
      exploration:{branchCount:measured(0,{unit:'branches',source:'fixture'}),maxDepth:measured(0,{unit:'levels',source:'fixture'}),reason:'This recurrence fixture contains no exploration tree.'}
    },
    providerTelemetry:providerTelemetryUnavailable(),
    envelopeCount:measured(0,{unit:'envelopes',source:'current-runtime'}),
    envelopeNote:'CognitiveEnvelopeV1 is not yet implemented; zero is an observed architecture count, not provider telemetry.',
    caveats:[
      'Serialized object bytes are not token counts.',
      'Repeated prefixes are cache opportunity measurements, not measured cache hits.',
      'Suppressed-leakage checks apply only to inspected deterministic traces.',
      'No wall-clock benchmark is reported because observer instrumentation would confound the timing baseline.'
    ]
  });

  if(json(acceptedState)!==json(acceptedSnapshot))throw new Error('baseline measurement mutated accepted state');
  return result;
}
