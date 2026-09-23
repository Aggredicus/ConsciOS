export const DELEGATION_SCHEMA_VERSION='1.0.0';
const required=['problem','evidence','hypothesis','requestedChange','constraints','acceptanceCriteria'];
const nonempty=x=>typeof x==='string'&&x.trim().length>0;
export function createDevelopmentRequest(input={}){
  for(const k of required)if(k==='constraints'||k==='acceptanceCriteria'? !Array.isArray(input[k])||!input[k].length : !nonempty(input[k]))throw new TypeError(`development request requires ${k}`);
  return Object.freeze({
    schemaVersion:DELEGATION_SCHEMA_VERSION,
    id:input.id||crypto.randomUUID(),
    createdAt:input.createdAt||new Date().toISOString(),
    sourceCausalEventIds:Object.freeze([...(input.sourceCausalEventIds||[])]),
    problem:input.problem.trim(),evidence:input.evidence.trim(),hypothesis:input.hypothesis.trim(),
    requestedChange:input.requestedChange.trim(),
    constraints:Object.freeze(input.constraints.map(String)),
    acceptanceCriteria:Object.freeze(input.acceptanceCriteria.map(String)),
    authorization:Object.freeze({scope:'proposal-only',protectedMainWrite:false,protectedGenomeWrite:false,humanMergeRequired:true})
  });
}
export function validateDevelopmentResult(request,result={}){
  if(request?.schemaVersion!==DELEGATION_SCHEMA_VERSION)throw new TypeError('valid development request required');
  const checks=(request.acceptanceCriteria||[]).map((criterion,i)=>Object.freeze({criterion,passed:Boolean(result.acceptance?.[i]),evidence:result.evidence?.[i]??null}));
  return Object.freeze({requestId:request.id,checks:Object.freeze(checks),allPassed:checks.length>0&&checks.every(x=>x.passed),
    mergeAuthorized:false,rationale:'Automated evaluation may recommend a candidate but cannot authorize protected-main merge.'});
}
