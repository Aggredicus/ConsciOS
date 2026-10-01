const $=id=>document.getElementById(id);
const ENDPOINT_KEY='conscios-exo-endpoint';
const TAB_KEY='conscios-exo-active-tab';
const QUICK_TIMEOUT_MS=8000;
const INFERENCE_TIMEOUT_MS=180000;
const INSTANCE_TIMEOUT_MS=185000;

function normalizeEndpoint(value){
  const raw=String(value??'').trim();
  if(!raw)throw new Error('No exo runtime address is available. Use the Run exo tab.');
  const url=new URL(raw);
  if(!['http:','https:'].includes(url.protocol))throw new Error('exo runtime must use http:// or https://');
  if(url.username||url.password)throw new Error('Do not put credentials in the exo runtime URL.');
  url.hash='';url.search='';url.pathname='/';
  return url.toString().replace(/\/$/,'');
}
function isLoopback(hostname){return hostname==='localhost'||hostname==='127.0.0.1'||hostname==='::1'||hostname==='[::1]'}
function isBlockedMixed(endpoint){const url=new URL(endpoint);return location.protocol==='https:'&&url.protocol==='http:'&&!isLoopback(url.hostname)}
function defaultEndpoint(){
  const params=new URLSearchParams(location.search);const query=params.get('endpoint');if(query)return normalizeEndpoint(query);
  const stored=localStorage.getItem(ENDPOINT_KEY);if(stored){try{return normalizeEndpoint(stored)}catch{localStorage.removeItem(ENDPOINT_KEY)}}
  const hosted=/\.github\.io$/i.test(location.hostname);
  const host=!hosted&&location.protocol==='http:'?location.hostname:'localhost';
  return `http://${host}:52415`;
}
function routeUrl(endpoint,path='/'){return new URL(path,`${endpoint}/`).toString()}
function dashboardRouteUrl(endpoint,route='/'){
  if(!route||route==='/')return `${endpoint}/`;
  const normalized=route.startsWith('/')?route:`/${route}`;
  return `${endpoint}/#${normalized}`;
}
function currentEndpoint(){return normalizeEndpoint($('endpoint').value)}
function saveEndpoint(endpoint){localStorage.setItem(ENDPOINT_KEY,endpoint)}
function setStatus(text,tone='info'){$('statusText').textContent=text;$('status').className=`status ${tone}`}
function setRuntimeBanner(text=''){$('runtimeBanner').textContent=text;$('runtimeBanner').classList.toggle('show',Boolean(text))}
function setExternal(endpoint,route='/'){const href=route==='test'||route==='setup'?`${endpoint}/`:dashboardRouteUrl(endpoint,route);$('openFull').href=href}
function selectedTab(){return document.querySelector('.appTab[aria-selected="true"]')}
function selectTab(tab){document.querySelectorAll('.appTab').forEach(item=>item.setAttribute('aria-selected',item===tab?'true':'false'));localStorage.setItem(TAB_KEY,tab.dataset.route||'/')}
function hideAllPanels(){$('framePanel').classList.add('hidden');$('testPanel').classList.add('hidden');$('setupPanel').classList.add('hidden')}
function showSetup(){hideAllPanels();$('setupPanel').classList.remove('hidden');setStatus('Local runtime instructions are shown below.','info')}
function showBlocked(endpoint){$('frame').removeAttribute('src');$('blocked').classList.remove('hidden');$('blockedReason').textContent=`This ConsciOS page uses HTTPS while ${endpoint} is an HTTP LAN address. Browsers block that active mixed content. Use the local launcher and open the LAN ConsciOS URL it prints.`;setStatus('The hosted page cannot embed this HTTP LAN runtime.','warn')}
function showDashboard(endpoint,route='/'){
  hideAllPanels();$('framePanel').classList.remove('hidden');setExternal(endpoint,route);
  if(isBlockedMixed(endpoint)){showBlocked(endpoint);return}
  $('blocked').classList.add('hidden');const src=dashboardRouteUrl(endpoint,route);if($('frame').src!==src)$('frame').src=src;setStatus(`Loading native exo ${route==='/'?'home':route}…`,'info')
}
function showTest(endpoint){hideAllPanels();$('testPanel').classList.remove('hidden');setExternal(endpoint,'/');if(isBlockedMixed(endpoint))setStatus('Acceptance testing is blocked by HTTPS → HTTP LAN mixed content. Use the local launcher.','warn');else setStatus('Acceptance test ready. A pass requires a real model response.','info')}
function activate(tab){selectTab(tab);let endpoint;try{endpoint=currentEndpoint();saveEndpoint(endpoint)}catch(error){setStatus(error.message,'bad');showSetup();return}if(tab.dataset.view==='setup')showSetup();else if(tab.dataset.view==='test')showTest(endpoint);else showDashboard(endpoint,tab.dataset.route||'/')}

async function request(endpoint,path,options={},timeoutMs=QUICK_TIMEOUT_MS){
  if(isBlockedMixed(endpoint))throw new Error('Browser blocked HTTPS → HTTP LAN mixed content. Open the local ConsciOS URL instead.');
  const controller=new AbortController();const timer=setTimeout(()=>controller.abort(),timeoutMs);
  try{const response=await fetch(routeUrl(endpoint,path),{cache:'no-store',credentials:'omit',...options,signal:controller.signal,headers:{...(options.body?{'Content-Type':'application/json'}:{}),...(options.headers||{})}});const type=response.headers.get('content-type')||'';const payload=type.includes('application/json')?await response.json():await response.text();if(!response.ok){const detail=typeof payload==='string'?payload.slice(0,280):payload?.detail||payload?.error?.message||JSON.stringify(payload).slice(0,280);throw new Error(`HTTP ${response.status}${detail?` — ${detail}`:''}`)}return payload}catch(error){if(error.name==='AbortError')throw new Error(`request timed out after ${Math.round(timeoutMs/1000)}s`);throw error}finally{clearTimeout(timer)}
}
async function probe(endpoint,{quiet=false}={}){
  if(!quiet)setStatus(`Checking ${endpoint}…`,'info');
  try{const payload=await request(endpoint,'/node_id',{},5000);const id=payload?.node_id??payload?.id??payload;if(id===undefined||id===null||String(id).trim()==='')throw new Error('empty node identity');if(!quiet)setStatus(`exo is running · node ${String(id).slice(0,60)}`,'ok');return true}catch(error){if(!quiet){setStatus(`exo is not reachable yet: ${error.message}`,'warn');setRuntimeBanner('No exo runtime is running at the automatic address. Open “Run exo” for the one-command local launcher.')}return false}
}
function instanceReadyText(value){return typeof value==='string'&&/"type"\s*:\s*"ready"/.test(value)}
async function ensureModelInstance(endpoint,modelId){
  const encoded=encodeURIComponent(modelId);
  const quick=await request(endpoint,`/instance/await?model_id=${encoded}&timeout_seconds=0.2`,{},5000);
  if(instanceReadyText(quick))return 'existing instance ready';
  setStatus(`Placing ${modelId} on the exo cluster…`,'info');
  await request(endpoint,'/place_instance',{method:'POST',body:JSON.stringify({model_id:modelId})},15000);
  const awaited=await request(endpoint,`/instance/await?model_id=${encoded}&timeout_seconds=180`,{},INSTANCE_TIMEOUT_MS);
  if(!instanceReadyText(awaited))throw new Error(`exo did not report a ready instance for ${modelId}`);
  return 'model instance placed and ready';
}

function step(name){return document.querySelector(`[data-step="${name}"]`)}
function resetSteps(){document.querySelectorAll('.step').forEach(item=>{item.dataset.state='idle';const detail=item.querySelector('.stepDetail');if(!detail.dataset.default)detail.dataset.default=detail.textContent;detail.textContent=detail.dataset.default});$('resultBanner').className='resultBanner';$('resultBanner').querySelector('h3').textContent='Test running…';$('resultSummary').textContent='Executing required exo checks in order.';$('testOutput').textContent='Waiting for inference step…'}
async function runStep(name,fn){const item=step(name);const detail=item.querySelector('.stepDetail');item.dataset.state='running';detail.textContent='Running…';try{const result=await fn();item.dataset.state='pass';detail.textContent=typeof result==='string'?result:'PASS';return result}catch(error){item.dataset.state='fail';detail.textContent=error.message;throw error}}
function modelIds(payload){if(!payload||!Array.isArray(payload.data))throw new Error('Unexpected /v1/models response.');return payload.data.map(item=>typeof item==='string'?item:item?.id).filter(Boolean)}
function populateModels(ids){const select=$('testModel');const previous=select.value;select.replaceChildren();if(!ids.length){const option=document.createElement('option');option.value='';option.textContent='No downloaded models found';select.append(option);return}for(const id of ids){const option=document.createElement('option');option.value=id;option.textContent=id;select.append(option)}if(ids.includes(previous))select.value=previous}
async function loadModels(endpoint,{announce=true}={}){if(announce)setStatus('Discovering downloaded exo models…','info');const payload=await request(endpoint,'/v1/models?status=downloaded');const ids=modelIds(payload);populateModels(ids);if(announce)setStatus(ids.length?`Found ${ids.length} downloaded exo model${ids.length===1?'':'s'}.`:'exo is reachable, but no downloaded model is available yet.',ids.length?'ok':'warn');return ids}
async function runAcceptance(){
  let endpoint;try{endpoint=currentEndpoint();saveEndpoint(endpoint)}catch(error){setStatus(error.message,'bad');return}
  const testTab=document.querySelector('.appTab[data-view="test"]');selectTab(testTab);showTest(endpoint);resetSteps();$('runTest').disabled=true;$('quickTest').disabled=true;$('refreshModels').disabled=true;const started=performance.now();
  try{
    await runStep('identity',async()=>{const payload=await request(endpoint,'/node_id');const id=payload?.node_id??payload?.id??payload;if(id===undefined||id===null||String(id).trim()==='')throw new Error('node identity was empty');return `node ${String(id).slice(0,80)}`});
    await runStep('state',async()=>{const payload=await request(endpoint,'/state');if(!payload||typeof payload!=='object')throw new Error('cluster state was not JSON');const keys=Object.keys(payload);return `state received${keys.length?` (${keys.slice(0,4).join(', ')}${keys.length>4?', …':''})`:''}`});
    await runStep('features',async()=>{const payload=await request(endpoint,'/v1/feature-flags');if(payload===null||typeof payload!=='object')throw new Error('feature flags were not JSON');return 'current feature API reachable'});
    const ids=await runStep('models',async()=>{const found=await loadModels(endpoint,{announce:false});if(!found.length)throw new Error('no downloaded model found — use Downloads first');return found});step('models').querySelector('.stepDetail').textContent=`${ids.length} downloaded model${ids.length===1?'':'s'} available`;
    const chosen=$('testModel').value||ids[0];await runStep('inference',async()=>{const placement=await ensureModelInstance(endpoint,chosen);setStatus(`Running real exo inference with ${chosen}…`,'info');const payload=await request(endpoint,'/v1/chat/completions',{method:'POST',body:JSON.stringify({model:chosen,messages:[{role:'user',content:'Reply briefly with the text EXO_OK.'}],stream:false,max_tokens:16,temperature:0})},INFERENCE_TIMEOUT_MS);const content=payload?.choices?.[0]?.message?.content;if(typeof content!=='string'||!content.trim())throw new Error('chat completion returned no assistant text');$('testOutput').textContent=content.trim();return `${placement}; assistant returned ${content.trim().length} characters`});
    const elapsed=((performance.now()-started)/1000).toFixed(1);$('resultBanner').className='resultBanner pass';$('resultBanner').querySelector('h3').textContent='PASS · exo is ready inside ConsciOS';$('resultSummary').textContent=`All required checks passed in ${elapsed}s using ${chosen}.`;setStatus(`PASS — live exo inference succeeded in ${elapsed}s.`,'ok');setRuntimeBanner('')
  }catch(error){$('resultBanner').className='resultBanner fail';$('resultBanner').querySelector('h3').textContent='NOT READY';$('resultSummary').textContent=error.message;setStatus(`exo acceptance test stopped: ${error.message}`,'bad')}
  finally{$('runTest').disabled=false;$('quickTest').disabled=false;$('refreshModels').disabled=false}
}

document.querySelectorAll('.appTab').forEach(tab=>tab.addEventListener('click',()=>activate(tab)));
$('connect').addEventListener('click',async()=>{try{const endpoint=currentEndpoint();saveEndpoint(endpoint);setRuntimeBanner('');const tab=selectedTab();if(tab?.dataset.view==='test')showTest(endpoint);else if(tab?.dataset.view==='setup')showSetup();else showDashboard(endpoint,tab?.dataset.route||'/');await probe(endpoint)}catch(error){setStatus(error.message,'bad')}});
$('quickTest').addEventListener('click',runAcceptance);$('runTest').addEventListener('click',runAcceptance);
$('refreshModels').addEventListener('click',async()=>{try{const endpoint=currentEndpoint();saveEndpoint(endpoint);await loadModels(endpoint)}catch(error){setStatus(`Could not discover models: ${error.message}`,'bad')}});
$('openDownloads').addEventListener('click',()=>activate(document.querySelector('.appTab[data-route="/downloads"]')));
$('showSetup').addEventListener('click',()=>activate(document.querySelector('.appTab[data-view="setup"]')));
$('endpoint').addEventListener('change',()=>{try{const endpoint=currentEndpoint();saveEndpoint(endpoint);setExternal(endpoint,selectedTab()?.dataset.route||'/')}catch(error){setStatus(error.message,'bad')}});
$('frame').addEventListener('load',()=>{const tab=selectedTab();if(tab?.dataset.view==='dashboard')setStatus(`Native exo ${tab.dataset.route==='/'?'home':tab.dataset.route} frame loaded.`,'ok')});

const endpoint=defaultEndpoint();$('endpoint').value=endpoint;saveEndpoint(endpoint);setExternal(endpoint,'/');
const hosted=/\.github\.io$/i.test(location.hostname);if(hosted)setRuntimeBanner('Hosted demo: GitHub Pages can show the UI but cannot start exo. Desktop browsers can connect to an already-running localhost exo where browser policy permits; phones should use the LAN URL printed by “node scripts/run-exo-local.mjs --lan”.');
const requested=new URLSearchParams(location.search).get('tab')||localStorage.getItem(TAB_KEY)||'/';const initial=Array.from(document.querySelectorAll('.appTab')).find(tab=>tab.dataset.route===requested)||document.querySelector('.appTab[data-route="/"]');selectTab(initial);if(initial.dataset.view==='setup')showSetup();else if(initial.dataset.view==='test')showTest(endpoint);else showDashboard(endpoint,initial.dataset.route||'/');probe(endpoint,{quiet:false});

export {normalizeEndpoint,isBlockedMixed,routeUrl,dashboardRouteUrl,defaultEndpoint,modelIds,ensureModelInstance};
