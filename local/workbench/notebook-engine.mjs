export const PYODIDE_VERSION='314.0.7';
export const PYODIDE_INDEX_URL=`https://cdn.jsdelivr.net/pyodide/v${PYODIDE_VERSION}/full/`;
export const STORAGE_KEY='conscios-cognitive-workbench-v1';
export const DEFAULT_CONTEXT_BUDGET_BYTES=32*1024;
export const DEFAULT_CONTEXT_RESULT_LIMIT=8;
export const DEFAULT_SANDBOX_ENDPOINT='http://127.0.0.1:7337/v1/execute';

export const CELL_TYPES=Object.freeze({
  markdown:{label:'Markdown / note',language:'text'},
  parameters:{label:'Parameters',language:'json'},
  ai:{label:'AI prompt',language:'text'},
  conversation:{label:'Conversation',language:'text'},
  'conversation-test':{label:'Conversation Reality Test',language:'text'},
  javascript:{label:'JavaScript',language:'javascript'},
  python:{label:'Python',language:'python'},
  shell:{label:'Linux shell · sandbox',language:'shell'},
  container:{label:'Container job · sandbox',language:'json'},
  topology:{label:'Multi-service topology · sandbox',language:'json'},
  procedure:{label:'Tool procedure',language:'json'},
  'world-inspect':{label:'World / selection inspect',language:'json'},
  'property-inspector':{label:'Property inspector',language:'json'},
  'node-graph':{label:'Node graph',language:'json'},
  'spatial-prompt':{label:'Spatial prompt',language:'json'},
  playtest:{label:'Playtest / check',language:'json'},
  macro:{label:'Notebook macro',language:'json'}
});

const DEFAULT_SOURCE={
  markdown:'# Cognitive Workbench\nInterleave notes, AI, executable code, parameters, bounded context, and explicit tool calls. Every AI cell records its provider.',
  parameters:'{\n  "project": "ConsciOS",\n  "scale": 1\n}',
  ai:'Use the declared notebook context only. Propose the next concrete step.',
  conversation:'Hello. Let’s have an actual conversation.',
  'conversation-test':'Paired randomized stateful-vs-stateless test. Press “Run paired test” with a neural provider selected.',
  javascript:'const value = Number(context.parameters.scale ?? 1);\nreturn {scaled: value * 2, project: context.parameters.project};',
  python:'project = context.get("project", "ConsciOS")\nscale = context.get("scale", 1)\n{"project": project, "scaled": scale * 2}',
  shell:'uname -a\ncat /etc/os-release',
  container:'{\n  "image": "ubuntu:24.04",\n  "profile": "strict",\n  "command": ["bash", "-lc", "uname -a && cat /etc/os-release"],\n  "network": "none",\n  "limits": {"memoryMb": 512, "cpus": 1, "pids": 256},\n  "timeoutMs": 60000\n}',
  topology:'{\n  "services": [\n    {"name":"api","image":"python:3.12-alpine","profile":"strict","files":[{"path":"health","content":"pong\\n"}],"command":["python","-m","http.server","8080","--directory","/workspace"]}\n  ],\n  "tests": [\n    {"name":"probe","image":"alpine:3.20","profile":"strict","command":["sh","-lc","for i in 1 2 3 4 5; do wget -qO- http://api:8080/health && exit 0; sleep 1; done; exit 1"]}\n  ],\n  "internet": false,\n  "settleMs": 250\n}',
  procedure:'{\n  "procedure": "describe-scene",\n  "arguments": {}\n}',
  'world-inspect':'{\n  "scope": "selection",\n  "include": ["name", "transform", "bounds"]\n}',
  'property-inspector':'{\n  "target": "selection",\n  "properties": ["transform"]\n}',
  'node-graph':'{\n  "graph": "selection",\n  "depth": 2\n}',
  'spatial-prompt':'{\n  "instruction": "Place the selected asset at the declared coordinates",\n  "position": [0, 0, 0]\n}',
  playtest:'{\n  "mode": "play",\n  "durationSeconds": 10,\n  "checks": []\n}',
  macro:'[]'
};

const DEFAULT_ACTION={shell:'sandbox-run',container:'sandbox-run',topology:'sandbox-topology',procedure:'run-procedure','world-inspect':'inspect-world','property-inspector':'inspect-properties','node-graph':'inspect-node-graph','spatial-prompt':'spatial-prompt',playtest:'playtest'};
const SANDBOX_TYPES=new Set(['shell','container','topology']);

function id(prefix='cell'){return `${prefix}-${crypto.randomUUID?.()??`${Date.now()}-${Math.random().toString(16).slice(2)}`}`}
export function createCell(type='markdown',options={}){
  if(!CELL_TYPES[type])throw new TypeError(`unsupported cell type '${type}'`);
  const conversational=type==='conversation'||type==='conversation-test',sandbox=SANDBOX_TYPES.has(type);
  return {
    id:id(),type,title:options.title??CELL_TYPES[type].label,source:options.source??DEFAULT_SOURCE[type]??'',
    config:{includePrevious:false,maxResponseUnits:conversational?512:256,contextBudgetBytes:DEFAULT_CONTEXT_BUDGET_BYTES,contextResultLimit:DEFAULT_CONTEXT_RESULT_LIMIT,endpoint:sandbox?DEFAULT_SANDBOX_ENDPOINT:'',method:'POST',action:DEFAULT_ACTION[type]??'',...(options.config??{})},
    output:null,provenance:null,status:'idle',updatedAt:new Date().toISOString()
  };
}

export function createNotebook({title='Untitled Cognitive Notebook'}={}){
  return {format:'conscios-notebook/v1',id:id('notebook'),title,createdAt:new Date().toISOString(),updatedAt:new Date().toISOString(),cells:[createCell('markdown'),createCell('parameters'),createCell('ai')]};
}

export function validateNotebook(value){
  if(!value||value.format!=='conscios-notebook/v1'||!Array.isArray(value.cells))throw new TypeError('notebook is not conscios-notebook/v1');
  const ids=new Set();
  for(const cell of value.cells){
    if(!cell||typeof cell.id!=='string'||!CELL_TYPES[cell.type]||typeof cell.source!=='string')throw new TypeError('notebook contains an invalid cell');
    if(ids.has(cell.id))throw new TypeError(`duplicate cell id '${cell.id}'`);ids.add(cell.id);
    cell.config={includePrevious:false,maxResponseUnits:(cell.type==='conversation'||cell.type==='conversation-test')?512:256,contextBudgetBytes:DEFAULT_CONTEXT_BUDGET_BYTES,contextResultLimit:DEFAULT_CONTEXT_RESULT_LIMIT,endpoint:SANDBOX_TYPES.has(cell.type)?DEFAULT_SANDBOX_ENDPOINT:'',method:'POST',action:DEFAULT_ACTION[cell.type]??'',...(cell.config??{})};
  }
  return value;
}

export function saveNotebook(notebook,storage=localStorage){validateNotebook(notebook);notebook.updatedAt=new Date().toISOString();storage.setItem(STORAGE_KEY,JSON.stringify(notebook));return notebook}
export function loadNotebook(storage=localStorage){const raw=storage.getItem(STORAGE_KEY);if(!raw)return null;return validateNotebook(JSON.parse(raw))}
export function cloneCell(cell){const copy=structuredClone(cell);copy.id=id();copy.title=`${cell.title} copy`;copy.status='idle';copy.updatedAt=new Date().toISOString();return copy}

export function interpolateText(text,parameters={}){
  return String(text).replace(/\{\{\s*([A-Za-z0-9_.-]+)\s*\}\}/g,(_,path)=>{
    let value=parameters;for(const segment of path.split('.'))value=value?.[segment];
    return value==null?'':typeof value==='object'?JSON.stringify(value):String(value);
  });
}

export function parseParameters(source){
  const value=JSON.parse(source||'{}');
  if(!value||Array.isArray(value)||typeof value!=='object')throw new TypeError('parameter cell must contain a JSON object');
  return value;
}

export function rebuildParameterContext(notebook){
  const parameters={};
  for(const cell of notebook.cells){if(cell.type==='parameters'){try{Object.assign(parameters,parseParameters(cell.source))}catch{}}}
  return parameters;
}

function serializable(value){
  if(value===undefined)return null;
  try{return structuredClone(value)}catch{}
  try{return JSON.parse(JSON.stringify(value))}catch{return String(value)}
}

export function serializedBytes(value){try{return new TextEncoder().encode(JSON.stringify(value)).byteLength}catch{return String(value).length}}

export function previousCellResults(notebook,index,{maxBytes=DEFAULT_CONTEXT_BUDGET_BYTES,maxCells=DEFAULT_CONTEXT_RESULT_LIMIT}={}){
  const candidates=notebook.cells.slice(0,index).filter(cell=>cell.output!==null);const selected=[];let bytes=0;
  for(let i=candidates.length-1;i>=0&&selected.length<Math.max(0,Number(maxCells)||0);i--){
    const cell=candidates[i],entry={cellId:cell.id,type:cell.type,title:cell.title,output:cell.output},cost=serializedBytes(entry);
    if(cost>maxBytes)continue;if(bytes+cost>maxBytes)continue;selected.push(entry);bytes+=cost;
  }
  return selected.reverse();
}

export function notebookContextMetrics(results,{budgetBytes=DEFAULT_CONTEXT_BUDGET_BYTES}={}){
  const selectedBytes=serializedBytes(results);return Object.freeze({selectedCells:results.length,selectedBytes,budgetBytes,withinBudget:selectedBytes<=budgetBytes});
}

export function executeJavaScript(source,context,{timeoutMs=30000}={}){
  return new Promise((resolve,reject)=>{
    const workerSource=`
      function clean(value){try{return structuredClone(value)}catch(e){try{return JSON.parse(JSON.stringify(value))}catch(e2){return String(value)}}}
      self.onmessage=async event=>{
        const logs=[];const proxy={log:(...x)=>logs.push(x.map(clean)),warn:(...x)=>logs.push(['WARN',...x.map(clean)]),error:(...x)=>logs.push(['ERROR',...x.map(clean)])};
        try{const AsyncFunction=Object.getPrototypeOf(async function(){}).constructor;const fn=new AsyncFunction('context','console','"use strict";\\n'+event.data.source);const result=await fn(event.data.context,proxy);self.postMessage({ok:true,result:clean(result),logs})}catch(error){self.postMessage({ok:false,error:String(error?.stack||error),logs})}
      };`;
    const url=URL.createObjectURL(new Blob([workerSource],{type:'text/javascript'}));const worker=new Worker(url);
    const timer=setTimeout(()=>{worker.terminate();URL.revokeObjectURL(url);reject(new Error(`JavaScript cell timed out after ${timeoutMs} ms`))},timeoutMs);
    worker.onmessage=event=>{clearTimeout(timer);worker.terminate();URL.revokeObjectURL(url);event.data.ok?resolve({result:serializable(event.data.result),logs:event.data.logs}):reject(new Error(event.data.error))};
    worker.onerror=event=>{clearTimeout(timer);worker.terminate();URL.revokeObjectURL(url);reject(new Error(event.message||'JavaScript worker failed'))};
    worker.postMessage({source,context:serializable(context)});
  });
}

let pyodidePromise=null;
export async function loadPythonRuntime(onStatus=()=>{}){
  if(pyodidePromise)return pyodidePromise;
  pyodidePromise=(async()=>{
    onStatus(`Loading Pyodide ${PYODIDE_VERSION} from jsDelivr…`);
    if(typeof globalThis.loadPyodide!=='function')await new Promise((resolve,reject)=>{const script=document.createElement('script');script.src=`${PYODIDE_INDEX_URL}pyodide.js`;script.onload=resolve;script.onerror=()=>reject(new Error('Unable to load Pyodide runtime'));document.head.append(script)});
    const runtime=await globalThis.loadPyodide({indexURL:PYODIDE_INDEX_URL});onStatus(`Python ready · Pyodide ${PYODIDE_VERSION}`);return runtime;
  })().catch(error=>{pyodidePromise=null;throw error});
  return pyodidePromise;
}

export async function executePython(source,context,{onStatus=()=>{}}={}){
  const pyodide=await loadPythonRuntime(onStatus);const stdout=[];const stderr=[];
  pyodide.setStdout({batched:text=>stdout.push(text)});pyodide.setStderr({batched:text=>stderr.push(text)});
  pyodide.globals.set('conscios_context_json',JSON.stringify(context?.parameters??{}));
  const prefix='import json\ncontext = json.loads(conscios_context_json)\n';
  const result=await pyodide.runPythonAsync(prefix+source);
  let converted=result;
  if(result&&typeof result.toJs==='function'){converted=result.toJs({create_pyproxies:false});result.destroy?.()}
  return {result:serializable(converted),stdout,stderr,runtime:{name:'Pyodide',version:PYODIDE_VERSION,indexURL:PYODIDE_INDEX_URL}};
}

function normalizeEndpoint(value){const url=new URL(value);if(url.protocol!=='http:'&&url.protocol!=='https:')throw new TypeError('tool endpoint must use http or https');if(url.username||url.password)throw new TypeError('tool endpoint must not contain embedded credentials');return url.toString().replace(/\/$/,'')}
export async function executeToolRequest(cell,context){
  const endpoint=normalizeEndpoint(interpolateText(cell.config.endpoint,context.parameters));
  const method=(cell.config.method||'POST').toUpperCase();const action=cell.config.action||DEFAULT_ACTION[cell.type]||cell.type;
  let payload;try{payload=JSON.parse(interpolateText(cell.source,context.parameters))}catch{payload={text:interpolateText(cell.source,context.parameters)}}
  const options={method,headers:{Accept:'application/json'}};
  if(method!=='GET'&&method!=='HEAD'){options.headers['Content-Type']='application/json';options.body=JSON.stringify({protocol:'conscios-tool/v1',action,payload})}
  const started=performance.now();const response=await fetch(endpoint,options);const contentType=response.headers.get('content-type')||'';const result=contentType.includes('json')?await response.json():await response.text();
  if(!response.ok)throw new Error(`Tool request failed with HTTP ${response.status}: ${typeof result==='string'?result.slice(0,300):JSON.stringify(result).slice(0,300)}`);
  return {result:serializable(result),timing:{elapsedMs:Math.max(0,performance.now()-started)},request:{endpoint,method,action}};
}
