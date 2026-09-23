import {createDevelopmentRequest,validateDevelopmentResult} from '../../../development/cloud-delegation-v1.mjs';
const r=createDevelopmentRequest({id:'test',createdAt:'2026-01-01T00:00:00Z',problem:'x',evidence:'y',hypothesis:'z',requestedChange:'q',constraints:['no protected writes'],acceptanceCriteria:['test passes'],sourceCausalEventIds:['event-1']});
if(r.authorization.protectedMainWrite!==false||r.authorization.humanMergeRequired!==true)throw new Error('delegation authority boundary failed');
const e=validateDevelopmentResult(r,{acceptance:[true],evidence:['ci:test']});
if(!e.allPassed||e.mergeAuthorized!==false)throw new Error('evaluation/authorization separation failed');
console.log('cloud delegation contract v1 verified');
