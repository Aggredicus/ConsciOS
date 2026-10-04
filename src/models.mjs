const DEFAULT_CAPABILITIES = Object.freeze({
  chat: true,
  multiTurn: true,
  structuredOutput: false,
  logprobs: false,
  hiddenStates: false,
  attention: false,
  hooks: false,
  persistentState: false,
  tools: false
});

function cleanBaseUrl(value) {
  const url = new URL(String(value));
  if (!['http:', 'https:'].includes(url.protocol)) throw new Error('Model endpoint must use http or https.');
  if (url.username || url.password) throw new Error('Do not embed credentials in the model endpoint URL.');
  return url.toString().replace(/\/$/, '');
}

function normalizeMessages(messages) {
  if (!Array.isArray(messages) || !messages.length) throw new Error('messages must be a non-empty array');
  return messages.map(message => ({
    role: ['system','user','assistant','tool'].includes(message.role) ? message.role : 'user',
    content: String(message.content ?? '')
  }));
}

export function createOpenAICompatibleAdapter({
  name,
  baseUrl,
  model,
  apiKey = '',
  fetchImpl = globalThis.fetch,
  capabilities = {},
  defaultTemperature = 0
}) {
  if (!name) throw new Error('Model name is required.');
  if (!model) throw new Error('Model identifier is required.');
  if (typeof fetchImpl !== 'function') throw new Error('fetch is unavailable in this runtime.');
  const root = cleanBaseUrl(baseUrl);
  const endpoint = root.endsWith('/chat/completions') ? root : `${root}/chat/completions`;
  const manifest = Object.freeze({
    name: String(name),
    kind: 'openai-compatible',
    model: String(model),
    endpoint,
    capabilities: Object.freeze({...DEFAULT_CAPABILITIES, ...capabilities}),
    access: 'black-box-api'
  });

  return Object.freeze({
    manifest,
    async generate({messages, temperature = defaultTemperature, maxTokens = 512} = {}) {
      const started = Date.now();
      const headers = {'content-type':'application/json'};
      if (apiKey) headers.authorization = `Bearer ${apiKey}`;
      const response = await fetchImpl(endpoint, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          model: manifest.model,
          messages: normalizeMessages(messages),
          temperature,
          max_tokens: maxTokens
        })
      });
      if (!response.ok) {
        const detail = (await response.text()).slice(0, 1000);
        throw new Error(`Model endpoint returned ${response.status}: ${detail}`);
      }
      const data = await response.json();
      const text = data?.choices?.[0]?.message?.content;
      if (typeof text !== 'string') throw new Error('Model response did not contain choices[0].message.content.');
      return {
        text,
        latencyMs: Date.now() - started,
        usage: data.usage ?? null,
        model: data.model ?? manifest.model
      };
    }
  });
}

export function createScriptedModelAdapter({name='scripted-test-model', responder, capabilities={}} = {}) {
  if (typeof responder !== 'function') throw new Error('Scripted adapter requires responder(messages).');
  const manifest = Object.freeze({
    name,
    kind:'scripted',
    model:name,
    endpoint:null,
    capabilities:Object.freeze({...DEFAULT_CAPABILITIES,...capabilities}),
    access:'test-double'
  });
  return Object.freeze({
    manifest,
    async generate({messages}={}) {
      const started=Date.now();
      const text=await responder(normalizeMessages(messages));
      return {text:String(text),latencyMs:Date.now()-started,usage:null,model:name};
    }
  });
}

export function createModelRegistry() {
  const models = new Map();
  let active = null;

  return Object.freeze({
    add(adapter) {
      if (!adapter?.manifest?.name || typeof adapter.generate !== 'function') throw new Error('Invalid model adapter.');
      models.set(adapter.manifest.name, adapter);
      if (!active) active = adapter.manifest.name;
      return adapter.manifest;
    },
    remove(name) {
      const existed = models.delete(name);
      if (active === name) active = models.keys().next().value ?? null;
      return existed;
    },
    use(name) {
      if (!models.has(name)) throw new Error(`Unknown model: ${name}`);
      active = name;
      return models.get(name).manifest;
    },
    get(name) { return models.get(name) ?? null; },
    active() { return active ? models.get(active) : null; },
    activeName() { return active; },
    list() { return [...models.values()].map(adapter => adapter.manifest); }
  });
}
