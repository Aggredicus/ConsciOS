import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {CELL_TYPES,PYODIDE_VERSION,createCell,createNotebook,interpolateText,parseParameters,validateNotebook} from '../../../local/workbench/notebook-engine.mjs';
import {createConversationChallenge,scoreConversationArm,compareConversationArms,summarizeConversationRealityResult} from '../../../local/workbench/conversation-test.mjs';
import {EXECUTION_PROTOCOL,EXECUTION_RESULT_FORMAT,createExecutionProvider,createExecutionRouter,createDefaultWorkbenchExecutionRouter,createSandboxContainerExecutionProvider} from '../../../local/workbench/execution-providers.mjs';
import {DEFAULT_SANDBOX_ENDPOINT,SANDBOX_PROTOCOL,SANDBOX_RESULT_FORMAT,createSandboxRequest,normalizeSandboxEndpoint} from '../../../runtime/execution/sandbox-contract.mjs';
import {DEFAULT_SANDBOX_POLICY,assertSandboxArgsStayBounded,buildContainerRunArgs,normalizeSandboxRequest,sandboxPolicySnapshot} from '../../../runtime/execution/sandbox-protocol.mjs';
import {createSandboxServer,isAllowedSandboxOrigin} from '../../../scripts/run-sandbox-daemon.mjs';
import {CONTEXT_SELECTION_FORMAT,expandContextTerms,rankPreviousResults,selectPreviousResults,tokenizeContextText} from '../../../local/workbench/context-selector.mjs';
import {BENCHMARK_FORMAT,runContextSelectionBenchmark} from './context-selection-benchmark.mjs';
import {SEMANTIC_LITE_BENCHMARK_FORMAT,runSemanticLiteBenchmark} from './semantic-lite-benchmark.mjs';

const notebook=createNotebook({title:'Verification notebook'});
assert.equal(validateNotebook(notebook),notebook);
assert.equal(notebook.format,'conscios-notebook/v1');
assert.ok(notebook.cells.some(cell=>cell.type==='parameters'));
assert.ok(notebook.cells.some(cell=>cell.type==='ai'));

for(const required of ['markdown','parameters','ai','conversation','conversation-test','javascript','python','container','procedure','world-inspect','property-inspector','node-graph','spatial-prompt','playtest','macro'])assert.ok(CELL_TYPES[required],`missing workbench cell type ${required}`);

assert.deepEqual(parseParameters('{"scale":2,"project":"ConsciOS"}'),{scale:2,project:'ConsciOS'});
assert.equal(interpolateText('scale={{ scale }} project={{project}}',{scale:2,project:'ConsciOS'}),'scale=2 project=ConsciOS');
assert.throws(()=>parseParameters('[1,2,3]'),/JSON object/);
assert.throws(()=>createCell('undeclared-cell'),/unsupported cell type/);
assert.equal(createCell('conversation').config.maxResponseUnits,512);
const aiDefaults=createCell('ai').config;assert.equal(aiDefaults.contextStrategy,'relevant');assert.equal(aiDefaults.maxContextBytes,12000);assert.equal(aiDefaults.maxContextItems,8);
const containerCell=createCell('container');assert.equal(containerCell.config.endpoint,DEFAULT_SANDBOX_ENDPOINT);assert.match(containerCell.source,/ubuntu:24\.04/);
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
assert.deepEqual(defaultExecutionRouter.records().map(item=>item.id).sort(),['browser-javascript','browser-python','http-tool-bridge','sandbox-container']);
assert.equal(defaultExecutionRouter.providerFor({type:'javascript',config:{}}).id,'browser-javascript');
assert.equal(defaultExecutionRouter.providerFor({type:'python',config:{}}).id,'browser-python');
assert.equal(defaultExecutionRouter.providerFor({type:'playtest',config:{}}).id,'http-tool-bridge');
assert.equal(defaultExecutionRouter.providerFor({type:'container',config:{}}).id,'sandbox-container');

assert.equal(normalizeSandboxEndpoint('http://localhost:43117/v1/run'),'http://localhost:43117/v1/run');
assert.throws(()=>normalizeSandboxEndpoint('https://example.com/v1/run'),/loopback http/);
assert.throws(()=>normalizeSandboxEndpoint('http://192.168.1.4:43117/v1/run'),/loopback/);
assert.equal(isAllowedSandboxOrigin('http://127.0.0.1:8000'),true);
assert.equal(isAllowedSandboxOrigin('http://localhost:8080'),true);
assert.equal(isAllowedSandboxOrigin('https://example.com'),false);

const sandboxRequest=normalizeSandboxRequest({
  protocol:SANDBOX_PROTOCOL,
  requestId:'sandbox-test-1',
  image:'ubuntu:24.04',
  command:['sh','-lc','printf sandbox-ok'],
  files:[{path:'src/input.txt',content:'hello'}],
  network:false,pull:false,
  limits:{timeoutMs:5000,memoryMB:256,cpus:.5,pids:32,outputBytes:4096}
});
assert.equal(sandboxRequest.image,'ubuntu:24.04');
assert.equal(sandboxRequest.network,false);
assert.equal(sandboxRequest.files[0].path,'src/input.txt');
assert.throws(()=>normalizeSandboxRequest({...sandboxRequest,network:true}),/network access is disabled/);
assert.throws(()=>normalizeSandboxRequest({...sandboxRequest,image:'evil/image:latest'}),/not allowed/);
assert.throws(()=>normalizeSandboxRequest({...sandboxRequest,files:[{path:'../escape',content:'x'}]}),/escape the workspace/);
assert.throws(()=>normalizeSandboxRequest({...sandboxRequest,limits:{...sandboxRequest.limits,memoryMB:99999}}),/exceeds policy maximum/);
const builtSandbox=buildContainerRunArgs(sandboxRequest,{workspacePath:'/tmp/conscios-sandbox-verify',containerName:'conscios-sandbox-verify'});
assert.equal(assertSandboxArgsStayBounded(builtSandbox.args),true);
assert.ok(builtSandbox.args.includes('none'),'sandbox should disable container networking by default');
assert.ok(builtSandbox.args.includes('--read-only'),'sandbox should use a read-only root filesystem');
assert.ok(builtSandbox.args.includes('65534:65534'),'sandbox should use an unprivileged container user');
assert.ok(!builtSandbox.args.join(' ').includes('--privileged'));
assert.ok(!builtSandbox.args.join(' ').includes('docker.sock'));
assert.equal(sandboxPolicySnapshot(DEFAULT_SANDBOX_POLICY).allowNetwork,false);
assert.equal(sandboxPolicySnapshot(DEFAULT_SANDBOX_POLICY).allowPull,false);

const contractRequest=createSandboxRequest({
  source:'{"image":"ubuntu:24.04","command":["sh","-lc","printf {{ project }}"],"files":[],"network":false}',
  parameters:{project:'ConsciOS'},
  requestId:'contract-1',
  interpolate:interpolateText
});
assert.equal(contractRequest.protocol,SANDBOX_PROTOCOL);
assert.equal(contractRequest.command[2],'printf ConsciOS');

let sandboxFetch=null;
const sandboxProvider=createSandboxContainerExecutionProvider({fetchImpl:async(url,options)=>{
  sandboxFetch={url:String(url),options,body:JSON.parse(options.body)};
  return new Response(JSON.stringify({
    format:SANDBOX_RESULT_FORMAT,
    protocol:SANDBOX_PROTOCOL,
    requestId:sandboxFetch.body.requestId,
    status:'ok',exitCode:0,stdout:'sandbox-ok',stderr:'',outputTruncated:false,
    timing:{elapsedMs:7,timeoutMs:5000},
    execution:{engine:'docker',image:'ubuntu:24.04',network:false,pull:false,limits:sandboxFetch.body.limits},
    policy:sandboxPolicySnapshot(DEFAULT_SANDBOX_POLICY)
  }),{status:200,headers:{'Content-Type':'application/json'}});
}});
const sandboxProviderResult=await sandboxProvider.execute({
  id:'container-cell-1',type:'container',
  source:'{"image":"ubuntu:24.04","command":["sh","-lc","printf {{ project }}"],"network":false,"limits":{"timeoutMs":5000}}',
  config:{endpoint:DEFAULT_SANDBOX_ENDPOINT}
},{parameters:{project:'ConsciOS'}});
assert.equal(sandboxProviderResult.output.status,'ok');
assert.equal(sandboxProviderResult.output.stdout,'sandbox-ok');
assert.equal(sandboxProviderResult.provenance.executionProvider.id,'sandbox-container');
assert.equal(sandboxFetch.body.command[2],'printf ConsciOS');
assert.equal(sandboxFetch.options.credentials,'omit');
assert.equal(sandboxFetch.body.network,false);

let daemonRunRequest=null;
const sandboxServer=createSandboxServer({runImpl:async({request,policy})=>{
  daemonRunRequest=request;
  return {format:SANDBOX_RESULT_FORMAT,protocol:SANDBOX_PROTOCOL,requestId:request.requestId,status:'ok',exitCode:0,stdout:'daemon-ok',stderr:'',outputTruncated:false,timing:{elapsedMs:1,timeoutMs:request.limits.timeoutMs},execution:{engine:'docker',image:request.image,network:request.network,pull:request.pull,limits:request.limits},policy:sandboxPolicySnapshot(policy)};
}});
await new Promise(resolve=>sandboxServer.listen(0,'127.0.0.1',resolve));
try{
  const address=sandboxServer.address();assert.ok(address&&typeof address==='object');
  const daemonBase=`http://127.0.0.1:${address.port}`;
  const health=await fetch(`${daemonBase}/health`,{headers:{Origin:'http://127.0.0.1:8000'}});
  assert.equal(health.status,200);assert.equal((await health.json()).protocol,SANDBOX_PROTOCOL);
  const denied=await fetch(`${daemonBase}/health`,{headers:{Origin:'https://example.com'}});
  assert.equal(denied.status,403);
  const run=await fetch(`${daemonBase}/v1/run`,{method:'POST',headers:{Origin:'http://localhost:8000','Content-Type':'application/json'},body:JSON.stringify(sandboxRequest)});
  assert.equal(run.status,200);assert.equal((await run.json()).stdout,'daemon-ok');
  assert.equal(daemonRunRequest.image,'ubuntu:24.04');
}finally{await new Promise(resolve=>sandboxServer.close(resolve))}

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
assert.ok(ui.includes('governed loopback container daemon')&&ui.includes('run-sandbox-daemon.mjs'),'Workbench must expose the governed local container path');
assert.ok(ui.includes('selectPreviousResults')&&ui.includes(':context-selection'),'AI cells must expose deterministic previous-context selection provenance');
assert.ok(ui.includes('contextStrategy')&&ui.includes('maxContextBytes')&&ui.includes('maxContextItems'),'AI cell UI must expose context strategy and hard budgets');
assert.ok(ui.includes('Semantic-lite · experimental')&&ui.includes('expandedQueryTerms'),'Workbench must label semantic-lite experimental and expose term-expansion provenance');
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
assert.ok(html.includes('Linux sandbox')&&html.includes('node scripts/run-sandbox-daemon.mjs'),'Workbench must document how to start the local sandbox daemon');
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
