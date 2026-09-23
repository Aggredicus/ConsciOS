import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { IndexedDBAutobiographicalStore } from '../../../runtime/storage/indexeddb-autobiographical.mjs';

assert.throws(()=>new IndexedDBAutobiographicalStore({indexedDB:null}),/IndexedDB is unavailable/);

const source=readFileSync('runtime/storage/indexeddb-autobiographical.mjs','utf8');
for(const required of ['indexedDB.open','createObjectStore','objectStore(this.storeName).get','objectStore(this.storeName).put','verifyAutobiographicalJournal']){
  assert.ok(source.includes(required),`IndexedDB adapter missing required verified persistence mechanism: ${required}`);
}
for(const forbidden of ['deleteDatabase','.delete(','.clear(','localStorage','fetch(','XMLHttpRequest','WebSocket','http://','https://']){
  assert.ok(!source.includes(forbidden),`v0.9 persistence adapter contains forbidden destructive/external capability: ${forbidden}`);
}
assert.ok(!source.includes('uninterrupted consciousness'),'persistence adapter must not claim phenomenal continuity');
assert.ok(!source.includes('I am the same consciousness'),'persistence adapter must not claim identity continuity');

console.log('ConsciOS v0.9 IndexedDB persistence adapter verification passed: verified load/save only; no destructive API exposed.');
