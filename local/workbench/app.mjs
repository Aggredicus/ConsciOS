const $=id=>document.getElementById(id);
const STORE='conscios-lite-v1';
const encoder=new TextEncoder();
const models=[{id:'smollm2-135m-instruct',label:'SmolLM2 135M · ~117 MB'},{id:'qwen3-0.6b',label:'Qwen3 0.6B · ~570 MB'}];
const saved=loadSaved();
const state={
  messages:Array.isArray(saved.messages)?saved.messages.slice(-24):[],
  provider:null,providerKind:null,busy:false,lastProvenance:saved.lastProvenance??null,
  browserProvider:null,exoProvider:null
};

function loadSaved(){try{return JSON.parse(localStorage.getItem(STORE)||'{}')}catch{return {}}}
function save(){
  try{localStorage.setItem(STORE,JSON.stringify({
    messages:state.messages.slice(-24),
    preferredProvider:state.providerKind??saved.preferredProvider??'auto',
    browserModel:$('browserModel')?.value||saved.browserModel||models[0]?.id,
    exoEndpoint:$('exoEndpoint')?.value||saved.exoEndpoint||null,
    exoModel:$('exoModel')?.value||saved.exoModel||null,
    lastProvenance:state.lastProvenance
  }))}catch{}
}
function safeId(){return globalThis.crypto?.randomUUID?.()??`${Date.now()}-${Math.random().toString(16).slice(2)}`}
function safeHttpOrigin(value){try{const url=new URL(String(value??'').trim());return ['http:','https:'].includes(url.protocol)&&!url.username&&!url.password?url.origin:null}catch{return null}}
function pushMessage(message){state.messages.push(message);if(state.messages.length>24)state.messages.splice(0,state.messages.length-24)}
function formatBytes(value){
  if(typeof value!=='number'||!Number.isFinite(value)||value<0)return '—';
  const units=['B','KB','MB','GB','TB'];let n=value,i=0;
  while(n>=1024&&i<units.length-1){n/=1024;i++}
  return `${n>=100||i===0?n.toFixed(0):n.toFixed(1)} ${units[i]}`;
}
function tone(el,text,tone=''){el.textContent=text;el.className=`status ${tone}`.trim()}
function setHeader(text,tone=''){
  $('runtimeLabel').textContent=text;$('runtimeDot').className=`dot ${tone}`.trim();
}
function setBusy(value){
  state.busy=value;$('send').textContent=value?'Stop':'Send';$('send').classList.toggle('danger',value);$('prompt').disabled=value;
  $('messages').setAttribute('aria-busy',String(value));
}
function tab(name){
  document.querySelectorAll('.tab').forEach(button=>{const selected=button.dataset.tab===name;button.setAttribute('aria-selected',String(selected));button.tabIndex=selected?0:-1});
  $('chatView').classList.toggle('active',name==='chat');$('runtimeView').classList.toggle('active',name==='runtime');
  if(name==='chat')requestAnimationFrame(()=>$('prompt').focus());
}
function renderMessages(){
  const root=$('messages');root.innerHTML='';
  if(!state.messages.length){
    const empty=document.createElement('div');empty.className='empty';empty.id='emptyState';
    empty.innerHTML='<h1>One conversation. One runtime.</h1><p>Run a small model in this browser or connect to exo on your computer. Nothing else is required.</p>';
    root.append(empty);return;
  }
  for(const message of state.messages){
    const row=document.createElement('article');row.className=`msg ${message.role}`;
    const bubble=document.createElement('div');bubble.className='bubble';bubble.textContent=message.content;
    const meta=document.createElement('div');meta.className='meta';meta.textContent=message.role==='user'?'You':message.provider||'ConsciOS';
    row.append(bubble,meta);root.append(row);
  }
  requestAnimationFrame(()=>root.scrollTop=root.scrollHeight);
}
function providerLabel(){
  if(state.providerKind==='browser')return state.browserProvider?.provenance?.().modelId||'browser';
  if(state.providerKind==='exo')return state.exoProvider?.provenance?.().modelId||'exo';
  return 'not connected';
}
function chooseProvider(kind,provider=null){
  state.providerKind=kind;state.provider=provider;
  $('chooseBrowser').classList.toggle('active',kind==='browser');
  $('chooseExo').classList.toggle('active',kind==='exo');
  $('browserCard').hidden=kind!=='browser';$('exoCard').hidden=kind!=='exo';
  if(provider)setHeader(providerLabel(),'ok');
  else setHeader(kind==='browser'?'browser · load model':'exo · connect','warn');
  save();
}
function responseBudget(prompt){
  const detailed=/\b(comprehensive|detailed|deep|thorough|tutorial|step[- ]by[- ]step|analy[sz]e|design|implement|code|compare|explain why|research)\b/i.test(prompt);
  const medium=detailed||prompt.length>220||/[\n{}\[\]]/.test(prompt);
  const initialLease=detailed?2048:medium?1024:512;
  const qwen=state.providerKind==='browser'&&$('browserModel')?.value==='qwen3-0.6b';
  return {initialLease,smallGrant:512,largeGrant:1536,hardLimit:qwen?8192:4096,policy:'adaptive-lease-v1'};
}
function conversationInput(){
  const [maxMessages,maxBytes]=state.providerKind==='browser'?[7,6000]:[11,16000],source=state.messages,last=source.at(-1);
  let selected=last?.role==='user'?[last]:[],used=selected.length?encoder.encode(last.content).byteLength:0;
  for(let i=source.length-2;i>0&&selected.length+2<=maxMessages;i-=2){
    const user=source[i-1],assistant=source[i];if(user?.role!=='user'||assistant?.role!=='assistant')break;
    const pairBytes=encoder.encode(user.content).byteLength+encoder.encode(assistant.content).byteLength;
    if(used+pairBytes>maxBytes)break;selected=[user,assistant,...selected];used+=pairBytes;
  }
  const budget=responseBudget(last?.content??'');return {input:{requestId:`chat-${safeId()}`,requestingModule:'Expression',inferenceType:'conversation',contextManifest:[],causalSourceIds:[],conversationMessages:selected.map(({role,content})=>({role,content})),maxResponseUnits:budget.hardLimit,outputBudget:budget,expectedEpistemicStatus:'inference',hiddenContextPolicy:'none'},context:{candidateMessages:source.length,selectedMessages:selected.length,selectedBytes:used,maxMessages,maxBytes,budget}};
}
function latencyLabel(timing){
  const first=Number(timing?.ttftMs),total=Number(timing?.elapsedMs);
  if(Number.isFinite(first))return `${(first/1000).toFixed(first<1000?2:1)}s first · ${(total/1000).toFixed(total<1000?2:1)}s total`;
  if(Number.isFinite(total))return `${(total/1000).toFixed(total<1000?2:1)}s total`;
  return '';
}
function streamBubble(){
  const root=$('messages'),row=document.createElement('article'),bubble=document.createElement('div'),meta=document.createElement('div');
  row.className='msg assistant';bubble.className='bubble';bubble.textContent='Thinking…';meta.className='meta';meta.textContent=providerLabel();row.append(bubble,meta);root.append(row);root.scrollTop=root.scrollHeight;
  let text='',frame=0;const draw=()=>{bubble.textContent=text||'Thinking…';root.scrollTop=root.scrollHeight;frame=0};
  return {push(chunk){text+=chunk;if(!frame)frame=requestAnimationFrame(draw)},remove(){if(frame)cancelAnimationFrame(frame);row.remove()}};
}

async function sendMessage(text){
  if(state.busy)return;
  const prompt=String(text??'').trim();if(!prompt)return;
  if(!state.provider){
    tab('runtime');
    tone($('runtimeStatus'),state.providerKind==='exo'?'Connect exo first.':'Load a browser model first.','warn');
    return;
  }
  pushMessage({role:'user',content:prompt});save();renderMessages();$('prompt').value='';resizePrompt();setBusy(true);
  const request=conversationInput(),live=streamBubble();setHeader('responding…','warn');
  try{
    const result=await state.provider.infer(request.input,{onText:chunk=>live.push(String(chunk??''))});live.remove();
    if(result.status==='cancelled'){
      pushMessage({role:'assistant',content:'Generation stopped.',provider:'system'});
      state.lastProvenance={provider:result.provider,timing:result.timing,requestId:result.requestId,status:'cancelled',context:request.context};
      $('provenance').textContent=JSON.stringify(state.lastProvenance,null,2);save();renderMessages();setHeader(providerLabel(),'ok');return;
    }
    if(result.status!=='ok')throw new Error(result.failure||`Inference ${result.status}`);
    const content=String(result.content?.text??result.content?.result??'').trim();
    if(!content)throw new Error('Model returned an empty response.');
    const p=result.provider??state.provider.provenance?.()??{};
    pushMessage({role:'assistant',content,provider:p.modelId||p.kind||'ConsciOS'});
    state.lastProvenance={provider:p,timing:result.timing,requestId:result.requestId,causalSourceIds:result.causalSourceIds,context:request.context};
    $('provenance').textContent=JSON.stringify(state.lastProvenance,null,2);
    setHeader(`${providerLabel()}${latencyLabel(result.timing)?` · ${latencyLabel(result.timing)}`:''}`,'ok');save();renderMessages();
  }catch(error){
    live.remove();pushMessage({role:'assistant',content:`Runtime error: ${error?.message||error}`,provider:'system'});
    setHeader('runtime error','bad');renderMessages();
  }finally{setBusy(false);$('prompt').focus()}
}

const browserRuntime=()=>import('./browser-runtime.mjs');
const exoRuntime=()=>import('./exo-runtime.mjs');

function progressValue(event){
  const raw=Number(event?.progress);
  if(!Number.isFinite(raw))return null;
  return Math.max(0,Math.min(100,raw<=1?raw*100:raw));
}
async function loadBrowser(){
  $('loadBrowser').disabled=true;$('browserProgress').hidden=false;tone($('browserStatus'),'Starting worker…','warn');
  try{
    state.browserProvider?.dispose?.();if(state.providerKind==='browser')state.provider=null;state.browserProvider=null;
    const runtime=await browserRuntime();
    const loaded=await runtime.loadBrowserProvider({
      modelId:$('browserModel').value,
      onProgress:event=>{
        const pct=progressValue(event);if(pct!==null)$('browserProgress').value=pct;
        const file=event?.file||event?.name||event?.status||'model assets';
        tone($('browserStatus'),`Loading ${file}${pct!==null?` · ${Math.round(pct)}%`:''}`,'warn');
      }
    });
    $('browserBackend').textContent=loaded.execution.reason;
    state.browserProvider=loaded.provider;state.provider=loaded.provider;state.providerKind='browser';
    tone($('browserStatus'),`${loaded.manifest.label} ready on ${loaded.execution.device} · dedicated worker.`,'ok');
    tone($('runtimeStatus'),'Worker ready.','ok');setHeader(providerLabel(),'ok');save();
  }finally{$('loadBrowser').disabled=false}
}

function defaultExoEndpoint(){
  const params=new URLSearchParams(location.search),explicit=params.get('endpoint');
  if(explicit)return explicit.replace(/\/$/,'');
  if(saved.exoEndpoint)return String(saved.exoEndpoint).replace(/\/$/,'');
  if(location.protocol==='https:')return 'http://localhost:52415';
  return `http://${location.hostname||'localhost'}:52415`;
}
function renderExo(capabilities){
  const models=capabilities?.models??[];const select=$('exoModel');const prior=saved.exoModel;
  select.innerHTML='';
  if(!models.length){select.innerHTML='<option value="">No downloaded models</option>';select.disabled=true}
  else{
    for(const id of models){const option=document.createElement('option');option.value=id;option.textContent=id;select.append(option)}
    select.disabled=false;if(prior&&models.includes(prior))select.value=prior;
    state.exoProvider.setModel(select.value);
  }
  const cluster=capabilities?.cluster??{};
  const metrics=[
    [cluster.nodeCount??0,'nodes'],
    [formatBytes(cluster.memory?.availableBytes),'RAM available'],
    [(capabilities?.activeModels??[]).length,'active models']
  ];
  $('exoMetrics').innerHTML=metrics.map(([value,label])=>`<div class="metric"><b>${value}</b><span>${label}</span></div>`).join('');
}
async function connectExo({quiet=false}={}){
  const runtime=await exoRuntime(),endpoint=runtime.normalizeExoEndpoint($('exoEndpoint').value);$('exoEndpoint').value=endpoint;$('openExo').href=endpoint;
  if(runtime.isMixedExoContent(endpoint))throw new Error('HTTPS cannot call local HTTP exo. Run scripts/run-exo-local.mjs --lan.');
  if(!quiet)tone($('exoStatus'),'Connecting to exo…','warn');
  const {provider,capabilities}=await runtime.connectExoProvider({endpoint,modelId:saved.exoModel});
  state.exoProvider=provider;state.providerKind='exo';renderExo(capabilities);
  if(capabilities.models.length){
    state.provider=provider;
    tone($('exoStatus'),`${capabilities.cluster.nodeCount} node(s) · ${capabilities.models.length} downloaded model(s).`,'ok');
    tone($('runtimeStatus'),'exo inference ready.','ok');setHeader(providerLabel(),'ok');
  }else{
    state.provider=null;
    tone($('exoStatus'),`${capabilities.cluster.nodeCount} node(s) connected · no downloaded model.`,'warn');
    tone($('runtimeStatus'),'exo connected · no model.','warn');setHeader('exo · no model','warn');
  }
  save();return capabilities;
}

function resizePrompt(){
  const el=$('prompt');el.style.height='auto';el.style.height=`${Math.min(180,Math.max(44,el.scrollHeight))}px`;
}
async function init(){
  $('browserModel').innerHTML=models.map(model=>`<option value="${model.id}">${model.label}</option>`).join('');
  const preferredModel=saved.browserModel;if(preferredModel&&models.some(model=>model.id===preferredModel))$('browserModel').value=preferredModel;
  $('exoEndpoint').value=defaultExoEndpoint();const safeExo=safeHttpOrigin($('exoEndpoint').value);if(safeExo)$('openExo').href=safeExo;else $('openExo').removeAttribute('href');
  if(state.lastProvenance)$('provenance').textContent=JSON.stringify(state.lastProvenance,null,2);
  renderMessages();

  $('browserBackend').textContent='Auto · WebGPU / WASM';

  const params=new URLSearchParams(location.search);
  const requested=params.get('provider')||saved.preferredProvider||'auto';
  if(requested==='exo'){
    chooseProvider('exo');
    try{await connectExo({quiet:true})}catch(error){tone($('exoStatus'),String(error?.message||error),'warn');tone($('runtimeStatus'),'exo was requested but is not reachable. No fallback is active.','warn')}
    return;
  }
  if(requested==='auto'&&location.protocol==='http:'){
    chooseProvider('exo');
    try{await connectExo({quiet:true});return}catch(error){tone($('exoStatus'),String(error?.message||error),'warn')}
  }
  chooseProvider('browser');
  tone($('runtimeStatus'),'Load a browser model.','warn');
}

document.querySelectorAll('.tab').forEach(button=>{
  button.addEventListener('click',()=>tab(button.dataset.tab));
  button.addEventListener('keydown',event=>{
    if(!['ArrowLeft','ArrowRight'].includes(event.key))return;
    const tabs=[...document.querySelectorAll('.tab')],index=tabs.indexOf(button),delta=event.key==='ArrowRight'?1:-1,next=tabs[(index+delta+tabs.length)%tabs.length];
    event.preventDefault();next.focus();tab(next.dataset.tab);
  });
});
$('chooseBrowser').addEventListener('click',()=>chooseProvider('browser',state.browserProvider));
$('chooseExo').addEventListener('click',()=>chooseProvider('exo',state.exoProvider));
$('loadBrowser').addEventListener('click',()=>loadBrowser().catch(error=>{tone($('browserStatus'),String(error?.message||error),'bad');setHeader('browser error','bad');$('loadBrowser').disabled=false}));
$('connectExo').addEventListener('click',()=>connectExo().catch(error=>{tone($('exoStatus'),String(error?.message||error),'bad');setHeader('exo unavailable','bad')}));
$('exoModel').addEventListener('change',()=>{if(state.exoProvider&&$('exoModel').value){state.exoProvider.setModel($('exoModel').value);state.provider=state.exoProvider;state.providerKind='exo';setHeader(providerLabel(),'ok');save()}});
$('exoEndpoint').addEventListener('change',async()=>{try{const runtime=await exoRuntime(),endpoint=runtime.normalizeExoEndpoint($('exoEndpoint').value);$('exoEndpoint').value=endpoint;$('openExo').href=endpoint;tone($('exoStatus'),'Address updated.','warn');save()}catch(error){tone($('exoStatus'),String(error?.message||error),'bad')}});
$('composer').addEventListener('submit',event=>{event.preventDefault();if(state.busy){state.provider?.cancel?.();return}sendMessage($('prompt').value)});
$('prompt').addEventListener('input',resizePrompt);
$('prompt').addEventListener('keydown',event=>{if(event.key==='Enter'&&!event.shiftKey){event.preventDefault();$('composer').requestSubmit()}});
$('clearChat').addEventListener('click',()=>{state.messages=[];state.lastProvenance=null;$('provenance').textContent='No inference yet.';save();renderMessages()});
window.addEventListener('online',()=>setHeader(providerLabel(),state.provider?'ok':'warn'));
window.addEventListener('offline',()=>setHeader('offline','warn'));

init().catch(error=>{tone($('runtimeStatus'),String(error?.message||error),'bad');setHeader('startup error','bad')});
