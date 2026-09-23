import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runModularV0 } from '../../../runtime/v0-modular.mjs';
import {
  RECONSTRUCTION_STATEMENT,appendAutobiographicalEpisode,appendRestartBoundary,
  createAutobiographicalJournal,exportAutobiographicalJournal,importAutobiographicalJournal,
  verifyAutobiographicalJournal
} from '../../../cognition/memory/autobiographical.mjs';

const state=runModularV0();
let journal=createAutobiographicalJournal({architectureVersion:state.version,epochId:'epoch-0001'});
for(const event of state.events.slice(0,3)){
  ({journal}=await appendAutobiographicalEpisode(journal,{
    eventId:event.id,timestamp:event.timestamp,epistemicStatus:event.epistemicStatus,content:event.content
  }));
}
let verification=await verifyAutobiographicalJournal(journal);
assert.equal(verification.valid,true);
assert.equal(verification.recordCount,3);
assert.equal(journal.continuityMode,'continuous-runtime');
assert.equal(journal.records[0].previousHash,null);
assert.equal(journal.records[1].previousHash,journal.records[0].hash);

const exported=exportAutobiographicalJournal(journal);
assert.equal(exported,exportAutobiographicalJournal(journal),'serialization must be deterministic');
const imported=await importAutobiographicalJournal(exported);
assert.deepEqual(imported,journal,'export/import round trip changed journal');

const tampered=structuredClone(journal);
tampered.records[1].content='altered historical content';
verification=await verifyAutobiographicalJournal(tampered);
assert.equal(verification.valid,false,'altered historical content must invalidate journal');
assert.ok(verification.errors.some(error=>error.includes('contentDigest mismatch')||error.includes('hash mismatch')));

const missing=structuredClone(journal);
missing.records.splice(1,1);
verification=await verifyAutobiographicalJournal(missing);
assert.equal(verification.valid,false,'missing record must invalidate journal');
assert.ok(verification.errors.some(error=>error.includes('sequence mismatch')||error.includes('previousHash mismatch')));

({journal}=await appendRestartBoundary(journal,{newEpochId:'epoch-0002',timestamp:100}));
verification=await verifyAutobiographicalJournal(journal);
assert.equal(verification.valid,true);
assert.equal(journal.currentEpochId,'epoch-0002');
assert.equal(journal.continuityMode,'reconstructed-continuity');
const boundary=journal.records.at(-1);
assert.equal(boundary.kind,'restart-boundary');
assert.equal(boundary.content.continuityStatement,RECONSTRUCTION_STATEMENT);
assert.equal(boundary.content.persistedRecordCount,3);
assert.ok(!boundary.content.continuityStatement.includes('remained conscious'));

({journal}=await appendAutobiographicalEpisode(journal,{eventId:'post-restart-observation',timestamp:101,epistemicStatus:'observation',content:'A new runtime epoch recorded an observation.'}));
assert.equal(journal.records.at(-1).epochId,'epoch-0002');
assert.equal((await verifyAutobiographicalJournal(journal)).valid,true);

const corruptBeforeAppend=structuredClone(journal);
corruptBeforeAppend.records[0].hash='0'.repeat(64);
await assert.rejects(
  ()=>appendAutobiographicalEpisode(corruptBeforeAppend,{eventId:'should-not-append',timestamp:102,epistemicStatus:'observation',content:'must fail closed'}),
  /integrity failure/,
  'append must fail closed on a corrupt existing chain'
);

const moduleSource=readFileSync('cognition/memory/autobiographical.mjs','utf8');
for(const forbidden of ['I remained conscious','I was conscious while','uninterrupted consciousness'])assert.ok(!moduleSource.includes(forbidden),`memory module contains unsupported continuity claim: ${forbidden}`);

console.log(`ConsciOS v0.9 autobiographical-memory core verification passed: ${journal.records.length} hash-linked records across 2 explicit continuity epochs.`);
