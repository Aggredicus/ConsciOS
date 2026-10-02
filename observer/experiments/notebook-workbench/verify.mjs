import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {CELL_TYPES,PYODIDE_VERSION,createCell,createNotebook,interpolateText,parseParameters,validateNotebook} from '../../../local/workbench/notebook-engine.mjs';
import {createConversationChallenge,scoreConversationArm,compareConversationArms,summarizeConversationRealityResult} from '../../../local/workbench/conversation-test.mjs';
import {EXECUTION_PROTOCOL,EXECUTION_RESULT_FORMAT,createExecutionProvider,createExecutionRouter,createDefaultWorkbenchExecutionRouter} from '../../../local/workbench/execution-providers.mjs';
import {CONTEXT_SELECTION_FORMAT,expandContextTerms,rankPreviousResults,selectPreviousResults,tokenizeContextText} from '../../../local/workbench/context-selector.mjs';
import {BENCHMARK_FORMAT,runContextSelectionBenchmark} from './context-selection-benchmark.mjs';
import {SEMANTIC_LITE_BENCHMARK_FORMAT,runSemanticLiteBenchmark} from './semantic-lite-benchmark.mjs';

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
assert.ok(expandContextTerms(['handset','hot']).includes('mobile'));assert.ok(expandContextTerms(['handset','hot']).includes('temperature'));
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

const contextBenchmark=runContextSelectionBenchmark();
assert.equal(contextBenchmark.format,BENCHMARK_FORMAT);
assert.ok(contextBenchmark.dimensions.lexical.relevant.recall>=0.75,'lexical relevant-context recall fell below preregistered threshold');
assert.ok(contextBenchmark.dimensions.lexical.relevant.recall>contextBenchmark.dimensions.lexical.recent.recall,'relevance ranking did not beat recent-only control on lexical tasks');
assert.equal(contextBenchmark.dimensions.lexical.all.recall,1,'all-context control must retain the expected lexical result');
assert.ok(contextBenchmark.dimensions.byteReduction>=0.40,'relevant context did not achieve preregistered byte reduction');
for(const row of contextBenchmark.rows){
  assert.ok(row.relevant.selectedBytes<=contextBenchmark.config.budgetBytes,`${row.id} exceeded relevant byte budget`);
  assert.ok(row.relevant.selectedCount<=contextBenchmark.config.maxItems,`${row.id} exceeded relevant item limit`);
}
console.log('Notebook context benchmark:',JSON.stringify(contextBenchmark.dimensions));

const semanticLiteBenchmark=runSemanticLiteBenchmark();
assert.equal(semanticLiteBenchmark.format,SEMANTIC_LITE_BENCHMARK_FORMAT);
assert.ok(semanticLiteBenchmark.dimensions.semanticLite.recall>=0.75,'semantic-lite recall fell below preregistered threshold');
assert.ok(semanticLiteBenchmark.dimensions.semanticLite.recall>semanticLiteBenchmark.dimensions.relevant.recall,'semantic-lite did not improve paraphrase recall over plain relevant');
assert.equal(semanticLiteBenchmark.dimensions.all.recall,1,'semantic-lite all-context control must retain expected results');
assert.ok(semanticLiteBenchmark.dimensions.byteReduction>=0.40,'semantic-lite did not achieve preregistered byte reduction');
for(const row of semanticLiteBenchmark.rows){
  assert.ok(row['semantic-lite'].selectedBytes<=semanticLiteBenchmark.config.budgetBytes,`${row.id} exceeded semantic-lite byte budget`);
  assert.ok(row['semantic-lite'].selectedCount<=semanticLiteBenchmark.config.maxItems,`${row.id} exceeded semantic-lite item limit`);
  assert.ok(row['semantic-lite'].expandedQueryTerms.length>=row['semantic-lite'].queryTerms.length,`${row.id} lost query terms during expansion`);
}
console.log('Semantic-lite context benchmark:',JSON.stringify(semanticLiteBenchmark.dimensions));

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

for(const file of ['local/workbench/app.mjs','local/workbench/browser-runtime.mjs','local/workbench/browser-inference-worker.mjs','local/workbench/exo-runtime.mjs','local/workbench/exo-ui.mjs','local/workbench/swarm-runtime.mjs','runtime/models/browser-swarm-provider.mjs'])execFileSync(process.execPath,['--check',file],{stdio:'pipe'});
const ui=readFileSync('local/workbench/app.mjs','utf8');
const browserUi=readFileSync('local/workbench/browser-runtime.mjs','utf8');
const browserWorker=readFileSync('local/workbench/browser-inference-worker.mjs','utf8');
const exoUi=readFileSync('local/workbench/exo-runtime.mjs','utf8');
const exoLibraryUi=readFileSync('local/workbench/exo-ui.mjs','utf8');
const swarmUi=readFileSync('local/workbench/swarm-runtime.mjs','utf8');
const swarmProvider=readFileSync('runtime/models/browser-swarm-provider.mjs','utf8');
assert.ok(browserUi.length<3600,`browser worker proxy budget exceeded: ${browserUi.length} bytes`);
assert.ok(browserWorker.length<6000,`browser inference worker budget exceeded: ${browserWorker.length} bytes`);
assert.ok(exoUi.length<1600,`exo runtime adapter budget exceeded: ${exoUi.length} bytes`);
assert.ok(exoLibraryUi.length<6500,`exo model-library UI budget exceeded: ${exoLibraryUi.length} bytes`);
assert.ok(swarmUi.length<4500,`swarm runtime UI budget exceeded: ${swarmUi.length} bytes`);
assert.ok(swarmProvider.length<8000,`browser swarm provider budget exceeded: ${swarmProvider.length} bytes`);
const html=readFileSync('local/workbench/index.html','utf8');
const css=readFileSync('local/workbench/app.css','utf8');
const exoLauncher=readFileSync('scripts/run-exo-local.mjs','utf8');

assert.ok(ui.includes("./exo-runtime.mjs")&&exoUi.includes("exo-provider.mjs")&&exoUi.includes("createExoInferenceProvider"),'compact app is not wired to lazy exo loading');
assert.ok(exoUi.includes("./exo-ui.mjs")&&exoLibraryUi.includes('Preview fit')&&exoLibraryUi.includes('Pool test'),'lazy exo runtime must expose the model library and pooling controls');
assert.ok(exoLibraryUi.includes('previewPlacements')&&exoLibraryUi.includes('testPooling'),'exo UI must use live placement APIs rather than static compatibility guesses');
assert.ok(html.includes('id="exoTools"')&&html.includes('>Models<'),'Runtime must expose the lazy exo model-library mount point');
assert.ok(ui.includes("./swarm-runtime.mjs")&&html.includes('id="chooseSwarm"')&&html.includes('id="swarmCard"'),'Runtime must expose Browser Swarm as a lazy third provider');
assert.ok(swarmUi.includes('runHybridPoolTest')&&swarmUi.includes('DEFAULT_SECURE_SWARM_URL'),'swarm runtime must expose secure pairing and explicit task-parallel pool verification');
assert.ok(swarmProvider.includes("kind:'browser-swarm-peer'")&&swarmProvider.includes("inferenceLocation:'encrypted-webrtc-peer'"),'browser swarm provider must preserve its remote encrypted inference boundary');
assert.ok(ui.includes("./browser-runtime.mjs")&&browserUi.includes("new Worker")&&browserUi.includes("browser-inference-worker.mjs"),'compact app must proxy browser inference through a dedicated worker');
assert.ok(browserWorker.includes("browser-transformers-host.mjs")&&browserWorker.includes("host.generate")&&browserWorker.includes("executionThread:'dedicated-worker'"),'dedicated worker must own Transformers.js generation and provenance');
assert.ok(browserWorker.includes("compact-models.mjs")&&!ui.includes("STARTER_MODELS"),'worker must load only the reduced browser model catalog');
assert.ok(ui.includes('adaptive-lease-v1')===false&&ui.includes('initialLease')&&ui.includes('hardLimit'),'compact chat must allocate adaptive output envelopes');
assert.ok(!ui.includes('maxResponseUnits:192'),'compact chat must not restore the truncating 192-token ceiling');
assert.ok(browserWorker.includes('/no_think')&&browserWorker.includes('stripThinking'),'Qwen compact chat must suppress visible reasoning blocks');
assert.ok(browserWorker.includes('grant-large')&&browserWorker.includes('grant-small')&&browserWorker.includes('deny-hard-limit'),'worker must record adaptive lease decisions');
assert.ok(browserWorker.includes('finishReason')&&browserWorker.includes('outputTokenCount'),'worker must preserve provider stop diagnostics');
assert.ok(ui.includes('conversationMessages'),'compact app must send explicit visible conversation history');
assert.ok(ui.includes("requestingModule:'Expression'"),'chat inference must declare its requesting module');
assert.ok(ui.includes("hiddenContextPolicy:'none'"),'compact app must preserve explicit-context-only inference');
assert.ok(ui.includes("state.messages.slice(-24)")&&ui.includes('state.messages.length>24'),'compact app must bound persisted and active conversation history');
assert.ok(!ui.includes('createDeterministicMockModel'),'primary compact UI must not expose the old deterministic-control surface');
assert.ok(!ui.includes('notebook-engine'),'primary compact UI must not load the old notebook engine');
assert.ok(!html.includes('workbench.mjs'),'compact HTML must not load the legacy Workbench controller');
assert.ok(html.includes('data-tab="chat"')&&html.includes('data-tab="runtime"'),'compact UI must expose only Chat and Runtime primary surfaces');
assert.ok(html.includes('One conversation. One runtime.'),'compact UI must retain the simplified product intent');
assert.ok(html.includes('Open exo'),'compact UI must expose the native exo application');
assert.ok(html.includes('<details>')&&html.includes('>Address<'),'manual exo endpoint must remain advanced rather than primary');
assert.ok(html.includes('viewport-fit=cover'),'compact UI must support device safe areas');

assert.ok(css.includes('overflow-x:hidden'),'compact UI must prevent page-level horizontal overflow');
assert.ok(css.includes('100dvh'),'compact UI must use dynamic viewport height');
assert.ok(css.includes('env(safe-area-inset-bottom)'),'compact UI must respect mobile safe areas');
assert.ok(css.includes('@media(max-width:600px)'),'compact UI must provide phone-specific responsive behavior');
assert.ok(css.length<5500,`compact CSS budget exceeded: ${css.length} bytes`);
assert.ok(html.length<5000,`compact HTML budget exceeded: ${html.length} bytes`);
assert.ok(ui.length<16000,`compact controller budget exceeded: ${ui.length} bytes`);

assert.ok(exoLauncher.includes("spawn('uv',['run','exo']"),'local launcher must start the real exo runtime');
assert.ok(exoLauncher.includes("'--lan'"),'local launcher must support phone/LAN mode');
assert.ok(exoLauncher.includes("http://${lanIp}:52415"),'LAN launcher must provide the exo runtime address to the phone URL');
assert.ok(exoLauncher.includes("Aggredicus/exo.git"),'launcher must use the maintained ConsciOS exo fork');
assert.ok(exoLauncher.includes("process.platform==='darwin'?'mlx':'mlx-cpu'"),'launcher must select the documented macOS/Linux backend setup');

for(const forbidden of ['apiKey','API_KEY','githubToken','GITHUB_TOKEN'])assert.ok(!ui.includes(forbidden)&&!html.includes(forbidden),`compact UI unexpectedly references credential material: ${forbidden}`);

console.log('Compact ConsciOS verification passed: tiny Chat/Runtime shell, local/exo/browser-swarm providers, lazy encrypted worker bridge, responsive mobile UX, and strict eager-size budgets.');
