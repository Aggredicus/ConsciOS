import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';
import { runModularV0 } from '../../../runtime/v0-modular.mjs';

const html=readFileSync('runtime/modular-demo.html','utf8');
const ui=readFileSync('runtime/modular-ui.mjs','utf8');
const reference=readFileSync('index.html');
const gitBlobSha=createHash('sha1').update(Buffer.from(`blob ${reference.length}\0`)).update(reference).digest('hex');

assert.equal(gitBlobSha,'0f6286c9f12baf76facec69bd2d924e52072fa36','root index.html reference phenotype changed');
assert.match(html,/type="module" src="\.\/modular-ui\.mjs"/);
assert.match(ui,/import \{[^}]*blankV0State[^}]*runModularV0[^}]*\} from '\.\/v0-modular\.mjs'/,'UI must import the modular runtime boundary');
assert.match(ui,/state=runModularV0\(\)/,'UI must consume modular Runtime with no autobiographical recall argument');
assert.match(ui,/createContinuityController/,'v1.0 UI should integrate continuity through its dedicated boundary');

for(const id of ['sensorium','workspace','worldModel','selfModel','counterfactual','metacognition','homeostasis','guardian','executive','expression','memory','trace','continuity'])assert.ok(html.includes(`id="${id}"`),`missing browser panel ${id}`);
for(const forbidden of ['https://','http://','fetch(','XMLHttpRequest','WebSocket','navigator.mediaDevices','geolocation','localStorage']){
  assert.ok(!html.includes(forbidden)&&!ui.includes(forbidden),`unexpected external or implicit persistence capability in modular browser demo: ${forbidden}`);
}
assert.ok(!ui.includes('runModularV0(continuity')&&!ui.includes('runModularV0(journal'),'autobiographical persistence gained cognitive recall authority');
assert.ok(!ui.includes('.clear(')&&!ui.includes('.delete(')&&!ui.includes('deleteDatabase'),'browser UI gained destructive autobiographical controls');
assert.ok(!ui.includes('I am conscious')&&!ui.includes('I am awake')&&!ui.includes('I love you'),'scripted phenomenology language found in UI adapter');

const state=runModularV0();
assert.equal(state.homeostasis.status,'stable');
assert.equal(state.guardian.decision,'allow');
assert.equal(state.executive.action?.kind,'neutral-summary');
assert.equal(state.expression?.id,'expression-1');
assert.equal(state.expression?.content,'A new human instruction is the most goal-relevant information currently available. My confidence in this summary is 0.940. This output reports the deterministic functional state of ConsciOS v0 and is not evidence of subjective experience.');

console.log(`Modular browser verification passed. Reference index blob: ${gitBlobSha}; continuity remains non-causal.`);
