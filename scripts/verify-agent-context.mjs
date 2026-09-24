import assert from 'node:assert/strict';
import fs from 'node:fs';import os from 'node:os';import path from 'node:path';
import { buildAgentContext,materializeAgentContext } from './build-agent-context.mjs';

const base=buildAgentContext({role:'GlobalWorkspace',task:'CI scoped-context test',incoming:['schemas/cognitive-event.schema.json']});
const paths=base.files.map(x=>x.path);
assert.ok(paths.some(x=>x.startsWith('cognition/workspace/')),'owned Workspace source missing');
assert.ok(paths.some(x=>x.startsWith('interfaces/')),'interfaces missing');
assert.ok(paths.includes('CONSCIOS_CHARTER.md'),'Charter missing');
assert.ok(paths.includes('schemas/cognitive-event.schema.json'),'incoming artifact missing');
assert.ok(!paths.some(x=>x.startsWith('runtime/')),'runtime leaked into scoped Workspace context');
assert.ok(!paths.some(x=>x.startsWith('cognition/self-model/')),'SelfModel leaked into Workspace context without expansion');

const expanded=buildAgentContext({role:'GlobalWorkspace',task:'CI explicit expansion test',incoming:['schemas/cognitive-event.schema.json'],expansions:[{artifact:'cognition/self-model/MODULE.md',reason:'Inspect the declared SelfModel interface boundary only'}]});
const expandedPaths=expanded.files.map(x=>x.path);
assert.ok(expandedPaths.includes('cognition/self-model/MODULE.md'),'explicit expansion missing');
assert.ok(!expandedPaths.includes('cognition/self-model/v0.mjs'),'expansion widened beyond named artifact');
assert.equal(expanded.contextExpansions.length,1);
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'conscios-context-'));materializeAgentContext(base,{destination:dir});
assert.ok(fs.existsSync(path.join(dir,'CONTEXT_MANIFEST.json')),'materialized context manifest missing');
assert.ok(!fs.existsSync(path.join(dir,'runtime')),'materialized context contains forbidden runtime');
fs.rmSync(dir,{recursive:true,force:true});
console.log(`Role-scoped context verification passed: ${base.files.length} files exposed to GlobalWorkspace, explicit expansion remained single-artifact.`);
