const $ = id => document.getElementById(id);
const ENDPOINT_KEY = 'conscios-exo-endpoint';
const TAB_KEY = 'conscios-exo-active-tab';
const DEFAULT_ENDPOINT = 'http://localhost:52415';
const QUICK_TIMEOUT_MS = 8000;
const INFERENCE_TIMEOUT_MS = 180000;

function normalizeEndpoint(value) {
  const raw = String(value ?? '').trim();
  if (!raw) throw new Error('Enter an exo endpoint first.');
  const url = new URL(raw);
  if (!['http:', 'https:'].includes(url.protocol)) throw new Error('exo endpoint must use http:// or https://');
  if (url.username || url.password) throw new Error('Do not put credentials in the exo URL.');
  url.hash = '';
  url.search = '';
  url.pathname = '/';
  return url.toString().replace(/\/$/, '');
}

function isMixed(endpoint) {
  const url = new URL(endpoint);
  return location.protocol === 'https:' && url.protocol === 'http:';
}

function endpointFromPage() {
  return normalizeEndpoint($('endpoint').value);
}

function saveEndpoint(endpoint) {
  localStorage.setItem(ENDPOINT_KEY, endpoint);
}

function routeUrl(endpoint, route = '/') {
  if (route === '/') return `${endpoint}/`;
  return `${endpoint}${route.startsWith('/') ? route : `/${route}`}`;
}

function setStatus(text, tone = 'info') {
  $('statusText').textContent = text;
  $('status').className = `status ${tone}`;
}

function setExternalLinks(endpoint, route = '/') {
  const href = routeUrl(endpoint, route === 'test' ? '/' : route);
  $('openFull').href = href;
  $('blockedOpen').href = href;
}

function selectedTab() {
  return document.querySelector('.appTab[aria-selected="true"]');
}

function setSelectedTab(tab) {
  document.querySelectorAll('.appTab').forEach(button => button.setAttribute('aria-selected', button === tab ? 'true' : 'false'));
  localStorage.setItem(TAB_KEY, tab.dataset.route || '/');
}

function showMixedContentBoundary(endpoint) {
  $('frame').removeAttribute('src');
  $('blocked').classList.remove('hidden');
  $('blockedReason').textContent = `ConsciOS is loaded over HTTPS while ${endpoint} uses HTTP. Modern browsers block that active mixed content inside an iframe and from fetch().`;
  setStatus('Browser security is blocking the HTTP exo app inside this HTTPS page.', 'warn');
}

function showDashboardRoute(endpoint, route = '/') {
  $('testPanel').classList.add('hidden');
  $('framePanel').classList.remove('hidden');
  setExternalLinks(endpoint, route);
  if (isMixed(endpoint)) {
    showMixedContentBoundary(endpoint);
    return;
  }
  $('blocked').classList.add('hidden');
  const next = routeUrl(endpoint, route);
  if ($('frame').src !== next) $('frame').src = next;
  setStatus(`Loading native exo ${route === '/' ? 'home' : route} from ${endpoint} …`, 'info');
}

function showTestPanel(endpoint) {
  $('framePanel').classList.add('hidden');
  $('testPanel').classList.remove('hidden');
  setExternalLinks(endpoint, '/');
  if (isMixed(endpoint)) setStatus('Acceptance testing is blocked by the HTTPS → HTTP mixed-content boundary.', 'warn');
  else setStatus('Acceptance test ready. A PASS requires a real chat-completion response.', 'info');
}

function activateTab(tab, {load = true} = {}) {
  setSelectedTab(tab);
  if (!load) return;
  let endpoint;
  try {
    endpoint = endpointFromPage();
    saveEndpoint(endpoint);
  } catch (error) {
    setStatus(error.message, 'bad');
    return;
  }
  if (tab.dataset.view === 'test') showTestPanel(endpoint);
  else showDashboardRoute(endpoint, tab.dataset.route || '/');
}

async function request(endpoint, path, options = {}, timeoutMs = QUICK_TIMEOUT_MS) {
  if (isMixed(endpoint)) throw new Error('Browser blocked HTTPS → HTTP mixed content.');
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(routeUrl(endpoint, path), {
      cache: 'no-store',
      credentials: 'omit',
      ...options,
      signal: controller.signal,
      headers: {
        ...(options.body ? {'Content-Type': 'application/json'} : {}),
        ...(options.headers || {})
      }
    });
    const contentType = response.headers.get('content-type') || '';
    const payload = contentType.includes('application/json') ? await response.json() : await response.text();
    if (!response.ok) {
      const detail = typeof payload === 'string' ? payload.slice(0, 300) : payload?.detail || payload?.error?.message || JSON.stringify(payload).slice(0, 300);
      throw new Error(`HTTP ${response.status}${detail ? ` — ${detail}` : ''}`);
    }
    return payload;
  } catch (error) {
    if (error.name === 'AbortError') throw new Error(`request timed out after ${Math.round(timeoutMs / 1000)}s`);
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

function stepElement(name) {
  return document.querySelector(`[data-step="${name}"]`);
}

function resetSteps() {
  document.querySelectorAll('.step').forEach(step => {
    step.dataset.state = 'idle';
    const detail = step.querySelector('.stepDetail');
    detail.textContent = detail.dataset.default || detail.textContent;
    if (!detail.dataset.default) detail.dataset.default = detail.textContent;
  });
  $('resultBanner').className = 'resultBanner';
  $('resultBanner').querySelector('h3').textContent = 'Test running…';
  $('resultSummary').textContent = 'Executing required exo checks in order.';
  $('testOutput').textContent = 'Waiting for inference step…';
}

async function runStep(name, action) {
  const step = stepElement(name);
  const detail = step.querySelector('.stepDetail');
  step.dataset.state = 'running';
  detail.textContent = 'Running…';
  try {
    const result = await action();
    step.dataset.state = 'pass';
    detail.textContent = result || 'PASS';
    return result;
  } catch (error) {
    step.dataset.state = 'fail';
    detail.textContent = error.message;
    throw error;
  }
}

function modelIds(payload) {
  if (!payload || !Array.isArray(payload.data)) throw new Error('exo returned an unexpected /v1/models response.');
  return payload.data.map(item => typeof item === 'string' ? item : item?.id).filter(Boolean);
}

function populateModels(ids) {
  const select = $('testModel');
  const previous = select.value;
  select.innerHTML = '';
  if (!ids.length) {
    const option = document.createElement('option');
    option.value = '';
    option.textContent = 'No downloaded models found';
    select.append(option);
    return;
  }
  for (const id of ids) {
    const option = document.createElement('option');
    option.value = id;
    option.textContent = id;
    select.append(option);
  }
  if (ids.includes(previous)) select.value = previous;
}

async function loadDownloadedModels(endpoint, {announce = true} = {}) {
  if (announce) setStatus('Discovering downloaded exo models…', 'info');
  const payload = await request(endpoint, '/v1/models?status=downloaded');
  const ids = modelIds(payload);
  populateModels(ids);
  if (announce) setStatus(ids.length ? `Discovered ${ids.length} downloaded exo model${ids.length === 1 ? '' : 's'}.` : 'exo is reachable, but no downloaded models are available yet.', ids.length ? 'ok' : 'warn');
  return ids;
}

function compactStateSummary(state) {
  if (!state || typeof state !== 'object') return 'state JSON received';
  const keys = Object.keys(state);
  return keys.length ? `state received (${keys.slice(0, 5).join(', ')}${keys.length > 5 ? ', …' : ''})` : 'state object received';
}

async function runAcceptanceTest() {
  let endpoint;
  try {
    endpoint = endpointFromPage();
    saveEndpoint(endpoint);
  } catch (error) {
    setStatus(error.message, 'bad');
    return;
  }
  const testTab = document.querySelector('.appTab[data-view="test"]');
  setSelectedTab(testTab);
  showTestPanel(endpoint);
  resetSteps();
  $('runTest').disabled = true;
  $('quickTest').disabled = true;
  $('refreshModels').disabled = true;
  const started = performance.now();
  try {
    await runStep('identity', async () => {
      const payload = await request(endpoint, '/node_id');
      const id = payload?.node_id ?? payload?.id ?? payload;
      if (id === undefined || id === null || String(id).trim() === '') throw new Error('node identity response was empty');
      return `node ${String(id).slice(0, 80)}`;
    });
    await runStep('state', async () => {
      const payload = await request(endpoint, '/state');
      if (!payload || typeof payload !== 'object') throw new Error('cluster state was not a JSON object');
      return compactStateSummary(payload);
    });
    await runStep('features', async () => {
      const payload = await request(endpoint, '/v1/feature-flags');
      if (!payload || typeof payload !== 'object') throw new Error('feature-flag API did not return JSON');
      const count = Array.isArray(payload) ? payload.length : Object.keys(payload).length;
      return `current feature API reachable (${count} entr${count === 1 ? 'y' : 'ies'})`;
    });
    const ids = await runStep('models', async () => {
      const discovered = await loadDownloadedModels(endpoint, {announce: false});
      if (!discovered.length) throw new Error('no downloaded model found — use the Downloads tab first');
      return discovered;
    });
    stepElement('models').querySelector('.stepDetail').textContent = `${ids.length} downloaded model${ids.length === 1 ? '' : 's'} available`;
    const chosen = $('testModel').value || ids[0];
    if (!chosen) throw new Error('No model selected for inference.');
    await runStep('inference', async () => {
      setStatus(`Running real exo inference with ${chosen}. First use may take a while to place/load the model…`, 'info');
      const payload = await request(endpoint, '/v1/chat/completions', {
        method: 'POST',
        body: JSON.stringify({
          model: chosen,
          messages: [{role: 'user', content: 'Reply briefly with the text EXO_OK.'}],
          stream: false,
          max_tokens: 16,
          temperature: 0
        })
      }, INFERENCE_TIMEOUT_MS);
      const content = payload?.choices?.[0]?.message?.content;
      if (typeof content !== 'string' || !content.trim()) throw new Error('chat completion returned no assistant text');
      $('testOutput').textContent = content.trim();
      return `assistant returned ${content.trim().length} characters`;
    });
    const elapsed = ((performance.now() - started) / 1000).toFixed(1);
    $('resultBanner').className = 'resultBanner pass';
    $('resultBanner').querySelector('h3').textContent = 'PASS · exo is ready inside ConsciOS';
    $('resultSummary').textContent = `All required checks passed in ${elapsed}s using ${chosen}. This proves the integrated path reaches a real exo model.`;
    setStatus(`PASS — exo node, cluster state, model discovery, and neural inference all succeeded (${elapsed}s).`, 'ok');
  } catch (error) {
    $('resultBanner').className = 'resultBanner fail';
    $('resultBanner').querySelector('h3').textContent = 'NOT READY';
    $('resultSummary').textContent = error.message;
    setStatus(`exo acceptance test stopped: ${error.message}`, 'bad');
  } finally {
    $('runTest').disabled = false;
    $('quickTest').disabled = false;
    $('refreshModels').disabled = false;
  }
}

function connectAndReload() {
  try {
    const endpoint = endpointFromPage();
    saveEndpoint(endpoint);
    const tab = selectedTab() || document.querySelector('.appTab');
    setExternalLinks(endpoint, tab.dataset.route || '/');
    if (tab.dataset.view === 'test') showTestPanel(endpoint);
    else showDashboardRoute(endpoint, tab.dataset.route || '/');
  } catch (error) {
    setStatus(error.message, 'bad');
  }
}

document.querySelectorAll('.appTab').forEach(tab => tab.addEventListener('click', () => activateTab(tab)));
$('connect').addEventListener('click', connectAndReload);
$('quickTest').addEventListener('click', runAcceptanceTest);
$('runTest').addEventListener('click', runAcceptanceTest);
$('refreshModels').addEventListener('click', async () => {
  try {
    const endpoint = endpointFromPage();
    saveEndpoint(endpoint);
    await loadDownloadedModels(endpoint);
  } catch (error) {
    setStatus(`Could not discover downloaded models: ${error.message}`, 'bad');
  }
});
$('openDownloads').addEventListener('click', () => {
  const tab = document.querySelector('.appTab[data-route="/downloads"]');
  activateTab(tab);
});
$('endpoint').addEventListener('change', () => {
  try {
    const endpoint = endpointFromPage();
    saveEndpoint(endpoint);
    const tab = selectedTab();
    setExternalLinks(endpoint, tab?.dataset.route || '/');
  } catch (error) {
    setStatus(error.message, 'bad');
  }
});
$('frame').addEventListener('load', () => {
  const tab = selectedTab();
  if (tab?.dataset.view === 'dashboard') setStatus(`Native exo ${tab.dataset.route === '/' ? 'home' : tab.dataset.route} loaded.`, 'ok');
});

const params = new URLSearchParams(location.search);
let endpoint = DEFAULT_ENDPOINT;
try {
  endpoint = normalizeEndpoint(params.get('endpoint') || localStorage.getItem(ENDPOINT_KEY) || DEFAULT_ENDPOINT);
} catch (error) {
  setStatus(error.message, 'bad');
}
$('endpoint').value = endpoint;
saveEndpoint(endpoint);
const requestedRoute = params.get('tab') || localStorage.getItem(TAB_KEY) || '/';
const initialTab = Array.from(document.querySelectorAll('.appTab')).find(tab => tab.dataset.route === requestedRoute) || document.querySelector('.appTab[data-route="/"]');
setSelectedTab(initialTab);
if (initialTab.dataset.view === 'test') showTestPanel(endpoint);
else showDashboardRoute(endpoint, initialTab.dataset.route || '/');

export {normalizeEndpoint, isMixed, modelIds, routeUrl};
