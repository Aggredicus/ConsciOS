import {detectBrowserAICapabilities} from '../../runtime/models/browser-capabilities.mjs';
import {STARTER_MODELS,getStarterModel} from '../../runtime/models/model-manifest.mjs';
import {createBrowserTransformersHost} from '../../runtime/models/browser-transformers-host.mjs';
import {createBrowserTransformersCognitiveModel} from '../../runtime/models/browser-cognitive-model.mjs';
import {createDeterministicMockModel} from '../../runtime/models/deterministic-mock.mjs';
import {createBrowserLocalInferenceProvider} from '../../runtime/models/browser-provider.mjs';
import {createExoInferenceProvider} from '../../runtime/models/exo-provider.mjs';
import {createInferenceProviderRouter} from '../../runtime/models/provider-router.mjs';
import {createConversationChallenge,scoreConversationArm,compareConversationArms,summarizeConversationRealityResult} from './conversation-test.mjs';
import {CELL_TYPES,PYODIDE_VERSION,cloneCell,createCell,createNotebook,interpolateText,loadNotebook,parseParameters,previousCellResults,rebuildParameterContext,saveNotebook,validateNotebook} from './notebook-engine.mjs';
import {createDefaultWorkbenchExecutionRouter} from './execution-providers.mjs';

const $=id=>document.getElementById(id);const router=createInferenceProviderRouter();const executionRouter=createDefaultWorkbenchExecutionRouter();let notebook=loadNotebook()??createNotebook();let selectedCellId=null;let saveTimer=null;let browserModel=null;let browserHost=null;let exoProvider=null;

function esc(value){return String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]))}
function pretty(value){if(typeof value==='string')return value;try{return JSON.stringify(value,null,2)}catch{return String(value)}}
function status(text,tone=''){const el=$('status');el.textContent=text;el.className=tone}
function setProviderStatus(text,tone='muted'){$('providerStatus').textContent=text;$('providerStatus').className=`${tone} compact`}
function now(){return new Date().toISOString()}
function currentProvider(){return router.current()}

function mockProvider(){
  const model=createDeterministicMockModel();return {id:'mock',label:'Deterministic mock CONTROL',record:()=>({id:'mock',label:'Deterministic mock CONTROL',kind:'deterministic-mock',location:'browser-control',remote:false}),provenance:()=>({kind:'deterministic-mock',name:'conscios-v0.8-mock',hiddenState:'none'}),connect:async()=>({status:'ready'}),infer:input=>model.infer(input),cancel:()=>{}};
}
router.register(mockProvider());router.select('mock');

function markDirty(){notebook.updatedAt=now();$('saveState').textContent='unsaved';clearTimeout(saveTimer);saveTimer=setTimeout(()=>persist(),700)}
function persist(){saveNotebook(notebook);$('saveState').textContent='saved';renderSummary()}
function renderSummary(){const params=rebuildParameterContext(notebook);$('parameterCount').textContent=Object.keys(params).length;$('cellCount').textContent=notebook.cells.length;$('notebookTitle').value=notebook.title}
function providerReady(id){return router.providers.has(id)}
function clearProviderSelection(){router.selectedId=null;renderProviderProvenance()}
function chooseProvider(id){if(providerReady(id)){router.select(id);renderProviderProvenance();return true}clearProviderSelection();return false}
function renderProviderProvenance(){const provider=currentProvider();$('providerProvenance').textContent=provider?pretty(provider.provenance()):'Selected provider is not connected/loaded. No fallback provider will be used.'}

function markdownHtml(source){
  let text=esc(source);text=text.replace(/^### (.*)$/gm,'<h3>$1</h3>').replace(/^## (.*)$/gm,'<h2>$1</h2>').replace(/^# (.*)$/gm,'<h1>$1</h1>').replace(/\*\*(.+?)\*\*/g,'<strong>$1</strong>').replace(/`([^`]+)`/g,'<code>$1</code>');return text.split(/\n{2,}/).map(block=>/^<h[1-3]>/.test(block)?block:`<p>${block.replace(/\n/g,'<br>')}</p>`).join('');
}
function conversationText(cell){
  const messages=cell.output?.messages;if(!Array.isArray(messages)||!messages.length)return 'No conversation turns yet.';
  return messages.map(message=>`${message.role==='user'?'YOU':'AI'}: ${message.content}${message.provider?.modelId?`\n    [${message.provider.kind} · ${message.provider.modelId}]`:''}`).join('\n\n');
}
function outputText(cell){
  if(cell.type==='conversation')return conversationText(cell);
  if(cell.type==='conversation-test'&&cell.output?.summary)return cell.output.summary;
  return cell.output===null?'No output yet.':pretty(cell.output);
}

function configMarkup(cell){
  if(cell.type==='ai')return `<div class="cellMeta"><label class="compact"><input data-config="includePrevious" type="checkbox" ${cell.config.includePrevious?'checked':''}> Include previous outputs</label><label class="compact">Max response units <input data-config="maxResponseUnits" type="number" min="1" max="65536" value="${esc(cell.config.maxResponseUnits)}"></label></div>`;
  if(cell.type==='conversation'||cell.type==='conversation-test')return `<div class="cellMeta"><label class="compact">Max response units <input data-config="maxResponseUnits" type="number" min="1" max="4096" value="${esc(cell.config.maxResponseUnits)}"></label><span class="compact ${currentProvider()?.provenance?.().kind==='deterministic-mock'?'warn':'muted'}">Provider: ${esc(currentProvider()?.provenance?.().kind??'not loaded')}</span></div>`;
  if(['procedure','world-inspect','property-inspector','node-graph','spatial-prompt','playtest'].includes(cell.type))return `<div class="cellMeta"><label class="compact">Local tool endpoint<input class="full" data-config="endpoint" value="${esc(cell.config.endpoint)}" placeholder="http://127.0.0.1:PORT/path"></label><label class="compact">Action<input class="full" data-config="action" value="${esc(cell.config.action)}"></label><label class="compact">Method<select class="full" data-config="method"><option ${cell.config.method==='POST'?'selected':''}>POST</option><option ${cell.config.method==='GET'?'selected':''}>GET</option></select></label></div>`;
  return '';
}

function sourceHelp(cell){
  if(cell.type==='conversation')return 'Each Send adds a real user turn and supplies the visible alternating transcript to the selected provider. Clear removes the thread from this notebook cell.';
  if(cell.type==='conversation-test')return 'Runs the same randomized prompts in stateless and stateful conditions. Delayed values are never present in the final stateless prompt.';
  if(cell.type==='javascript')return 'Runs in an isolated Web Worker. Return a value; use context.parameters and context.previousResults.';
  if(cell.type==='python')return `Loads Pyodide ${PYODIDE_VERSION} only when this cell runs. Python receives a dict named context containing notebook parameters.`;
  if(cell.type==='parameters')return 'JSON object merged into the explicit parameter context. Use {{name}} in later tool payloads.';
  if(cell.type==='macro')return 'JSON array of cell IDs or exact cell titles to run sequentially.';
  if(['procedure','world-inspect','property-inspector','node-graph','spatial-prompt','playtest'].includes(cell.type))return 'The request is sent only to the endpoint shown above. No provider or tool fallback occurs.';
  return '';
}

function cellMarkup(cell,index){
  const preview=cell.type==='markdown'?`<div class="markdownPreview" data-preview>${markdownHtml(cell.source)}</div>`:'';
  const runLabel=cell.type==='markdown'?'Render':cell.type==='conversation'?'Send':cell.type==='conversation-test'?'Run paired test':'▶ Run';
  const clearButton=cell.type==='conversation'?'<button data-action="clear">Clear thread</button>':'';
  const readonly=cell.type==='conversation-test'?' readonly':'';
  const rows=cell.type==='conversation'?3:cell.type==='conversation-test'?2:cell.type==='markdown'?5:7;
  return `<article class="cell ${cell.status==='running'?'running':''} ${cell.status==='error'?'error':''}" data-cell-id="${esc(cell.id)}"><header class="cellHead"><span class="drag">${index+1}</span><span class="cellType">${esc(CELL_TYPES[cell.type].label)}</span><span class="cellTitle">${esc(cell.title)}</span><div class="actions"><button data-action="run">${runLabel}</button>${clearButton}<button data-action="up" title="Move up">↑</button><button data-action="down" title="Move down">↓</button><button data-action="duplicate">Duplicate</button><button data-action="delete">Delete</button></div></header><div class="cellBody">${configMarkup(cell)}<textarea class="code" data-source rows="${rows}"${readonly} spellcheck="${['markdown','ai','conversation'].includes(cell.type)?'true':'false'}">${esc(cell.source)}</textarea>${sourceHelp(cell)?`<p class="muted compact">${esc(sourceHelp(cell))}</p>`:''}${preview}<pre class="output" data-output>${esc(outputText(cell))}</pre></div></article>`;
}

function renderCells(){
  const root=$('cells');root.innerHTML=notebook.cells.length?notebook.cells.map(cellMarkup).join(''):'<div class="empty">No cells yet. Add one from the toolbar.</div>';
  root.querySelectorAll('[data-cell-id]').forEach(article=>{
    const cell=notebook.cells.find(item=>item.id===article.dataset.cellId);if(!cell)return;
    article.addEventListener('click',()=>{selectedCellId=cell.id;renderCellInspector(cell)});
    article.querySelector('[data-source]').addEventListener('input',event=>{cell.source=event.target.value;cell.updatedAt=now();if(cell.type==='markdown')article.querySelector('[data-preview]').innerHTML=markdownHtml(cell.source);markDirty()});
    article.querySelectorAll('[data-config]').forEach(control=>control.addEventListener('change',()=>{const key=control.dataset.config;cell.config[key]=control.type==='checkbox'?control.checked:control.type==='number'?Number(control.value):control.value;cell.updatedAt=now();markDirty()}));
    article.querySelectorAll('[data-action]').forEach(button=>button.addEventListener('click',async event=>{event.stopPropagation();await cellAction(cell.id,button.dataset.action)}));
  });
  renderSummary();
}

function renderCellInspector(cell){$('cellInspector').textContent=pretty({artifactId:cell.id,type:cell.type,title:cell.title,status:cell.status,updatedAt:cell.updatedAt,config:cell.config,provenance:cell.provenance})}
function cellIndex(id){return notebook.cells.findIndex(cell=>cell.id===id)}
async function cellAction(id,action){
  const index=cellIndex(id);if(index<0)return;const cell=notebook.cells[index];
  if(action==='run'){await runCell(cell,index);return}
  if(action==='clear'&&cell.type==='conversation'){cell.output={messages:[]};cell.provenance=null;cell.status='idle';markDirty();renderCells();return}
  if(action==='up'&&index>0)[notebook.cells[index-1],notebook.cells[index]]=[notebook.cells[index],notebook.cells[index-1]];
  if(action==='down'&&index<notebook.cells.length-1)[notebook.cells[index+1],notebook.cells[index]]=[notebook.cells[index],notebook.cells[index+1]];
  if(action==='duplicate')notebook.cells.splice(index+1,0,cloneCell(cell));
  if(action==='delete')notebook.cells.splice(index,1);
  markDirty();renderCells();
}

function executionContext(index){return {parameters:rebuildParameterContext(notebook),previousResults:previousCellResults(notebook,index),notebook:{id:notebook.id,title:notebook.title}}}
function aiInput(cell,index){
  const context=executionContext(index);const prompt=interpolateText(cell.source,context.parameters);const artifacts=[{artifactId:`${cell.id}:prompt`,epistemicStatus:'observation',content:{text:prompt}},{artifactId:`${cell.id}:parameters`,epistemicStatus:'observation',content:context.parameters}];
  if(cell.config.includePrevious)artifacts.push({artifactId:`${cell.id}:previous-results`,epistemicStatus:'observation',content:context.previousResults});
  return {requestId:`workbench-${cell.id}-${Date.now()}`,requestingModule:'ObserverScientist',inferenceType:'notebook-assist',contextManifest:artifacts,causalSourceIds:artifacts.map(item=>item.artifactId),maxResponseUnits:Math.max(1,Math.min(65536,Number(cell.config.maxResponseUnits)||256)),expectedEpistemicStatus:'inference',hiddenContextPolicy:'none'};
}
function conversationInput(cell,index,messages,{inferenceType='conversation-turn',arm='live',turn=messages.length}={}){
  const context=executionContext(index);const artifacts=[{artifactId:`${cell.id}:conversation-meta`,epistemicStatus:'observation',content:{threadId:cell.id,arm,turn,notebookId:notebook.id}},{artifactId:`${cell.id}:parameters`,epistemicStatus:'observation',content:context.parameters}];
  return {requestId:`conversation-${cell.id}-${arm}-${Date.now()}-${turn}`,requestingModule:'ObserverScientist',inferenceType,contextManifest:artifacts,conversationMessages:messages.map(({role,content})=>({role,content})),causalSourceIds:artifacts.map(item=>item.artifactId),maxResponseUnits:Math.max(1,Math.min(4096,Number(cell.config.maxResponseUnits)||512)),expectedEpistemicStatus:'inference',hiddenContextPolicy:'none'};
}

async function runAI(cell,index){
  const provider=currentProvider();if(!provider)throw new Error('Selected AI provider is not loaded or connected. ConsciOS will not silently use another provider.');
  const result=await router.infer(aiInput(cell,index));if(result.status!=='ok')throw new Error(result.failure||`provider returned ${result.status}`);
  return {output:result.content?.text??result.content?.result??result.content,provenance:{provider:result.provider,causalSourceIds:result.causalSourceIds,timing:result.timing,epistemicStatus:result.epistemicStatus}};
}
async function runConversation(cell,index){
  const provider=currentProvider();if(!provider)throw new Error('Select and load/connect a provider before starting a conversation.');
  const userText=interpolateText(cell.source,executionContext(index).parameters).trim();if(!userText)throw new Error('Type a message before pressing Send.');
  const previous=Array.isArray(cell.output?.messages)?cell.output.messages:[];
  const messages=[...previous.map(({role,content})=>({role,content})),{role:'user',content:userText}];
  const result=await router.infer(conversationInput(cell,index,messages));if(result.status!=='ok')throw new Error(result.failure||`provider returned ${result.status}`);
  const assistantText=result.content?.text??'';
  const outputMessages=[...previous,{role:'user',content:userText,at:now()},{role:'assistant',content:assistantText,at:now(),provider:result.provider,timing:result.timing}];
  cell.source='';
  return {output:{messages:outputMessages},provenance:{kind:'multi-turn-conversation',provider:result.provider,turnCount:outputMessages.length,causalSourceIds:result.causalSourceIds,timing:result.timing}};
}
async function runRealityArm(cell,index,challenge,{stateful}){
  const transcript=[];let observedProvider=null;
  for(let turn=0;turn<challenge.prompts.length;turn++){
    const prompt=challenge.prompts[turn];
    const history=stateful?[...transcript.map(({role,content})=>({role,content})),{role:'user',content:prompt}]:[{role:'user',content:prompt}];
    const arm=stateful?'stateful':'stateless';
    const result=await router.infer(conversationInput(cell,index,history,{inferenceType:'conversation-reality-test',arm,turn:turn+1}));
    if(result.status!=='ok')throw new Error(`${arm} turn ${turn+1}: ${result.failure||result.status}`);
    observedProvider=result.provider;
    transcript.push({role:'user',content:prompt},{role:'assistant',content:result.content?.text??'',provider:result.provider,timing:result.timing});
    status(`Conversation Reality Test · ${arm} turn ${turn+1}/${challenge.prompts.length}`,'warn');
  }
  return {transcript,provider:observedProvider,score:scoreConversationArm({transcript,challenge,provider:observedProvider})};
}
async function runConversationRealityTest(cell,index){
  const provider=currentProvider();if(!provider)throw new Error('Select and load/connect a provider before running the test.');
  const challenge=createConversationChallenge();
  const stateless=await runRealityArm(cell,index,challenge,{stateful:false});
  const stateful=await runRealityArm(cell,index,challenge,{stateful:true});
  const comparison=compareConversationArms({stateful:stateful.score,stateless:stateless.score});
  const result={format:'conscios-conversation-reality-test/v1',provider:stateful.provider??stateless.provider??provider.provenance(),challenge,stateful,stateless,comparison};
  result.summary=summarizeConversationRealityResult(result);
  return {output:result,provenance:{kind:'paired-conversation-reality-test',provider:result.provider,randomized:true,statefulTurns:stateful.transcript.length,statelessTurns:stateless.transcript.length,historyDependenceObserved:comparison.historyDependenceObserved}};
}

async function runMacro(cell,stack){
  const targets=JSON.parse(cell.source||'[]');if(!Array.isArray(targets))throw new TypeError('macro source must be a JSON array');const results=[];
  for(const target of targets){const next=notebook.cells.find(item=>item.id===target||item.title===target);if(!next)throw new Error(`macro target not found: ${target}`);if(stack.has(next.id))throw new Error(`macro recursion detected at ${next.title}`);const result=await runCell(next,cellIndex(next.id),new Set([...stack,cell.id]));results.push({cellId:next.id,title:next.title,status:result?.status??next.status})}
  return {output:results,provenance:{kind:'notebook-macro',targets:[...targets]}};
}

async function runCell(cell,index,stack=new Set()){
  const preserveOutput=cell.type==='conversation';const priorOutput=cell.output;
  cell.status='running';if(!preserveOutput)cell.output=null;cell.provenance=null;renderCells();selectedCellId=cell.id;renderCellInspector(cell);status(`Running ${cell.title}…`,'warn');const started=performance.now();
  try{
    if(preserveOutput)cell.output=priorOutput;
    const context=executionContext(index);let result;
    if(cell.type==='markdown')result={output:{rendered:true},provenance:{kind:'markdown-render'}};
    else if(cell.type==='parameters'){const parameters=parseParameters(cell.source);result={output:parameters,provenance:{kind:'parameter-context',keys:Object.keys(parameters)}}}
    else if(cell.type==='ai')result=await runAI(cell,index);
    else if(cell.type==='conversation')result=await runConversation(cell,index);
    else if(cell.type==='conversation-test')result=await runConversationRealityTest(cell,index);
    else if(cell.type==='macro')result=await runMacro(cell,stack);
    else {
      result=await executionRouter.execute(cell,context,{onStatus:text=>{if(cell.type==='python')$('pythonStatus').textContent=text;status(text,'warn')}});
      if(cell.type==='python')$('pythonStatus').textContent=`Pyodide ${PYODIDE_VERSION}`;
    }
    cell.output=result.output;cell.provenance={...result.provenance,elapsedMs:Math.max(0,performance.now()-started)};cell.status='ok';cell.updatedAt=now();markDirty();renderCells();renderCellInspector(cell);renderProviderProvenance();status(`${cell.title} complete.`,'ok');return {status:'ok',cell};
  }catch(error){cell.status='error';if(preserveOutput)cell.output=priorOutput??{messages:[]};else cell.output={error:String(error?.message||error)};cell.provenance={kind:'execution-error',message:String(error?.message||error),elapsedMs:Math.max(0,performance.now()-started)};cell.updatedAt=now();markDirty();renderCells();renderCellInspector(cell);status(`${cell.title}: ${String(error?.message||error)}`,'bad');return {status:'error',cell,error}}
}

async function runAll(){for(let i=0;i<notebook.cells.length;i++){const result=await runCell(notebook.cells[i],i);if(result.status==='error')break}}
function addCell(type){const cell=createCell(type);notebook.cells.push(cell);selectedCellId=cell.id;markDirty();renderCells();queueMicrotask(()=>document.querySelector(`[data-cell-id="${CSS.escape(cell.id)}"] [data-source]`)?.focus())}

async function loadBrowserProvider(){
  const manifest=getStarterModel($('browserModel').value);const device=$('browserBackend').value;setProviderStatus('Loading browser model…','warn');$('browserProgress').value=0;
  browserHost=createBrowserTransformersHost({manifest,device,dtype:device==='webgpu'?manifest.webgpuDtype:manifest.wasmDtype,onProgress:event=>{const p=Number(event?.progress);if(Number.isFinite(p))$('browserProgress').value=Math.max(0,Math.min(100,p));setProviderStatus(`Loading ${event?.file||event?.status||'model assets'}…`,'warn')}});
  browserModel=createBrowserTransformersCognitiveModel({host:browserHost});await browserModel.load();const provider=createBrowserLocalInferenceProvider({model:browserModel,label:`${manifest.label} · browser local`});router.replace(provider);$('browserProgress').value=100;if($('provider').value==='browser-local')router.select('browser-local');setProviderStatus('Browser model ready. Inference stays on this device.','ok');renderProviderProvenance();renderCells();
}

function formatBytes(value){
  if(typeof value!=='number'||!Number.isFinite(value)||value<0)return '—';
  const units=['B','KB','MB','GB','TB'];let scaled=value,index=0;
  while(scaled>=1024&&index<units.length-1){scaled/=1024;index++}
  return `${scaled>=100||index===0?scaled.toFixed(0):scaled.toFixed(1)} ${units[index]}`;
}
function formatPercent(value){
  if(typeof value!=='number'||!Number.isFinite(value))return null;
  const pct=value>=0&&value<=1?value*100:value;
  return `${Math.max(0,pct).toFixed(pct<10?1:0)}%`;
}
function syncExoModelSelect(capabilities){
  const select=$('exoModel');const previous=select.value;const models=capabilities?.models??[];
  select.innerHTML=models.length?models.map(id=>`<option value="${esc(id)}">${esc(id)}</option>`).join(''):'<option value="">No downloaded models available</option>';
  select.disabled=models.length===0;
  if(previous&&models.includes(previous))select.value=previous;
  if(models.length&&exoProvider){exoProvider.setModel(select.value||models[0])}
}
function renderExoRuntime(capabilities){
  const cluster=capabilities?.cluster??{};const nodes=Array.isArray(cluster.nodes)?cluster.nodes:[];const active=capabilities?.activeModels??[];const models=capabilities?.models??[];
  const metrics=[
    [String(cluster.nodeCount??nodes.length??0),'nodes'],
    [formatBytes(cluster.memory?.availableBytes),'RAM available'],
    [String(models.length),'downloaded models'],
    [String(active.length),'active models']
  ];
  $('exoRuntimeMetrics').innerHTML=metrics.map(([value,label])=>`<div class="runtimeMetric"><b>${esc(value)}</b><span>${esc(label)}</span></div>`).join('');
  $('exoRuntimeNodes').innerHTML=nodes.length?nodes.map(node=>{
    const hardware=[node.model,node.chip].filter(Boolean).join(' · ')||'hardware not reported';
    const ram=node.ramTotalBytes?`${formatBytes(Math.max(0,node.ramTotalBytes-(node.ramAvailableBytes??0)))} used / ${formatBytes(node.ramTotalBytes)}`:'RAM not reported';
    const gpu=formatPercent(node.gpuUsage);
    const telemetry=[gpu&&`GPU ${gpu}`,typeof node.temperatureC==='number'&&`${node.temperatureC.toFixed(0)} °C`,typeof node.systemPowerW==='number'&&`${node.systemPowerW.toFixed(0)} W`].filter(Boolean).join(' · ');
    return `<div class="runtimeNode"><div class="runtimeNodeTop"><span class="runtimeNodeName">${esc(node.name||node.id)}</span><span class="pill">connected</span></div><div class="runtimeNodeMeta">${esc(hardware)}<br>${esc(ram)}${telemetry?`<br>${esc(telemetry)}`:''}</div></div>`;
  }).join(''):'<div class="runtimeNodeMeta">exo did not report any cluster nodes.</div>';
  $('exoRuntimeObserved').textContent=capabilities?.observedAt?`Observed ${new Date(capabilities.observedAt).toLocaleTimeString()} · ${capabilities.endpoint}`:'No runtime observation yet.';
}
async function refreshExoRuntime(){
  if(!exoProvider)throw new Error('Connect to exo first.');
  setProviderStatus('Refreshing exo runtime resources…','warn');
  const capabilities=await exoProvider.refreshRuntime();syncExoModelSelect(capabilities);renderExoRuntime(capabilities);
  setProviderStatus(`exo ready · ${capabilities.cluster.nodeCount} node(s) · ${capabilities.models.length} downloaded · ${capabilities.activeModels.length} active`,'ok');
  renderProviderProvenance();return capabilities;
}
async function connectExo(){
  const endpoint=$('exoEndpoint').value.trim();if(!endpoint)throw new Error('No exo runtime address was detected. Open the exo app for setup instructions.');setProviderStatus('Connecting to exo cluster…','warn');
  exoProvider=createExoInferenceProvider({endpoint});const capabilities=await exoProvider.connect();localStorage.setItem('conscios-exo-endpoint',endpoint);router.replace(exoProvider);syncExoModelSelect(capabilities);renderExoRuntime(capabilities);if($('provider').value==='exo')router.select('exo');setProviderStatus(`exo ready · ${capabilities.cluster.nodeCount} node(s) · ${capabilities.models.length} downloaded · ${capabilities.activeModels.length} active`,'ok');renderProviderProvenance();renderCells();return capabilities;
}

function providerUI(){const value=$('provider').value;$('browserDetails').hidden=value!=='browser-local';$('exoDetails').hidden=value!=='exo';if(value==='mock'){chooseProvider('mock');setProviderStatus('CONTROL ONLY: deterministic scripted mock. It is not a neural conversation.','warn')}else if(value==='browser-local'){if(chooseProvider('browser-local'))setProviderStatus('Browser-local neural provider selected.','ok');else setProviderStatus('Load a browser model before running AI/conversation cells. No fallback is active.','warn')}else if(value==='exo'){if(chooseProvider('exo'))setProviderStatus('exo neural cluster selected.','ok');else setProviderStatus('Connect to the detected exo runtime before running AI/conversation cells. No fallback is active.','warn')}renderProviderProvenance();renderCells()}

function exportNotebook(){persist();const blob=new Blob([JSON.stringify(notebook,null,2)],{type:'application/json'});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=`${notebook.title.replace(/[^a-z0-9]+/gi,'-').replace(/^-|-$/g,'').toLowerCase()||'conscios-notebook'}.json`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);status('Notebook exported.','ok')}
async function importNotebookFile(file){const parsed=JSON.parse(await file.text());notebook=validateNotebook(parsed);persist();renderCells();status('Notebook imported.','ok')}

function setupPalette(){const actions=[['Run all cells',runAll],['Save notebook',()=>persist()],['Export notebook',exportNotebook],['Add Conversation cell',()=>addCell('conversation')],['Add Conversation Reality Test',()=>addCell('conversation-test')],['Add AI cell',()=>addCell('ai')],['Add Python cell',()=>addCell('python')],['Add JavaScript cell',()=>addCell('javascript')],['Add world-inspect cell',()=>addCell('world-inspect')],['Add spatial-prompt cell',()=>addCell('spatial-prompt')],['Add playtest cell',()=>addCell('playtest')]];$('paletteActions').innerHTML=actions.map(([label],i)=>`<button type="button" data-palette="${i}">${esc(label)}</button>`).join('');$('paletteActions').querySelectorAll('[data-palette]').forEach(button=>button.addEventListener('click',async()=>{await actions[Number(button.dataset.palette)][1]();$('commandPalette').close()}));$('paletteButton').addEventListener('click',()=>$('commandPalette').showModal())}

$('addCellType').innerHTML=Object.entries(CELL_TYPES).map(([value,meta])=>`<option value="${esc(value)}">${esc(meta.label)}</option>`).join('');$('browserModel').innerHTML=STARTER_MODELS.map(model=>`<option value="${esc(model.id)}">${esc(model.label)}</option>`).join('');$('exoEndpoint').value=localStorage.getItem('conscios-exo-endpoint')||'';
$('provider').addEventListener('change',providerUI);$('loadBrowser').addEventListener('click',()=>loadBrowserProvider().catch(error=>{setProviderStatus(String(error?.message||error),'bad');clearProviderSelection()}));$('connectExo').addEventListener('click',()=>connectExo().catch(error=>{setProviderStatus(String(error?.message||error),'bad');clearProviderSelection()}));$('refreshExoRuntime').addEventListener('click',()=>refreshExoRuntime().catch(error=>setProviderStatus(String(error?.message||error),'bad')));$('exoModel').addEventListener('change',()=>{if(exoProvider&&$('exoModel').value){exoProvider.setModel($('exoModel').value);renderProviderProvenance();renderCells();markDirty()}});$('addCell').addEventListener('click',()=>addCell($('addCellType').value));$('runAll').addEventListener('click',runAll);$('stopProvider').addEventListener('click',()=>{router.cancel();status('Stop requested for selected provider.','warn')});$('saveNotebook').addEventListener('click',()=>{persist();status('Notebook saved locally.','ok')});$('exportNotebook').addEventListener('click',exportNotebook);$('importNotebook').addEventListener('click',()=>$('importFile').click());$('importFile').addEventListener('change',event=>{const file=event.target.files?.[0];if(file)importNotebookFile(file).catch(error=>status(String(error?.message||error),'bad'));event.target.value=''});$('newNotebook').addEventListener('click',()=>{if(!confirm('Create a new notebook? Export the current notebook first if you need a separate copy.'))return;notebook=createNotebook();persist();renderCells();status('New notebook created.','ok')});$('notebookTitle').addEventListener('input',event=>{notebook.title=event.target.value;markDirty()});
window.addEventListener('keydown',event=>{if((event.metaKey||event.ctrlKey)&&event.key.toLowerCase()==='k'){event.preventDefault();$('commandPalette').showModal()}if((event.metaKey||event.ctrlKey)&&event.key.toLowerCase()==='s'){event.preventDefault();persist();status('Notebook saved locally.','ok')}if(event.shiftKey&&event.key==='Enter'){const article=document.activeElement?.closest?.('[data-cell-id]');if(article){event.preventDefault();const index=cellIndex(article.dataset.cellId);if(index>=0)runCell(notebook.cells[index],index)}}});

setupPalette();renderCells();providerUI();renderProviderProvenance();
if($('provider').value==='exo'){
  connectExo().then(()=>status('exo connected. Add a Conversation cell to use the live runtime.','ok')).catch(error=>{setProviderStatus(`exo was not reachable yet: ${String(error?.message||error)}`,'warn');status('Workbench loaded; exo is not running or not reachable yet.','warn')});
}else status('Workbench ready. For real conversation select a neural provider, then add a Conversation cell.');
const capabilities=await detectBrowserAICapabilities().catch(()=>null);if(capabilities&&!capabilities.webgpu.available)$('browserBackend').value='wasm';
