import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {existsSync,readFileSync} from 'node:fs';
import {dirname,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

const root=resolve(dirname(fileURLToPath(import.meta.url)),'../../..');
const entrypoints=[
  'local/encounter/encounter-ui.mjs',
  'local/local-ui.mjs',
  'runtime/models/model-manifest.mjs',
  'runtime/models/browser-transformers-host.mjs',
  'runtime/cognitive-model-adapter-v2.mjs',
  'runtime/experience-frame-v1.7.mjs'
];

for(const rel of entrypoints){
  const file=resolve(root,rel);
  assert.ok(existsSync(file),`browser/runtime entrypoint missing: ${rel}`);
  execFileSync(process.execPath,['--check',file],{stdio:'pipe'});
  const source=readFileSync(file,'utf8');
  assert.ok(!/;\\n(?:import|export)\b/.test(source),`literal escaped newline before module declaration: ${rel}`);
  for(const match of source.matchAll(/(?:import|export)\s+(?:[^'\"]*?\s+from\s+)?['\"]([^'\"]+)['\"]/g)){
    const spec=match[1];
    if(!spec.startsWith('.')) continue;
    const target=resolve(dirname(file),spec);
    assert.ok(existsSync(target),`unresolved relative module ${spec} from ${rel}`);
  }
}

const ui=readFileSync(resolve(root,'local/encounter/encounter-ui.mjs'),'utf8');
const html=readFileSync(resolve(root,'local/encounter/index.html'),'utf8');
assert.ok(html.includes('<select id="model"></select>'),'Encounter must retain model selector');
assert.ok(ui.includes('STARTER_MODELS.map('),'Encounter must populate model selector from manifest');
assert.ok(ui.includes("$('model').innerHTML="),'Encounter must assign generated model options');
assert.ok(ui.includes("m.id==='qwen3-0.6b'?'selected':''"),'Encounter must define a deterministic default model');
assert.ok(ui.includes('await detectBrowserAICapabilities()'),'Encounter startup must measure browser capability after wiring controls');

const manifest=await import(resolve(root,'runtime/models/model-manifest.mjs'));
assert.ok(Array.isArray(manifest.STARTER_MODELS)&&manifest.STARTER_MODELS.length>=1,'starter model manifest must not be empty');
const ids=manifest.STARTER_MODELS.map(m=>m.id);
assert.equal(new Set(ids).size,ids.length,'starter model IDs must be unique');
for(const m of manifest.STARTER_MODELS){
  assert.equal(typeof m.id,'string');
  assert.ok(m.id.length>0,'model id must be non-empty');
  assert.equal(typeof m.label,'string');
  assert.ok(m.label.length>0,'model label must be non-empty');
}
console.log(`Browser entrypoint quality gate passed: ${entrypoints.length} modules parse, relative imports resolve, and ${manifest.STARTER_MODELS.length} encounter models are available.`);
