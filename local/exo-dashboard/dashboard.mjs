const $=id=>document.getElementById(id);
const STORAGE_KEY='conscios-exo-endpoint';

function normalizeEndpoint(value){
  const raw=String(value??'').trim();if(!raw)throw new Error('Enter an exo endpoint first.');
  const url=new URL(raw);if(!['http:','https:'].includes(url.protocol))throw new Error('exo endpoint must use http:// or https://');
  if(url.username||url.password)throw new Error('Do not put credentials in the exo dashboard URL.');
  url.hash='';url.search='';url.pathname='/';return url.toString().replace(/\/$/,'');
}
function isMixed(endpoint){const url=new URL(endpoint);return location.protocol==='https:'&&url.protocol==='http:'}
function setStatus(text,tone=''){$('status').textContent=text;$('status').className=`status ${tone}`}
function setLinks(endpoint){$('openFull').href=endpoint;$('blockedOpen').href=endpoint}
function endpointFromPage(){return normalizeEndpoint($('endpoint').value)}
function save(endpoint){localStorage.setItem(STORAGE_KEY,endpoint)}

function showDashboard(endpoint){
  $('endpoint').value=endpoint;save(endpoint);setLinks(endpoint);
  if(isMixed(endpoint)){
    $('frame').classList.add('hidden');$('frame').removeAttribute('src');$('blocked').classList.remove('hidden');
    $('blockedReason').textContent=`This ConsciOS page is HTTPS, while ${endpoint} is HTTP. The browser will block that dashboard inside an iframe.`;
    setStatus('Dashboard found by address, but in-app framing is blocked by the browser HTTPS → HTTP mixed-content boundary.','warn');return;
  }
  $('blocked').classList.add('hidden');$('frame').classList.remove('hidden');$('frame').src=endpoint;
  setStatus(`Loading the exact exo dashboard from ${endpoint} …`,'ok');
}

async function testApi(endpoint){
  if(isMixed(endpoint)){setStatus('API test is blocked here for the same HTTPS → HTTP reason. Open the full exo dashboard instead, or serve ConsciOS locally.','warn');return}
  setStatus(`Testing ${endpoint}/state …`);
  const controller=new AbortController();const timer=setTimeout(()=>controller.abort(),5000);
  try{
    const response=await fetch(`${endpoint}/state`,{method:'GET',cache:'no-store',credentials:'omit',signal:controller.signal});
    if(!response.ok)throw new Error(`HTTP ${response.status}`);await response.json();
    setStatus(`exo API reachable at ${endpoint}. The embedded dashboard uses this same origin.`,'ok');
  }catch(error){setStatus(`Could not reach exo API: ${error.name==='AbortError'?'request timed out':error.message}`,'bad')}
  finally{clearTimeout(timer)}
}

$('embed').addEventListener('click',()=>{try{showDashboard(endpointFromPage())}catch(error){setStatus(error.message,'bad')}});
$('test').addEventListener('click',()=>{try{const endpoint=endpointFromPage();save(endpoint);setLinks(endpoint);testApi(endpoint)}catch(error){setStatus(error.message,'bad')}});
$('endpoint').addEventListener('change',()=>{try{const endpoint=endpointFromPage();save(endpoint);setLinks(endpoint)}catch{}});
$('frame').addEventListener('load',()=>setStatus(`exo dashboard frame loaded from ${$('frame').src}`,'ok'));

const params=new URLSearchParams(location.search);const candidate=params.get('endpoint')||localStorage.getItem(STORAGE_KEY)||'';
if(candidate){try{showDashboard(normalizeEndpoint(candidate))}catch(error){setStatus(error.message,'bad')}}

export {normalizeEndpoint,isMixed};
