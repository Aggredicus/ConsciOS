import { buildCandidates } from '../../../cognition/workspace/policies.mjs';

export const CEP4_PARAMETERS=Object.freeze({
  capacity:2,
  fastInhibition:0.25,
  contradictionPenaltyScale:0.35,
  weakSupportPenaltyScale:0.30,
  contradictionGate:0.80,
  supportFloor:0.25,
  disinhibitionGain:0.20,
  maxDisinhibition:0.15
});

const round3=value=>Math.round(value*1000)/1000;
const clamp01=value=>round3(Math.max(0,Math.min(1,value)));
const clone=value=>structuredClone(value);

function normalizedCandidate(candidate){
  const result={
    id:String(candidate.id),
    rootObservationId:String(candidate.rootObservationId),
    salience:clamp01(candidate.salience),
    urgency:clamp01(candidate.urgency??0),
    predictionError:clamp01(candidate.predictionError??0),
    supportStrength:clamp01(candidate.supportStrength??1),
    contradiction:clamp01(candidate.contradiction??0),
    metadata:clone(candidate.metadata??{})
  };
  return Object.freeze(result);
}

export function candidatesFromFixture(fixture){
  const roots=new Map(fixture.events.map(event=>[event.id,event]));
  return buildCandidates(fixture.events,fixture.salienceWeights).map(candidate=>{
    const root=roots.get(candidate.rootObservationId);
    return normalizedCandidate({
      ...candidate,
      urgency:root?.urgency??0,
      predictionError:root?.predictionError??0,
      supportStrength:root?.metadata?.supportStrength??1,
      contradiction:root?.metadata?.contradiction??0,
      metadata:{sourceType:root?.type??null}
    });
  });
}

function sortRanked(rows){
  return [...rows].sort((a,b)=>b.adjustedSalience-a.adjustedSalience||b.rawSalience-a.rawSalience||a.id.localeCompare(b.id));
}

function contextArtifacts(candidate,parameters){
  const gates=[];
  const inhibition=[];
  if(candidate.contradiction>=parameters.contradictionGate){
    gates.push(Object.freeze({kind:'gate',source:'context-integrity',targetId:candidate.id,reason:'hard-contradiction',value:candidate.contradiction,threshold:parameters.contradictionGate}));
  }
  if(candidate.supportStrength<parameters.supportFloor){
    gates.push(Object.freeze({kind:'gate',source:'context-integrity',targetId:candidate.id,reason:'hard-support-floor',value:candidate.supportStrength,threshold:parameters.supportFloor}));
  }
  if(candidate.contradiction>0){
    inhibition.push(Object.freeze({kind:'inhibition',source:'context-integrity',targetId:candidate.id,reason:'contextual-contradiction',magnitude:clamp01(candidate.contradiction*parameters.contradictionPenaltyScale)}));
  }
  if(candidate.supportStrength<1){
    inhibition.push(Object.freeze({kind:'inhibition',source:'context-integrity',targetId:candidate.id,reason:'weak-support',magnitude:clamp01((1-candidate.supportStrength)*parameters.weakSupportPenaltyScale)}));
  }
  return Object.freeze({gates:Object.freeze(gates),inhibition:Object.freeze(inhibition)});
}

function disinhibitionArtifact(candidate,parameters,gated){
  if(gated)return null;
  const signal=Math.max(candidate.urgency,candidate.predictionError);
  const magnitude=Math.min(parameters.maxDisinhibition,round3(parameters.disinhibitionGain*signal));
  if(magnitude<=0)return null;
  return Object.freeze({kind:'disinhibition',source:'regulated-release',targetId:candidate.id,reason:'urgency-prediction-error-release',magnitude:clamp01(magnitude)});
}

function mulberry32(seed){
  let state=seed>>>0;
  return ()=>{
    state=(state+0x6D2B79F5)>>>0;
    let t=state;
    t=Math.imul(t^(t>>>15),t|1);
    t^=t+Math.imul(t^(t>>>7),t|61);
    return ((t^(t>>>14))>>>0)/4294967296;
  };
}

function chooseRandomTargets(remaining,count,random){
  const pool=[...remaining].sort((a,b)=>a.id.localeCompare(b.id));
  const chosen=[];
  while(pool.length&&chosen.length<count){
    const index=Math.floor(random()*pool.length);
    chosen.push(pool.splice(index,1)[0]);
  }
  return chosen;
}

function runPolicy(candidates,{
  parameters=CEP4_PARAMETERS,
  contextual=false,
  disinhibition=false,
  randomizedSeed=null,
  fastInhibition=true
}={}){
  const input=candidates.map(normalizedCandidate);
  const inputSnapshot=JSON.stringify(input);
  const inhibitionById=new Map(input.map(candidate=>[candidate.id,0]));
  const contextById=new Map();
  const gates=[];
  const artifacts=[];
  const selected=[];
  const selectionTrace=[];
  const random=randomizedSeed===null?null:mulberry32(randomizedSeed);

  for(const candidate of input){
    const context=contextual?contextArtifacts(candidate,parameters):Object.freeze({gates:Object.freeze([]),inhibition:Object.freeze([])});
    contextById.set(candidate.id,context);
    gates.push(...context.gates);
    artifacts.push(...context.inhibition);
  }
  const gatedIds=new Set(gates.map(gate=>gate.targetId));

  const disinhibitionById=new Map(input.map(candidate=>{
    const artifact=disinhibition?disinhibitionArtifact(candidate,parameters,gatedIds.has(candidate.id)):null;
    if(artifact)artifacts.push(artifact);
    return [candidate.id,artifact?.magnitude??0];
  }));

  while(selected.length<parameters.capacity){
    const remaining=input.filter(candidate=>!selected.some(item=>item.id===candidate.id)&&!gatedIds.has(candidate.id));
    if(!remaining.length)break;
    const ranked=sortRanked(remaining.map(candidate=>{
      const contextPenalty=(contextById.get(candidate.id)?.inhibition??[]).reduce((sum,item)=>round3(sum+item.magnitude),0);
      const lateralPenalty=inhibitionById.get(candidate.id)??0;
      const release=disinhibitionById.get(candidate.id)??0;
      const inhibited=clamp01(candidate.salience-contextPenalty-lateralPenalty);
      const adjusted=clamp01(inhibited+release);
      return Object.freeze({
        id:candidate.id,
        rootObservationId:candidate.rootObservationId,
        rawSalience:candidate.salience,
        contextPenalty:round3(contextPenalty),
        lateralPenalty:round3(lateralPenalty),
        disinhibition:round3(release),
        adjustedSalience:adjusted
      });
    }));
    const winner=ranked[0];
    selected.push(winner);
    selectionTrace.push(Object.freeze({step:selected.length,winnerId:winner.id,ranking:Object.freeze(ranked)}));

    // Inhibition after the final admission cannot affect a decision. Omitting it keeps
    // structured and randomized controls matched on causally relevant message budget.
    if(selected.length>=parameters.capacity)break;
    if(!fastInhibition)continue;
    const unselected=input.filter(candidate=>!selected.some(item=>item.id===candidate.id)&&!gatedIds.has(candidate.id));
    const sameRoot=unselected.filter(candidate=>candidate.rootObservationId===winner.rootObservationId);
    const targets=random?chooseRandomTargets(unselected,sameRoot.length,random):sameRoot;
    for(const target of targets){
      const message=Object.freeze({
        kind:'inhibition',
        source:winner.id,
        targetId:target.id,
        reason:random?'matched-random-lateral':'same-root-lateral',
        magnitude:parameters.fastInhibition,
        step:selected.length
      });
      artifacts.push(message);
      inhibitionById.set(target.id,clamp01((inhibitionById.get(target.id)??0)+message.magnitude));
    }
  }

  if(JSON.stringify(input)!==inputSnapshot)throw new Error('CEP-4 policy mutated candidate input');
  const admittedIds=selected.map(item=>item.id);
  const admittedRoots=selected.map(item=>item.rootObservationId);
  const distinctRoots=new Set(admittedRoots).size;
  const admittedCandidates=input.filter(candidate=>admittedIds.includes(candidate.id));
  const hardGatedIds=[...gatedIds].sort();
  const inhibitory=artifacts.filter(item=>item.kind==='inhibition');
  const disinhibitory=artifacts.filter(item=>item.kind==='disinhibition');

  return Object.freeze({
    admitted:Object.freeze(selected),
    admittedIds:Object.freeze(admittedIds),
    admittedRoots:Object.freeze(admittedRoots),
    distinctRoots,
    duplicateRootAdmissions:Math.max(0,admittedRoots.length-distinctRoots),
    contradictedAdmissions:admittedCandidates.filter(candidate=>candidate.contradiction>=parameters.contradictionGate).map(candidate=>candidate.id),
    unsupportedAdmissions:admittedCandidates.filter(candidate=>candidate.supportStrength<parameters.supportFloor).map(candidate=>candidate.id),
    highUrgencySupportedAdmissions:admittedCandidates.filter(candidate=>candidate.urgency>=0.8&&candidate.supportStrength>=parameters.supportFloor&&candidate.contradiction<parameters.contradictionGate).map(candidate=>candidate.id),
    hardGatedIds:Object.freeze(hardGatedIds),
    gates:Object.freeze(gates),
    artifacts:Object.freeze(artifacts),
    inhibitionMessageCount:inhibitory.length,
    inhibitionMagnitude:round3(inhibitory.reduce((sum,item)=>sum+item.magnitude,0)),
    disinhibitionMessageCount:disinhibitory.length,
    disinhibitionMagnitude:round3(disinhibitory.reduce((sum,item)=>sum+item.magnitude,0)),
    selectionTrace:Object.freeze(selectionTrace),
    randomizedSeed
  });
}

export function excitationOnly(candidates,parameters=CEP4_PARAMETERS){
  return runPolicy(candidates,{parameters,fastInhibition:false});
}

export function fastStructuredInhibition(candidates,parameters=CEP4_PARAMETERS){
  return runPolicy(candidates,{parameters,fastInhibition:true});
}

export function contextualInhibition(candidates,parameters=CEP4_PARAMETERS){
  return runPolicy(candidates,{parameters,fastInhibition:true,contextual:true});
}

export function boundedDisinhibition(candidates,parameters=CEP4_PARAMETERS){
  return runPolicy(candidates,{parameters,fastInhibition:true,contextual:true,disinhibition:true});
}

export function matchedRandomInhibition(candidates,seed,parameters=CEP4_PARAMETERS){
  if(!Number.isInteger(seed)||seed<1)throw new TypeError('randomized control seed must be a positive integer');
  return runPolicy(candidates,{parameters,fastInhibition:true,randomizedSeed:seed});
}

export function randomizedControlSummary(candidates,{firstSeed=1,lastSeed=128,parameters=CEP4_PARAMETERS}={}){
  const runs=[];
  for(let seed=firstSeed;seed<=lastSeed;seed++)runs.push(matchedRandomInhibition(candidates,seed,parameters));
  const duplicateRuns=runs.filter(run=>run.duplicateRootAdmissions>0).length;
  const fullDiversityRuns=runs.filter(run=>run.distinctRoots===parameters.capacity).length;
  return Object.freeze({
    seedRange:Object.freeze([firstSeed,lastSeed]),
    runs:runs.length,
    duplicateRuns,
    fullDiversityRuns,
    duplicateRate:round3(duplicateRuns/runs.length),
    fullDiversityRate:round3(fullDiversityRuns/runs.length),
    outcomes:Object.freeze(runs.map(run=>Object.freeze({seed:run.randomizedSeed,admittedIds:run.admittedIds,admittedRoots:run.admittedRoots,duplicateRootAdmissions:run.duplicateRootAdmissions})))
  });
}

export const CEP4_FIXTURES=Object.freeze({
  contradiction:Object.freeze([
    Object.freeze({id:'contradicted-hot',rootObservationId:'root-contradicted',salience:.95,urgency:.4,predictionError:.7,supportStrength:.9,contradiction:.95}),
    Object.freeze({id:'unsupported-hot',rootObservationId:'root-unsupported',salience:.90,urgency:.5,predictionError:.6,supportStrength:.10,contradiction:.10}),
    Object.freeze({id:'supported-a',rootObservationId:'root-supported-a',salience:.72,urgency:.3,predictionError:.4,supportStrength:.90,contradiction:.05}),
    Object.freeze({id:'supported-b',rootObservationId:'root-supported-b',salience:.68,urgency:.2,predictionError:.3,supportStrength:.95,contradiction:0})
  ]),
  disinhibition:Object.freeze([
    Object.freeze({id:'anchor',rootObservationId:'root-a',salience:.90,urgency:.1,predictionError:.1,supportStrength:1,contradiction:0}),
    Object.freeze({id:'urgent-repeat',rootObservationId:'root-a',salience:.75,urgency:1,predictionError:1,supportStrength:.95,contradiction:.10}),
    Object.freeze({id:'contradicted-urgent',rootObservationId:'root-c',salience:.86,urgency:1,predictionError:1,supportStrength:1,contradiction:.90}),
    Object.freeze({id:'steady-alternative',rootObservationId:'root-b',salience:.57,urgency:.1,predictionError:.1,supportStrength:1,contradiction:0})
  ])
});
