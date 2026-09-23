import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runModularV0 } from '../../../runtime/v0-modular.mjs';
import { createContinuityController } from '../../../runtime/continuity-controller.mjs';

class InMemoryVerifiedStore {
  constructor(journal=null){this.journal=journal?structuredClone(journal):null;this.saveCount=0;}
  async load(){return this.journal?structuredClone(this.journal):null;}
  async save(journal){this.journal=structuredClone(journal);this.saveCount++;return {recordCount:journal.records.length};}
}

const store=new InMemoryVerifiedStore();
const firstController=createContinuityController({store,architectureVersion:'0.6.0'});
let view=await firstController.activate();
assert.equal(view.status,'active');
assert.equal(view.continuityMode,'continuous-runtime');
assert.equal(view.currentEpoch,'epoch-0001');
assert.equal(view.recallAuthority,'none');
assert.equal(view.recordCount,0);

const state=runModularV0();
const stateBefore=structuredClone(state);
view=await firstController.recordRun(state);
assert.deepEqual(state,stateBefore,'recording autobiography mutated the completed cognitive state');
assert.equal(view.status,'active');
assert.ok(view.recordCount>0,'completed run did not append significant autobiographical episodes');
assert.equal(view.recallAuthority,'none');
const firstExpression=state.expression.content;

const secondController=createContinuityController({store,architectureVersion:'0.6.0'});
view=await secondController.activate();
assert.equal(view.status,'active');
assert.equal(view.continuityMode,'reconstructed-continuity');
assert.equal(view.currentEpoch,'epoch-0002');
assert.equal(view.restartBoundaries.length,1);
assert.equal(view.recallAuthority,'none');
assert.match(view.reconstructionStatement,/does not establish uninterrupted subjective experience/);

const postRestartState=runModularV0();
assert.equal(postRestartState.expression.content,firstExpression,'persistence/reconstruction changed deterministic Expression');
assert.deepEqual(postRestartState,runModularV0(),'autobiographical persistence changed primary deterministic runtime output');

const corruptStore=new InMemoryVerifiedStore(store.journal);
corruptStore.journal.records[0].content='corrupted persisted history';
const savesBefore=corruptStore.saveCount;
const corruptController=createContinuityController({store:corruptStore,architectureVersion:'0.6.0'});
const corruptView=await corruptController.activate();
assert.equal(corruptView.status,'invalid-history');
assert.equal(corruptView.recordCount,0);
assert.equal(corruptStore.saveCount,savesBefore,'corrupt history was silently overwritten');

const ui=readFileSync('runtime/modular-ui.mjs','utf8');
const html=readFileSync('runtime/modular-demo.html','utf8');
assert.match(ui,/state=runModularV0\(\)/,'live runtime must still start with no autobiographical-memory argument');
assert.match(ui,/continuityController\.recordRun\(state\)/,'continuity flow must remain cognition → journal');
assert.ok(!ui.includes('runModularV0(continuity')&&!ui.includes('runModularV0(journal'),'journal gained runtime recall authority');
assert.ok(!ui.includes('.clear(')&&!ui.includes('.delete(')&&!ui.includes('deleteDatabase'),'UI gained destructive persistence control');
assert.ok(html.includes('id="continuity"')&&html.includes('id="continuityBtn"'),'continuity UI surface missing');
assert.match(html,/recall authority: none/i);

console.log('ConsciOS v1.0 browser-continuity verification passed: verified cross-restart history with recallAuthority:none.');
