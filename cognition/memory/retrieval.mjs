import { canonicalJson, verifyAutobiographicalJournal } from './autobiographical.mjs';

const DEFAULT_WEIGHTS=Object.freeze({
  tokenOverlap:.55,
  typeMatch:.15,
  sourceMatch:.10,
  structuredKeyOverlap:.10,
  structuredValueAgreement:.05,
  recency:.05
});

function clamp01(value){return Math.max(0,Math.min(1,value))}
function round(value){return Math.round(value*1000)/1000}
function tokenize(value){
  return [...new Set(String(value??'').toLowerCase().match(/[a-z0-9]+/g)??[])];
}
function overlapFraction(queryTokens,recordTokens){
  if(queryTokens.length===0)return 0;
  const recordSet=new Set(recordTokens);
  return queryTokens.filter(token=>recordSet.has(token)).length/queryTokens.length;
}
function flatten(value,prefix='',out={}){
  if(value===null||typeof value!=='object'){
    if(prefix)out[prefix]=value;
    return out;
  }
  if(Array.isArray(value)){
    value.forEach((item,index)=>flatten(item,prefix?`${prefix}.${index}`:String(index),out));
    return out;
  }
  for(const [key,item] of Object.entries(value))flatten(item,prefix?`${prefix}.${key}`:key,out);
  return out;
}
function signalMetrics(querySignals,recordContent){
  const keys=Object.keys(querySignals??{});
  if(keys.length===0)return {keyOverlap:0,valueAgreement:0,matchedKeys:[],conflictingKeys:[]};
  const flat=flatten(recordContent);
  const present=keys.filter(key=>Object.prototype.hasOwnProperty.call(flat,key));
  const matched=present.filter(key=>Object.is(flat[key],querySignals[key]));
  const conflicting=present.filter(key=>!Object.is(flat[key],querySignals[key]));
  return {
    keyOverlap:present.length/keys.length,
    valueAgreement:matched.length/keys.length,
    matchedKeys:matched,
    conflictingKeys:conflicting
  };
}
function normalizeQuery(query){
  if(!query||typeof query!=='object')throw new TypeError('recall query must be an object');
  return {
    queryId:typeof query.queryId==='string'&&query.queryId?query.queryId:'recall-query',
    text:String(query.text??''),
    preferredTypes:Array.isArray(query.preferredTypes)?[...new Set(query.preferredTypes.filter(Boolean))]:[],
    preferredSources:Array.isArray(query.preferredSources)?[...new Set(query.preferredSources.filter(Boolean))]:[],
    structuredSignals:query.structuredSignals&&typeof query.structuredSignals==='object'?structuredClone(query.structuredSignals):{}
  };
}

export async function retrieveAutobiographicalRecords(journal,query,{maxResults=3,minScore=.20,weights=DEFAULT_WEIGHTS}={}){
  if(!Number.isInteger(maxResults)||maxResults<1||maxResults>20)throw new TypeError('maxResults must be an integer in [1,20]');
  if(typeof minScore!=='number'||minScore<0||minScore>1)throw new TypeError('minScore must be in [0,1]');
  const verification=await verifyAutobiographicalJournal(journal);
  if(!verification.valid)throw new Error(`Autobiographical recall blocked by integrity failure: ${verification.errors.join('; ')}`);
  const normalized=normalizeQuery(query);
  const queryTokens=tokenize(normalized.text);
  const episodes=journal.records.filter(record=>record.kind==='episode');
  const maxSequence=Math.max(1,...episodes.map(record=>record.sequence));

  const scored=episodes.map(record=>{
    const contentText=canonicalJson(record.content);
    const tokenOverlap=overlapFraction(queryTokens,tokenize(contentText));
    const type=record.content?.type??null;
    const source=record.content?.source??null;
    const typeMatch=normalized.preferredTypes.includes(type)?1:0;
    const sourceMatch=normalized.preferredSources.includes(source)?1:0;
    const signals=signalMetrics(normalized.structuredSignals,record.content);
    const recency=record.sequence/maxSequence;
    const score=round(clamp01(
      tokenOverlap*weights.tokenOverlap+
      typeMatch*weights.typeMatch+
      sourceMatch*weights.sourceMatch+
      signals.keyOverlap*weights.structuredKeyOverlap+
      signals.valueAgreement*weights.structuredValueAgreement+
      recency*weights.recency
    ));
    return {
      recordId:record.eventId,
      sequence:record.sequence,
      epochId:record.epochId,
      epistemicStatus:record.epistemicStatus,
      historical:true,
      score,
      scoreComponents:{
        tokenOverlap:round(tokenOverlap),typeMatch,sourceMatch,
        structuredKeyOverlap:round(signals.keyOverlap),structuredValueAgreement:round(signals.valueAgreement),
        recency:round(recency),matchedSignalKeys:signals.matchedKeys,conflictingSignalKeys:signals.conflictingKeys
      },
      content:structuredClone(record.content),
      recordHash:record.hash
    };
  }).sort((a,b)=>b.score-a.score||b.sequence-a.sequence||a.recordId.localeCompare(b.recordId));

  const eligible=scored.filter(item=>item.score>=minScore);
  const selected=eligible.slice(0,maxResults);
  const selectedIds=new Set(selected.map(item=>item.recordId));
  const rejected=scored.filter(item=>!selectedIds.has(item.recordId)).map(item=>({
    ...item,
    rejectionReason:item.score<minScore?'below-min-score':'bounded-retrieval-capacity'
  }));

  return Object.freeze({
    query:normalized,
    recallAuthority:'shadow-only',
    actionAuthority:'none',
    journalVerification:{recordCount:verification.recordCount,lastVerifiedHash:verification.lastVerifiedHash,currentEpochId:verification.currentEpochId},
    selected,
    rejected,
    parameters:{maxResults,minScore,weights:{...weights}}
  });
}
