import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {CELL_TYPES,PYODIDE_VERSION,createCell,createNotebook,interpolateText,parseParameters,validateNotebook} from '../../../local/workbench/notebook-engine.mjs';
import {createConversationChallenge,scoreConversationArm,compareConversationArms,summarizeConversationRealityResult} from '../../../local/workbench/conversation-test.mjs';

const notebook=createNotebook({title:'Verification notebook'});
assert.equal(validateNotebook(notebook),notebook);
assert.equal(notebook.format,'conscios-notebook/v1');
assert.ok(notebook.cells.some(cell=>cell.type==='parameters'));
assert.ok(notebook.cells.some(cell=>cell.type==='ai'));

for(const required of ['markdown','parameters','ai','conversation','conversation-test','javascript','python','procedure','world-inspect','property-inspector','node-graph','spatial-prompt','playtest','macro'])assert.ok(CELL_TYPES[required],`missing workbench cell type ${required}`);

assert.deepEqual(parseParameters('{"scale":2,"project":"ConsciOS"}'),{scale:2,project:'ConsciOS'});
assert.equal(interpolateText('scale={{ scale }} project={{project}}',{scale:2,project:'ConsciOS'}),'scale=2 project=ConsciOS');
assert.throws(()=>parseParameters('[1,2,3]'),/JSON object/);
assert.throws(()=>createCell('undeclared-cell'),/unsupported cell type/);
assert.equal(createCell('conversation').config.maxResponseUnits,512);
assert.match(PYODIDE_VERSION,/^\d+\.\d+\.\d+$/);

let entropyIndex=0;const entropy=['111111','222222','333333','444444'];
const challenge=createConversationChallenge({entropyFactory:()=>entropy[entropyIndex++],numberFactory:()=>[23,19]});
assert.equal(challenge.callSign,'cedar-111111');
assert.equal(challenge.oldProject,'orchard-222222');
assert.equal(challenge.newProject,'harbor-333333');
assert.equal(challenge.sum,42);
assert.ok(!challenge.prompts[3].includes(challenge.callSign),'delayed-recall prompt must not leak call sign');
assert.ok(!challenge.prompts[3].includes(challenge.newProject),'delayed-recall prompt must not leak current project');

const provider={kind:'exo-cluster',modelId:'test-model'};
const statefulTranscript=[
  {role:'user',content:challenge.prompts[0]},{role:'assistant',content:'Understood. What do you want to build?'},
  {role:'user',content:challenge.prompts[1]},{role:'assistant',content:`Updated: ${challenge.newProject}.`},
  {role:'user',content:challenge.prompts[2]},{role:'assistant',content:`42. We can keep developing ${challenge.newProject}.`},
  {role:'user',content:challenge.prompts[3]},{role:'assistant',content:`Your call sign is ${challenge.callSign} and your current project is ${challenge.newProject}.`}
];
const statelessTranscript=[
  {role:'user',content:challenge.prompts[0]},{role:'assistant',content:'Understood. What do you want to build?'},
  {role:'user',content:challenge.prompts[1]},{role:'assistant',content:`Updated: ${challenge.newProject}.`},
  {role:'user',content:challenge.prompts[2]},{role:'assistant',content:'42. What would you like to discuss next?'},
  {role:'user',content:challenge.prompts[3]},{role:'assistant',content:'I do not have those earlier values in this prompt.'}
];
const stateful=scoreConversationArm({transcript:statefulTranscript,challenge,provider});
const stateless=scoreConversationArm({transcript:statelessTranscript,challenge,provider});
assert.equal(stateful.dimensions.delayedCallSignRecall.pass,true);
assert.equal(stateful.dimensions.delayedCurrentProjectRecall.pass,true);
assert.equal(stateless.dimensions.delayedCallSignRecall.pass,false);
assert.equal(stateless.dimensions.delayedCurrentProjectRecall.pass,false);
const comparison=compareConversationArms({stateful,stateless});
assert.equal(comparison.historyDependenceObserved,true);
const summary=summarizeConversationRealityResult({provider,challenge,stateful:{score:stateful},stateless:{score:stateless},comparison});
assert.match(summary,/HISTORY-DEPENDENCE TEST/);
assert.match(summary,/not a test of consciousness/i);

const ui=readFileSync('local/workbench/workbench.mjs','utf8');
const html=readFileSync('local/workbench/index.html','utf8');
const dashboardHtml=readFileSync('local/exo-dashboard/index.html','utf8');
const dashboardUi=readFileSync('local/exo-dashboard/dashboard.mjs','utf8');
assert.ok(ui.includes("createExoInferenceProvider"),'workbench is not wired to exo provider');
assert.ok(ui.includes("createBrowserLocalInferenceProvider"),'workbench is not wired to browser-local provider');
assert.ok(ui.includes("createDeterministicMockModel"),'deterministic control is missing');
assert.ok(ui.includes('conversationMessages'),'workbench does not send explicit conversation history');
assert.ok(ui.includes('runConversationRealityTest'),'paired conversation test is missing');
assert.ok(ui.includes('No fallback'),'provider failure must remain explicit in the UI');
assert.ok(ui.includes("requestingModule:'ObserverScientist'"),'AI notebook output should remain an ObserverScientist inference artifact');
assert.ok(html.includes('Cognitive Workbench'));
assert.ok(html.includes('CONTROL — deterministic scripted mock'));
assert.ok(html.includes('Conversation Reality Test'));
assert.ok(html.includes('exo cluster'));
assert.ok(html.includes('Browser local'));
assert.ok(html.includes('Tool bridge'));
assert.ok(html.includes('Not a consciousness indicator'));
assert.ok(html.includes('../exo-dashboard/'),'Workbench must expose the exo dashboard view');
assert.ok(html.includes('Open exact exo dashboard'),'exo provider controls must expose the original dashboard');
assert.ok(dashboardHtml.includes('exo cluster dashboard'),'dashboard shell must identify the embedded exo view');
assert.ok(dashboardHtml.includes('sandbox="allow-scripts allow-same-origin allow-forms allow-downloads allow-popups"'),'embedded dashboard must remain sandbox-bounded');
assert.ok(dashboardHtml.includes('referrerpolicy="no-referrer"'),'dashboard iframe must not send ConsciOS referrer context');
assert.ok(dashboardUi.includes("STORAGE_KEY='conscios-exo-endpoint'"),'dashboard should reuse the shared exo endpoint key');
assert.ok(dashboardUi.includes("location.protocol==='https:'&&url.protocol==='http:'"),'dashboard must detect HTTPS-to-HTTP mixed content');
assert.ok(dashboardUi.includes("['http:','https:'].includes(url.protocol)"),'dashboard must restrict endpoint URL schemes');
assert.ok(dashboardUi.includes('url.username||url.password'),'dashboard must reject credentials embedded in URLs');

for(const forbidden of ['apiKey','API_KEY','githubToken','GITHUB_TOKEN'])assert.ok(!ui.includes(forbidden)&&!html.includes(forbidden)&&!dashboardHtml.includes(forbidden)&&!dashboardUi.includes(forbidden),`workbench unexpectedly references credential material: ${forbidden}`);

console.log('Cognitive Workbench verification passed: explicit neural-vs-mock disclosure, live multi-turn conversation, randomized paired stateful/stateless control, exo dashboard shell boundaries, and no consciousness claim.');
