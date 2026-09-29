import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {CELL_TYPES,PYODIDE_VERSION,createCell,createNotebook,interpolateText,parseParameters,validateNotebook} from '../../../local/workbench/notebook-engine.mjs';

const notebook=createNotebook({title:'Verification notebook'});
assert.equal(validateNotebook(notebook),notebook);
assert.equal(notebook.format,'conscios-notebook/v1');
assert.ok(notebook.cells.some(cell=>cell.type==='parameters'));
assert.ok(notebook.cells.some(cell=>cell.type==='ai'));

for(const required of ['markdown','parameters','ai','javascript','python','procedure','world-inspect','property-inspector','node-graph','spatial-prompt','playtest','macro'])assert.ok(CELL_TYPES[required],`missing workbench cell type ${required}`);

assert.deepEqual(parseParameters('{"scale":2,"project":"ConsciOS"}'),{scale:2,project:'ConsciOS'});
assert.equal(interpolateText('scale={{ scale }} project={{project}}',{scale:2,project:'ConsciOS'}),'scale=2 project=ConsciOS');
assert.throws(()=>parseParameters('[1,2,3]'),/JSON object/);
assert.throws(()=>createCell('undeclared-cell'),/unsupported cell type/);
assert.match(PYODIDE_VERSION,/^\d+\.\d+\.\d+$/);

const ui=readFileSync('local/workbench/workbench.mjs','utf8');
const html=readFileSync('local/workbench/index.html','utf8');
assert.ok(ui.includes("createExoInferenceProvider"),'workbench is not wired to exo provider');
assert.ok(ui.includes("createBrowserLocalInferenceProvider"),'workbench is not wired to browser-local provider');
assert.ok(ui.includes("createDeterministicMockModel"),'deterministic control is missing');
assert.ok(ui.includes('No fallback'),'provider failure must remain explicit in the UI');
assert.ok(ui.includes("requestingModule:'ObserverScientist'"),'AI notebook output should remain an ObserverScientist inference artifact in v1');
assert.ok(html.includes('Cognitive Workbench'));
assert.ok(html.includes('exo cluster'));
assert.ok(html.includes('Browser local'));
assert.ok(html.includes('Tool bridge'));
assert.ok(html.includes('Not a consciousness indicator'));

for(const forbidden of ['apiKey','API_KEY','githubToken','GITHUB_TOKEN'])assert.ok(!ui.includes(forbidden)&&!html.includes(forbidden),`workbench unexpectedly references credential material: ${forbidden}`);

console.log('Cognitive Workbench static contract verification passed. Notebook/provider/tool boundaries remain explicit.');
