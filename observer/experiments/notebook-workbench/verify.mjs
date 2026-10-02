import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {CELL_TYPES,PYODIDE_VERSION,createCell,createNotebook,interpolateText,parseParameters,validateNotebook} from '../../../local/workbench/notebook-engine.mjs';
import {createConversationChallenge,scoreConversationArm,compareConversationArms,summarizeConversationRealityResult} from '../../../local/workbench/conversation-test.mjs';
import {EXECUTION_PROTOCOL,EXECUTION_RESULT_FORMAT,createExecutionProvider,createExecutionRouter,createDefaultWorkbenchExecutionRouter} from '../../../local/workbench/execution-providers.mjs';
import {CONTEXT_SELECTION_FORMAT,rankPreviousResults,selectPreviousResults,tokenizeContextText} from '../../../local/workbench/context-selector.mjs';

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
const aiDefaults=createCell('ai').config;assert.equal(aiDefaults.contextStrategy,'relevant');assert.equal(aiDefaults.maxContextBytes,12000);assert.equal(aiDefaults.maxContextItems,8);
assert.match(PYODIDE_VERSION,/^\d+\.\d+\.\d+$/);

const executionProvider=createExecutionProvider({
  id:'ci-javascript',
  label:'CI JavaScript',
  location:'verification',
  cellTypes:['javascript'],
  capabilities:{network:false},
  execute:async(cell,context)=>({output:{source:cell.source,scale:context.parameters.scale},provenance:{kind:'ci-execution'}})
});
assert.equal(executionProvider.protocol,EXECUTION_PROTOCOL);
assert.equal(executionProvider.canExecute({type:'javascript'}),true);
assert.equal(executionProvider.canExecute({type:'python'}),false);
const executionRouter=createExecutionRouter();executionRouter.register(executionProvider);
const executionResult=await executionRouter.execute({type:'javascript',source:'return scale',config:{}},{parameters:{scale:3}});
assert.equal(executionResult.format,EXECUTION_RESULT_FORMAT);
assert.deepEqual(executionResult.output,{source:'return scale',scale:3});
assert.equal(executionResult.provenance.executionProvider.id,'ci-javascript');
assert.equal(executionResult.provenance.executionProvider.location,'verification');
await assert.rejects(()=>executionRouter.execute({type:'python',source:'',config:{}},{parameters:{}}),/No execution provider is registered/);
await assert.rejects(()=>executionRouter.execute({type:'javascript',source:'',config:{executionProvider:'missing'}},{parameters:{}}),/No fallback is active/);
assert.throws(()=>executionRouter.register(executionProvider),/already registered/);

const defaultExecutionRouter=createDefaultWorkbenchExecutionRouter();
assert.deepEqual(defaultExecutionRouter.records().map(item=>item.id).sort(),['browser-javascript','browser-python','http-tool-bridge']);
assert.equal(defaultExecutionRouter.providerFor({type:'javascript',config:{}}).id,'browser-javascript');
assert.equal(defaultExecutionRouter.providerFor({type:'python',config:{}}).id,'browser-python');
assert.equal(defaultExecutionRouter.providerFor({type:'playtest',config:{}}).id,'http-tool-bridge');

assert.deepEqual(tokenizeContextText('Soil moisture, soil-water & THE irrigation!'),['soil','moisture','soil-water','irrigation']);
const previousResults=[
  {cellId:'a',type:'javascript',title:'Music palette',output:{summary:'twelve tone chromatic colors and oscillator notes'}},
  {cellId:'b',type:'python',title:'Soil moisture model',output:{summary:'soil moisture deficit and irrigation scheduling for sandy loam'}},
  {cellId:'c',type:'markdown',title:'Camera notes',output:{summary:'lens focal length and video framing'}},
  {cellId:'d',type:'parameters',title:'Irrigation parameters',output:{fieldCapacity:0.28,refillPoint:0.17}}
];
const rankedContext=rankPreviousResults('Estimate soil moisture and irrigation timing',previousResults);
assert.equal(rankedContext[0].result.cellId,'b','lexical ranking should surface the most relevant prior result');
const boundedContext=selectPreviousResults({query:'Estimate soil moisture and irrigation timing',results:previousResults,strategy:'relevant',budgetBytes:420,maxItems:2});
assert.equal(boundedContext.format,CONTEXT_SELECTION_FORMAT);
assert.equal(boundedContext.budgetApplied,true);
assert.ok(boundedContext.selectedCount>=1&&boundedContext.selectedCount<=2);
assert.ok(boundedContext.selectedBytes<=boundedContext.budgetBytes,'bounded context exceeded byte budget');
assert.ok(boundedContext.results.some(item=>item.cellId==='b'),'relevant selection omitted the best soil result');
assert.ok(!boundedContext.results.some(item=>item.cellId==='a'),'bounded relevant selection should not prefer unrelated music context');
const recentContext=selectPreviousResults({query:'',results:previousResults,strategy:'recent',budgetBytes:1024,maxItems:1});
assert.deepEqual(recentContext.results.map(item=>item.cellId),['d']);
const legacyAllContext=selectPreviousResults({query:'soil',results:previousResults,strategy:'all',budgetBytes:256,maxItems:1});
assert.equal(legacyAllContext.budgetApplied,false);
assert.equal(legacyAllContext.selectedCount,previousResults.length);

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
const visualSystem=readFileSync('local/conscios-ui.css','utf8');
const exoLauncher=readFileSync('scripts/run-exo-local.mjs','utf8');
const localLabHtml=readFileSync('local/index.html','utf8');
const swarmHtml=readFileSync('local/swarm/index.html','utf8');
const encounterHtml=readFileSync('local/encounter/index.html','utf8');
const liveHtml=readFileSync('live/index.html','utf8');
assert.ok(ui.includes("createExoInferenceProvider"),'workbench is not wired to exo provider');
assert.ok(ui.includes("createBrowserLocalInferenceProvider"),'workbench is not wired to browser-local provider');
assert.ok(ui.includes("createDeterministicMockModel"),'deterministic control is missing');
assert.ok(ui.includes('createDefaultWorkbenchExecutionRouter'),'workbench must use the conscios-execution provider boundary');
assert.ok(ui.includes('executionRouter.execute'),'workbench executable cells must route through the execution provider contract');
assert.ok(ui.includes('selectPreviousResults')&&ui.includes(':context-selection'),'AI cells must expose deterministic previous-context selection provenance');
assert.ok(ui.includes('contextStrategy')&&ui.includes('maxContextBytes')&&ui.includes('maxContextItems'),'AI cell UI must expose context strategy and hard budgets');
assert.ok(!ui.includes('executeJavaScript(cell.source')&&!ui.includes('executeToolRequest(cell,context)'),'workbench UI must not directly dispatch browser/tool execution transports');
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
assert.ok(html.includes('../exo-dashboard/'),'Workbench must expose the exo application view');
assert.ok(html.includes('Open full exo app'),'exo provider controls must expose the native exo application');
assert.ok(html.includes('Runtime Center')&&html.includes('exoRuntimeMetrics'),'Workbench must expose live exo runtime resources');
assert.ok(ui.includes('refreshExoRuntime')&&ui.includes('renderExoRuntime'),'Workbench must refresh and render exo telemetry without a page reload');
assert.ok(html.includes('node scripts/run-exo-local.mjs'),'Workbench must expose a concrete local exo launch path');
assert.ok(html.includes('viewport-fit=cover'),'Workbench must support mobile safe-area viewport layout');

for(const route of ['data-route="/"','data-route="/downloads"','data-route="/integrations"','data-route="/traces"','data-route="/advanced"'])assert.ok(dashboardHtml.includes(route),`exo app shell is missing native route ${route}`);
assert.ok(dashboardHtml.includes('data-view="runtime"')&&dashboardHtml.includes('id="runtimePanel"'),'exo app shell must expose a ConsciOS runtime center');
assert.ok(dashboardUi.includes('refreshRuntimeCenter')&&dashboardUi.includes('runtimeNodesFromState'),'exo runtime center must be backed by live state parsing');
assert.ok(dashboardHtml.includes('Acceptance Test'),'exo app shell must expose the runtime acceptance gate');
assert.ok(dashboardHtml.includes('Run exo'),'exo app shell must expose runtime setup');
assert.ok(dashboardHtml.includes('title="Native exo software"'),'dashboard shell must identify the embedded native exo view');
assert.ok(dashboardHtml.includes('sandbox="allow-scripts allow-same-origin allow-forms allow-downloads allow-popups'),'embedded dashboard must remain sandbox-bounded');
assert.ok(!dashboardHtml.includes('allow-top-navigation'),'embedded dashboard must not gain parent-navigation authority');
assert.ok(dashboardHtml.includes('referrerpolicy="no-referrer"'),'dashboard iframe must not send ConsciOS referrer context');
assert.ok(dashboardUi.includes("ENDPOINT_KEY='conscios-exo-endpoint'"),'dashboard should reuse the shared exo runtime key');
assert.ok(dashboardUi.includes("location.protocol==='https:'")&&dashboardUi.includes("url.protocol==='http:'"),'dashboard must detect HTTPS-to-HTTP mixed content');
assert.ok(dashboardUi.includes('isLoopback'),'dashboard must distinguish loopback from LAN mixed-content endpoints');
assert.ok(dashboardUi.includes("['http:','https:'].includes(url.protocol)"),'dashboard must restrict runtime URL schemes');
assert.ok(dashboardUi.includes('url.username||url.password'),'dashboard must reject credentials embedded in URLs');
assert.ok(dashboardUi.includes("'/node_id'")&&dashboardUi.includes("'/state'")&&dashboardUi.includes("'/v1/feature-flags'")&&dashboardUi.includes("'/v1/models?status=downloaded'")&&dashboardUi.includes("'/v1/chat/completions'"),'acceptance gate must validate node, state, models, and real inference');

assert.ok(exoLauncher.includes("spawn('uv',['run','exo']"),'local launcher must start the real exo runtime');
assert.ok(exoLauncher.includes("'--lan'"),'local launcher must support phone/LAN mode');
assert.ok(exoLauncher.includes("http://${lanIp}:52415"),'LAN launcher must provide the exo runtime address to the phone URL');
assert.ok(exoLauncher.includes("Aggredicus/exo.git"),'launcher must use the maintained ConsciOS exo fork');
assert.ok(exoLauncher.includes("process.platform==='darwin'?'mlx':'mlx-cpu'"),'launcher must select the documented macOS/Linux backend setup');

assert.ok(visualSystem.includes('--cs-accent'),'shared visual system must expose stable design tokens');
assert.ok(visualSystem.includes('.cs-appbar'),'shared visual system must define product chrome');
assert.ok(visualSystem.includes('prefers-reduced-motion'),'shared visual system must preserve reduced-motion support');
assert.ok(visualSystem.includes('overflow-x:hidden'),'shared visual system must prevent page-level horizontal overflow');
assert.ok(visualSystem.includes('min-width:0'),'shared visual system must allow grid/flex children to shrink within the viewport');
assert.ok(visualSystem.includes('env(safe-area-inset-left)'),'shared visual system must support device safe areas');
const surfaces=[
  ['Local AI Lab',localLabHtml,'./conscios-ui.css'],
  ['Cognitive Workbench',html,'../conscios-ui.css'],
  ['Swarm',swarmHtml,'../conscios-ui.css'],
  ['exo',dashboardHtml,'../conscios-ui.css'],
  ['First Encounter',encounterHtml,'../conscios-ui.css'],
  ['Live Cognitive Theater',liveHtml,'../local/conscios-ui.css']
];
for(const [name,markup,stylesheet] of surfaces){
  assert.ok(markup.includes(stylesheet),`${name} must load the shared ConsciOS visual system`);
  assert.ok(markup.includes('cs-appbar'),`${name} must expose consistent product navigation`);
  assert.ok(markup.includes('cs-brandmark'),`${name} must expose the shared ConsciOS brand mark`);
}
assert.ok(localLabHtml.includes('This is not a consciousness indicator')||localLabHtml.includes('consciousness indicator'),'Local AI Lab must retain consciousness disclosure');
assert.ok(encounterHtml.includes('not evidence of subjective experience'),'First Encounter must retain interpretation boundary');
assert.ok(liveHtml.includes('does not establish subjective experience'),'Live Theater must retain interpretation boundary');
assert.ok(swarmHtml.includes('does not grant photo, file, password, repository, or cognitive-role access'),'Swarm must retain bounded-capability disclosure');

for(const forbidden of ['apiKey','API_KEY','githubToken','GITHUB_TOKEN'])assert.ok(!ui.includes(forbidden)&&!html.includes(forbidden)&&!dashboardHtml.includes(forbidden)&&!dashboardUi.includes(forbidden)&&!exoLauncher.includes(forbidden),`workbench unexpectedly references credential material: ${forbidden}`);

console.log('Cognitive Workbench verification passed: explicit inference/execution boundaries, deterministic budgeted AI context selection, live multi-turn conversation, native exo app/runtime path, real inference acceptance gate, responsive UI-system coverage, bounded iframe authority, and no consciousness claim.');
