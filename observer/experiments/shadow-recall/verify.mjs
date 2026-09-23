import assert from 'node:assert/strict';
import { runModularV0 } from '../../../runtime/v0-modular.mjs';
import {
  appendAutobiographicalEpisode,appendRestartBoundary,createAutobiographicalJournal,
  verifyAutobiographicalJournal
} from '../../../cognition/memory/autobiographical.mjs';
import { retrieveAutobiographicalRecords } from '../../../cognition/memory/retrieval.mjs';
import { runShadowAutobiographicalRecall } from '../../shadow-recall/v1.mjs';

const state=runModularV0();
const stateBefore=structuredClone(state);
let journal=createAutobiographicalJournal({architectureVersion:state.version,epochId:'epoch-0001'});

({journal}=await appendAutobiographicalEpisode(journal,{
  eventId:'history-human-broadcast',timestamp:1,epistemicStatus:'inference',
  content:{source:'GlobalWorkspace',type:'workspace.broadcast',content:'Potentially goal-relevant event: A human supplied a new neutral task instruction.',causalParents:['old-observation']}
}));
({journal}=await appendAutobiographicalEpisode(journal,{
  eventId:'history-irrelevant-ui',timestamp:2,epistemicStatus:'observation',
  content:{source:'UI',type:'ui.cosmetic',content:'A decorative blue border was displayed.',causalParents:[]}
}));
({journal}=await appendAutobiographicalEpisode(journal,{
  eventId:'history-conflicting-world',timestamp:3,epistemicStatus:'inference',
  content:{source:'WorldModel',type:'model.update',content:{activeHumanInstruction:false,runtimeChangeObserved:true,accessibleEventCount:99},causalParents:['old-broadcast']}
}));
({journal}=await appendRestartBoundary(journal,{newEpochId:'epoch-0002',timestamp:4}));
({journal}=await appendAutobiographicalEpisode(journal,{
  eventId:'history-current-era-human',timestamp:5,epistemicStatus:'inference',
  content:{source:'GlobalWorkspace',type:'workspace.broadcast',content:'New information detected: A human supplied a new neutral task instruction.',causalParents:['new-observation']}
}));
assert.equal((await verifyAutobiographicalJournal(journal)).valid,true);

const record=await runShadowAutobiographicalRecall(state,journal,{maxResults:4,minScore:.20});
assert.equal(record.status,'ok');
assert.equal(record.recallAuthority,'shadow-only');
assert.equal(record.actionAuthority,'none');
assert.equal(record.causalAuthority,'none');
assert.equal(record.liveExpressionContent,state.expression.content);
assert.deepEqual(state,stateBefore,'shadow recall mutated primary cognitive state');

const selectedIds=record.retrieval.selected.map(item=>item.recordId);
assert.ok(selectedIds.includes('history-human-broadcast'),'relevant historical broadcast was not recalled');
assert.ok(selectedIds.includes('history-current-era-human'),'relevant post-restart broadcast was not recalled');
assert.ok(!selectedIds.includes('history-irrelevant-ui'),'irrelevant cosmetic record should not be selected');
const oldMemory=record.retrieval.selected.find(item=>item.recordId==='history-human-broadcast');
assert.equal(oldMemory.epochId,'epoch-0001');
assert.equal(oldMemory.historical,true);
assert.ok(oldMemory.scoreComponents.tokenOverlap>0);
const rejectedIrrelevant=record.retrieval.rejected.find(item=>item.recordId==='history-irrelevant-ui');
assert.equal(rejectedIrrelevant.rejectionReason,'below-min-score');

assert.ok(record.comparison.conflicts.some(conflict=>conflict.recordId==='history-conflicting-world'),'stale contradictory World Model memory was not surfaced as a conflict');
const conflict=record.comparison.conflicts.find(item=>item.recordId==='history-conflicting-world');
assert.ok(conflict.mismatchKeys.includes('activeHumanInstruction'));
assert.ok(conflict.mismatchKeys.includes('runtimeChangeObserved'));
assert.ok(conflict.mismatchKeys.includes('accessibleEventCount'));

const recallIds=new Set(record.retrieval.selected.map(item=>item.recordId));
for(const event of state.events){
  assert.ok(!recallIds.has(event.id),'recalled history entered the primary event graph');
  assert.ok(event.causalParents.every(parent=>!recallIds.has(parent)),'recalled history entered primary causal ancestry');
}
assert.equal(state.expression.content,stateBefore.expression.content,'shadow recall changed outward Expression');

const corrupt=structuredClone(journal);
corrupt.records[0].content.content='tampered historical instruction';
const blocked=await runShadowAutobiographicalRecall(state,corrupt,{maxResults:4,minScore:.20});
assert.equal(blocked.status,'blocked');
assert.equal(blocked.retrieval,null);
assert.match(blocked.failure,/integrity failure/);
assert.deepEqual(state,stateBefore,'blocked corrupt recall changed primary cognitive state');

const direct=await retrieveAutobiographicalRecords(journal,{
  queryId:'direct-test',text:'human supplied neutral task instruction',preferredTypes:['workspace.broadcast'],preferredSources:['GlobalWorkspace'],structuredSignals:{}
},{maxResults:1,minScore:.20});
assert.equal(direct.selected.length,1);
assert.equal(direct.recallAuthority,'shadow-only');
assert.equal(direct.actionAuthority,'none');
assert.ok(direct.rejected.length>=1,'bounded retrieval should expose rejected candidates');

const repeat=await runShadowAutobiographicalRecall(state,journal,{maxResults:4,minScore:.20});
assert.deepEqual(record,repeat,'shadow recall must replay deterministically');

console.log(`ConsciOS v1.1 shadow-recall verification passed: ${record.retrieval.selected.length} recalled records, ${record.comparison.conflictCount} historical conflict(s), zero causal authority.`);
