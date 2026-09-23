import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import assert from 'node:assert/strict';
import { runModularV0 } from '../../../runtime/v0-modular.mjs';

const output='dist/conscios-modular.html';
execFileSync(process.execPath,['scripts/build-portable.mjs'],{stdio:'inherit'});
const first=readFileSync(output,'utf8');
const firstHash=createHash('sha256').update(first).digest('hex');
execFileSync(process.execPath,['scripts/build-portable.mjs'],{stdio:'inherit'});
const second=readFileSync(output,'utf8');
const secondHash=createHash('sha256').update(second).digest('hex');
assert.equal(secondHash,firstHash,'portable build is not byte-for-byte reproducible');

assert.match(first,/v1\.0 portable modular build · generated/);
assert.match(first,/GENERATED FILE: source of truth is the modular cognition\/runtime tree/);
assert.match(first,/name="conscios-source-digest" content="[a-f0-9]{64}"/);
assert.ok(!first.includes('src="./modular-ui.mjs"'),'external module bootstrap remains in portable artifact');
assert.ok(!/https?:\/\//.test(first),'portable artifact must not contain external HTTP(S) resources');
assert.match(first,/<script type="module">import '@conscios\/ui';<\/script>/);
assert.match(first,/recall authority: none/i,'portable artifact must disclose that autobiographical memory has no recall authority');

const mapMatch=first.match(/<script type="importmap">\n([\s\S]*?)\n<\/script>/);
assert.ok(mapMatch,'inline import map not found');
const map=JSON.parse(mapMatch[1]);
const entries=Object.entries(map.imports??{});
assert.equal(entries.length,17,'portable module graph changed unexpectedly');
for(const [id,url] of entries){
  assert.ok(id.startsWith('@conscios/'),`unexpected module ID ${id}`);
  assert.ok(url.startsWith('data:text/javascript;base64,'),`module ${id} is not embedded as data URL`);
  const decoded=Buffer.from(url.slice('data:text/javascript;base64,'.length),'base64').toString('utf8');
  assert.ok(!/from\s+['"]\.\.?\//.test(decoded),`relative import remains in embedded ${id}`);
}

const state=runModularV0();
assert.equal(state.guardian.decision,'allow');
assert.equal(state.executive.action?.kind,'neutral-summary');
assert.equal(state.expression?.content,'A new human instruction is the most goal-relevant information currently available. My confidence in this summary is 0.940. This output reports the deterministic functional state of ConsciOS v0 and is not evidence of subjective experience.');

console.log(`Portable v1.0 build verification passed: ${Buffer.byteLength(first)} bytes, 17 embedded modules, SHA-256 ${firstHash}`);
