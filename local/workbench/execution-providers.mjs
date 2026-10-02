import {executeJavaScript,executePython,executeToolRequest,interpolateText} from './notebook-engine.mjs';
import {DEFAULT_SANDBOX_ENDPOINT,SANDBOX_RESULT_FORMAT,createSandboxRequest,normalizeSandboxEndpoint} from '../../runtime/execution/sandbox-contract.mjs';

export const EXECUTION_PROTOCOL='conscios-execution/v1';
export const EXECUTION_RESULT_FORMAT='conscios-execution-result/v1';

export const TOOL_CELL_TYPES=Object.freeze([
  'procedure',
  'world-inspect',
  'property-inspector',
  'node-graph',
  'spatial-prompt',
  'playtest'
]);

function requiredString(value,name){
  if(typeof value!=='string'||!value.trim())throw new TypeError(`${name} must be a non-empty string`);
  return value.trim();
}
function normalizeCellTypes(value){
  if(!Array.isArray(value)||value.length===0)throw new TypeError('execution provider cellTypes must be a non-empty array');
  const out=[...new Set(value.map(item=>requiredString(item,'cell type')))];
  return Object.freeze(out);
}

export function createExecutionProvider({id,label=id,location='browser',cellTypes,execute,capabilities={}}={}){
  const providerId=requiredString(id,'execution provider id');
  const providerLabel=requiredString(label,'execution provider label');
  const providerLocation=requiredString(location,'execution provider location');
  const supported=normalizeCellTypes(cellTypes);
  if(typeof execute!=='function')throw new TypeError('execution provider execute must be a function');

  return Object.freeze({
    protocol:EXECUTION_PROTOCOL,
    id:providerId,
    label:providerLabel,
    location:providerLocation,
    cellTypes:supported,
    capabilities:Object.freeze({...capabilities}),
    canExecute(cell){return Boolean(cell&&supported.includes(cell.type))},
    record(){return {protocol:EXECUTION_PROTOCOL,id:providerId,label:providerLabel,location:providerLocation,cellTypes:[...supported],capabilities:{...capabilities}}},
    async execute(cell,context,options={}){
      if(!this.canExecute(cell))throw new Error(`execution provider ${providerId} does not support cell type '${cell?.type??'unknown'}'`);
      const started=globalThis.performance?.now?.()??Date.now();
      const result=await execute(cell,context,options);
      const elapsedMs=Math.max(0,(globalThis.performance?.now?.()??Date.now())-started);
      if(!result||typeof result!=='object'||!Object.prototype.hasOwnProperty.call(result,'output'))throw new TypeError(`execution provider ${providerId} returned an invalid result`);
      return {
        format:EXECUTION_RESULT_FORMAT,
        output:result.output,
        provenance:{
          executionProtocol:EXECUTION_PROTOCOL,
          executionProvider:this.record(),
          ...(result.provenance??{}),
          providerElapsedMs:elapsedMs
        }
      };
    }
  });
}

export function createExecutionRouter(){
  const providers=new Map();
  return {
    protocol:EXECUTION_PROTOCOL,
    providers,
    register(provider){
      if(!provider||provider.protocol!==EXECUTION_PROTOCOL||typeof provider.id!=='string'||typeof provider.execute!=='function')throw new TypeError('invalid conscios-execution/v1 provider');
      if(providers.has(provider.id))throw new Error(`execution provider '${provider.id}' is already registered`);
      providers.set(provider.id,provider);return provider;
    },
    replace(provider){
      if(!provider||provider.protocol!==EXECUTION_PROTOCOL||typeof provider.id!=='string'||typeof provider.execute!=='function')throw new TypeError('invalid conscios-execution/v1 provider');
      providers.set(provider.id,provider);return provider;
    },
    unregister(id){return providers.delete(id)},
    providerFor(cell){
      const requested=cell?.config?.executionProvider;
      if(requested){
        const provider=providers.get(requested);
        if(!provider)throw new Error(`Requested execution provider '${requested}' is not registered. No fallback is active.`);
        if(!provider.canExecute(cell))throw new Error(`Requested execution provider '${requested}' does not support cell type '${cell?.type??'unknown'}'. No fallback is active.`);
        return provider;
      }
      const matches=[...providers.values()].filter(provider=>provider.canExecute(cell));
      if(matches.length===0)throw new Error(`No execution provider is registered for cell type '${cell?.type??'unknown'}'.`);
      if(matches.length>1)throw new Error(`Multiple execution providers support cell type '${cell.type}'. Set cell.config.executionProvider explicitly.`);
      return matches[0];
    },
    async execute(cell,context,options={}){
      const provider=this.providerFor(cell);
      return provider.execute(cell,context,options);
    },
    records(){return [...providers.values()].map(provider=>provider.record())}
  };
}

export function createBrowserJavaScriptExecutionProvider(){
  return createExecutionProvider({
    id:'browser-javascript',
    label:'Browser JavaScript worker',
    location:'browser-worker',
    cellTypes:['javascript'],
    capabilities:{network:false,hostFilesystem:false,isolatedWorker:true},
    execute:async(cell,context)=>{
      const execution=await executeJavaScript(cell.source,context);
      return {output:{result:execution.result,logs:execution.logs},provenance:{kind:'browser-javascript-worker'}};
    }
  });
}

export function createBrowserPythonExecutionProvider(){
  return createExecutionProvider({
    id:'browser-python',
    label:'Browser Python · Pyodide',
    location:'browser-main-thread',
    cellTypes:['python'],
    capabilities:{network:'browser-policy',hostFilesystem:false,pyodide:true},
    execute:async(cell,context,{onStatus=()=>{}}={})=>{
      const execution=await executePython(cell.source,context,{onStatus});
      return {output:{result:execution.result,stdout:execution.stdout,stderr:execution.stderr},provenance:{kind:'browser-python',runtime:execution.runtime}};
    }
  });
}

export function createHttpToolExecutionProvider(){
  return createExecutionProvider({
    id:'http-tool-bridge',
    label:'Explicit HTTP tool bridge',
    location:'declared-http-endpoint',
    cellTypes:TOOL_CELL_TYPES,
    capabilities:{network:true,hostFilesystem:'endpoint-defined',explicitEndpoint:true},
    execute:async(cell,context)=>{
      const execution=await executeToolRequest(cell,context);
      return {output:execution.result,provenance:{kind:'explicit-tool-bridge',...execution.request,timing:execution.timing}};
    }
  });
}

export function createSandboxContainerExecutionProvider({fetchImpl=globalThis.fetch}={}){
  if(typeof fetchImpl!=='function')throw new TypeError('sandbox execution provider requires fetch');
  const requestFetch=(...args)=>fetchImpl(...args);
  return createExecutionProvider({
    id:'sandbox-container',
    label:'Governed local Linux container',
    location:'loopback-sandbox-daemon',
    cellTypes:['container'],
    capabilities:{container:true,loopbackOnly:true,hostFilesystem:false,network:'policy-gated',privileged:false},
    execute:async(cell,context)=>{
      const endpoint=normalizeSandboxEndpoint(cell?.config?.endpoint||DEFAULT_SANDBOX_ENDPOINT);
      const request=createSandboxRequest({
        source:cell.source,
        parameters:context?.parameters??{},
        requestId:`workbench-${cell.id}-${Date.now()}`,
        interpolate:interpolateText
      });
      const timeoutMs=Math.max(5000,Math.min(125000,Number(request.limits?.timeoutMs)||30000)+5000);
      const controller=new AbortController();const timer=setTimeout(()=>controller.abort(),timeoutMs);
      try{
        const response=await requestFetch(endpoint,{
          method:'POST',
          cache:'no-store',
          credentials:'omit',
          headers:{'Content-Type':'application/json','Accept':'application/json'},
          body:JSON.stringify(request),
          signal:controller.signal
        });
        const type=response.headers.get('content-type')||'';
        const payload=type.includes('application/json')?await response.json():{message:(await response.text()).slice(0,1000)};
        if(!response.ok)throw new Error(`Sandbox daemon HTTP ${response.status}: ${payload?.message??payload?.error??'request failed'}`);
        if(payload?.format!==SANDBOX_RESULT_FORMAT)throw new Error('Sandbox daemon returned an unexpected result format');
        return {
          output:payload,
          provenance:{
            kind:'local-container-sandbox',
            endpoint,
            requestId:payload.requestId??request.requestId,
            image:payload.execution?.image??request.image,
            network:payload.execution?.network??request.network,
            limits:payload.execution?.limits??request.limits,
            sandboxStatus:payload.status,
            exitCode:payload.exitCode,
            policy:payload.policy??null
          }
        };
      }catch(error){
        if(error?.name==='AbortError')throw new Error(`Sandbox daemon request timed out after ${timeoutMs} ms`);
        throw error;
      }finally{clearTimeout(timer)}
    }
  });
}

export function createDefaultWorkbenchExecutionRouter(){
  const router=createExecutionRouter();
  router.register(createBrowserJavaScriptExecutionProvider());
  router.register(createBrowserPythonExecutionProvider());
  router.register(createHttpToolExecutionProvider());
  router.register(createSandboxContainerExecutionProvider());
  return router;
}
