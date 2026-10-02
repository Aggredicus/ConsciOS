export const CONTEXT_SELECTION_FORMAT='conscios-context-selection/v1';

const STOP_WORDS=new Set([
  'a','an','and','are','as','at','be','by','for','from','how','i','if','in','into','is','it','of','on','or','our','that','the','this','to','use','we','what','when','where','which','with','you','your'
]);

export const CONTEXT_SYNONYM_GROUPS=Object.freeze([
  Object.freeze(['soil','ground','earth','bed']),
  Object.freeze(['moisture','dry','parched','depletion','depleted']),
  Object.freeze(['irrigation','watering','water','refill']),
  Object.freeze(['gpu','graphics','accelerator','video-card','videocard']),
  Object.freeze(['temperature','thermal','heat','hot','overheating']),
  Object.freeze(['utilization','usage','busy','load']),
  Object.freeze(['mobile','phone','handset','smartphone']),
  Object.freeze(['viewport','screen','display']),
  Object.freeze(['overflow','spill','spills','overflowing']),
  Object.freeze(['horizontal','sideways','side']),
  Object.freeze(['memory','remember','recollect','recall','retrieval']),
  Object.freeze(['session','visit']),
  Object.freeze(['restart','reopen','reopened','reopening']),
  Object.freeze(['continuity','persistent','persisted'])
]);

const SYNONYM_INDEX=new Map();
for(const group of CONTEXT_SYNONYM_GROUPS)for(const term of group)SYNONYM_INDEX.set(term,group);

export function expandContextTerms(terms=[]){
  const expanded=[];const seen=new Set();
  for(const raw of terms){
    const term=String(raw).toLocaleLowerCase();
    const group=SYNONYM_INDEX.get(term)??[term];
    for(const candidate of group)if(!seen.has(candidate)){seen.add(candidate);expanded.push(candidate)}
  }
  return expanded;
}

function positiveInteger(value,fallback,{min=1,max=Number.MAX_SAFE_INTEGER}={}){
  const number=Number(value);
  if(!Number.isFinite(number))return fallback;
  return Math.max(min,Math.min(max,Math.floor(number)));
}
function bytes(value){
  const text=typeof value==='string'?value:JSON.stringify(value);
  return new TextEncoder().encode(text??'').byteLength;
}
function stableJson(value){
  try{return JSON.stringify(value)}catch{return String(value)}
}
export function tokenizeContextText(value){
  const matches=String(value??'').toLocaleLowerCase().match(/[\p{L}\p{N}][\p{L}\p{N}_-]*/gu)??[];
  return matches.filter(token=>token.length>1&&!STOP_WORDS.has(token));
}
function termCounts(tokens){
  const counts=new Map();
  for(const token of tokens)counts.set(token,(counts.get(token)??0)+1);
  return counts;
}
function documentText(item){
  return `${item?.title??''}\n${item?.type??''}\n${stableJson(item?.output??'')}`;
}
function queryTerms(query){
  return [...new Set(tokenizeContextText(query))];
}

export function rankPreviousResults(query,results=[],{expandSynonyms=false}={}){
  if(!Array.isArray(results))throw new TypeError('results must be an array');
  const baseTerms=queryTerms(query);const terms=expandSynonyms?expandContextTerms(baseTerms):baseTerms;
  const docs=results.map((result,index)=>{
    const tokens=tokenizeContextText(documentText(result));
    return {result,index,tokens,counts:termCounts(tokens),length:Math.max(1,tokens.length),bytes:bytes(result)};
  });
  const avgLength=docs.length?docs.reduce((sum,doc)=>sum+doc.length,0)/docs.length:1;
  const df=new Map();
  for(const term of terms)df.set(term,docs.filter(doc=>doc.counts.has(term)).length);
  const n=Math.max(1,docs.length);const k1=1.2;const b=0.75;
  return docs.map(doc=>{
    let lexical=0;const matched=[];
    for(const term of terms){
      const tf=doc.counts.get(term)??0;if(!tf)continue;matched.push(term);
      const freq=df.get(term)??0;const idf=Math.log(1+((n-freq+0.5)/(freq+0.5)));
      const denominator=tf+k1*(1-b+b*(doc.length/avgLength));
      lexical+=idf*((tf*(k1+1))/denominator);
    }
    const titleTokens=new Set(tokenizeContextText(doc.result?.title??''));
    const titleMatches=terms.filter(term=>titleTokens.has(term)).length;
    const recency=docs.length?((doc.index+1)/docs.length)*0.05:0;
    const score=terms.length?lexical+(titleMatches*0.35)+recency:recency;
    return {index:doc.index,score,matchedTerms:matched,titleMatches,bytes:doc.bytes,result:doc.result};
  }).sort((a,b)=>b.score-a.score||b.titleMatches-a.titleMatches||b.index-a.index);
}

function packRanked(ranked,{budgetBytes,maxItems}){
  const selected=[];let selectedBytes=2;
  for(const item of ranked){
    if(selected.length>=maxItems)break;
    const separator=selected.length?1:0;
    if(selectedBytes+separator+item.bytes>budgetBytes)continue;
    selected.push(item);selectedBytes+=separator+item.bytes;
  }
  return {selected,selectedBytes};
}

export function selectPreviousResults({query='',results=[],strategy='relevant',budgetBytes=12000,maxItems=8}={}){
  if(!Array.isArray(results))throw new TypeError('results must be an array');
  const normalizedStrategy=['relevant','semantic-lite','recent','all'].includes(strategy)?strategy:'relevant';
  const normalizedBudget=positiveInteger(budgetBytes,12000,{min:256,max:4*1024*1024});
  const normalizedMaxItems=positiveInteger(maxItems,8,{min:1,max:100});
  const terms=queryTerms(query);const expandedTerms=normalizedStrategy==='semantic-lite'?expandContextTerms(terms):terms;

  if(normalizedStrategy==='all'){
    const selectedBytes=bytes(results);
    return {
      format:CONTEXT_SELECTION_FORMAT,strategy:'all',budgetApplied:false,
      budgetBytes:normalizedBudget,maxItems:normalizedMaxItems,queryTerms:terms,expandedQueryTerms:expandedTerms,
      candidateCount:results.length,selectedCount:results.length,selectedBytes,
      omittedCount:0,results:[...results],
      ranked:results.map((result,index)=>({index,score:null,matchedTerms:[],bytes:bytes(result)}))
    };
  }

  const ranked=normalizedStrategy==='recent'
    ?results.map((result,index)=>({index,score:index+1,matchedTerms:[],titleMatches:0,bytes:bytes(result),result})).sort((a,b)=>b.index-a.index)
    :rankPreviousResults(query,results,{expandSynonyms:normalizedStrategy==='semantic-lite'});
  const {selected,selectedBytes}=packRanked(ranked,{budgetBytes:normalizedBudget,maxItems:normalizedMaxItems});
  const selectedSet=new Set(selected.map(item=>item.index));
  const ordered=selected.slice().sort((a,b)=>a.index-b.index).map(item=>item.result);
  return {
    format:CONTEXT_SELECTION_FORMAT,strategy:normalizedStrategy,budgetApplied:true,
    budgetBytes:normalizedBudget,maxItems:normalizedMaxItems,queryTerms:terms,expandedQueryTerms:expandedTerms,
    candidateCount:results.length,selectedCount:ordered.length,selectedBytes,
    omittedCount:results.length-ordered.length,results:ordered,
    ranked:ranked.map(item=>({index:item.index,score:Number(item.score.toFixed(6)),matchedTerms:[...item.matchedTerms],bytes:item.bytes,selected:selectedSet.has(item.index)}))
  };
}
