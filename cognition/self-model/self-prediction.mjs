const DEFAULT_CAPACITY=2;
const SUPPRESSED_CANDIDATE_CONFIDENCE_PENALTY=.06;

function round(value){return Math.round(value*1000)/1000}
function rootId(candidate){return candidate.causalParents?.[0]??candidate.rootObservationId??null}
function sortedCandidates(candidates){return [...candidates].sort((a,b)=>b.salience-a.salience||a.id.localeCompare(b.id))}

function predictRaw(sorted,capacity){return sorted.slice(0,capacity)}
function predictHardDiversity(sorted,capacity){
  const selected=[];const seen=new Set();const deferred=[];
  for(const candidate of sorted){
    const root=rootId(candidate);
    if(seen.has(root))deferred.push(candidate);
    else{selected.push(candidate);seen.add(root);}
    if(selected.length===capacity)return selected;
  }
  for(const candidate of deferred){selected.push(candidate);if(selected.length===capacity)break;}
  return selected;
}
function predictSoftDiversity(sorted,capacity,redundancyPenalty){
  const remaining=[...sorted];const selected=[];const rootCounts=new Map();
  while(remaining.length&&selected.length<capacity){
    const ranked=remaining.map(candidate=>{
      const root=rootId(candidate);const repeats=rootCounts.get(root)??0;
      return {candidate,repeats,adjusted:round(Math.max(0,candidate.salience-repeats*redundancyPenalty))};
    }).sort((a,b)=>b.adjusted-a.adjusted||b.candidate.salience-a.candidate.salience||a.candidate.id.localeCompare(b.candidate.id));
    const winner=ranked[0];selected.push(winner.candidate);
    const root=rootId(winner.candidate);rootCounts.set(root,winner.repeats+1);
    remaining.splice(remaining.findIndex(candidate=>candidate.id===winner.candidate.id),1);
  }
  return selected;
}

export function predictWorkspacePolicyOutcome(candidates,{policy,capacity=DEFAULT_CAPACITY,redundancyPenalty=.25}={}){
  if(!['raw-top-k','hard-source-diversity','soft-diversity'].includes(policy))throw new TypeError('unsupported workspace policy prediction');
  if(!Array.isArray(candidates)||candidates.length===0)throw new TypeError('candidate facts are required');
  const sorted=sortedCandidates(candidates);
  let winners;
  if(policy==='raw-top-k')winners=predictRaw(sorted,capacity);
  else if(policy==='hard-source-diversity')winners=predictHardDiversity(sorted,capacity);
  else winners=predictSoftDiversity(sorted,capacity,redundancyPenalty);

  const roots=winners.map(rootId);
  const suppressed=sorted.filter(candidate=>!new Set(winners.map(w=>w.id)).has(candidate.id));
  const texts=winners.map(candidate=>String(candidate.content));
  const activeHumanInstruction=texts.some(text=>text.includes('human supplied'));
  const runtimeChangeObserved=texts.some(text=>text.includes('Memory utilization'));
  const meanConfidence=winners.length?winners.reduce((sum,candidate)=>sum+candidate.confidence,0)/winners.length:0;
  const metaConfidence=round(Math.max(0,Math.min(1,meanConfidence-(suppressed.length?SUPPRESSED_CANDIDATE_CONFIDENCE_PENALTY:0))));

  return Object.freeze({
    predictionId:`self-prediction-${policy}`,
    policy,
    capacity,
    redundancyPenalty:policy==='soft-diversity'?redundancyPenalty:null,
    predicted:{
      winnerCount:winners.length,
      selectedCandidateIds:winners.map(candidate=>candidate.id),
      selectedRootObservationIds:roots,
      distinctRootObservationCount:new Set(roots).size,
      suppressedCandidateCount:suppressed.length,
      world:{activeHumanInstruction,runtimeChangeObserved,accessibleEventCount:winners.length},
      metaConfidence,
      expressionFeatures:{
        mentionsHumanInstruction:activeHumanInstruction,
        mentionsRuntimeMemory:runtimeChangeObserved,
        expectedConfidence:metaConfidence
      }
    },
    confidence:policy==='soft-diversity'?.94:.97,
    architectureFacts:{
      candidateFacts:sorted.map(candidate=>({id:candidate.id,rootObservationId:rootId(candidate),salience:candidate.salience,confidence:candidate.confidence})),
      capacity,
      suppressedCandidateConfidencePenalty:SUPPRESSED_CANDIDATE_CONFIDENCE_PENALTY,
      predictionGeneratedFrom:'pre-policy candidate facts only'
    },
    epistemicStatus:'prediction'
  });
}
