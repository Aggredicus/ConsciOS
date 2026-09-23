const TASKS=new Set(['text-generation']);
const SOURCES=new Set(['hub','local']);
const DTYPES=new Set(['fp32','fp16','q8','q4','q4f16','int8','uint8','bnb4']);

function nonEmpty(value){return typeof value==='string'&&value.trim().length>0}
function integer(value,min,max){return Number.isInteger(value)&&value>=min&&value<=max}

export function validateModelManifest(manifest){
  const errors=[];
  if(!manifest||typeof manifest!=='object'||Array.isArray(manifest))return {valid:false,errors:['manifest must be an object']};
  if(!nonEmpty(manifest.id))errors.push('id is required');
  if(!nonEmpty(manifest.label))errors.push('label is required');
  if(!TASKS.has(manifest.task))errors.push('unsupported task');
  if(!SOURCES.has(manifest.source))errors.push('source must be hub or local');
  if(!nonEmpty(manifest.model))errors.push('model is required');
  if(!DTYPES.has(manifest.webgpuDtype))errors.push('webgpuDtype is invalid');
  if(!DTYPES.has(manifest.wasmDtype))errors.push('wasmDtype is invalid');
  if(!integer(manifest.maxContextTokens,128,131072))errors.push('maxContextTokens is invalid');
  if(!integer(manifest.defaultMaxNewTokens,1,4096))errors.push('defaultMaxNewTokens is invalid');
  if(!manifest.provenance||!nonEmpty(manifest.provenance.library)||!nonEmpty(manifest.provenance.libraryVersion))errors.push('provenance library metadata is required');
  if(!manifest.license||!nonEmpty(manifest.license.name))errors.push('license metadata is required');
  if(manifest.source==='local'&&!nonEmpty(manifest.localModelPath))errors.push('local source requires localModelPath');
  return {valid:errors.length===0,errors};
}

export function assertValidModelManifest(manifest){
  const result=validateModelManifest(manifest);
  if(!result.valid)throw new TypeError(`Invalid model manifest: ${result.errors.join('; ')}`);
  return manifest;
}

export const STARTER_MODELS=Object.freeze([
  Object.freeze({
    id:'smollm2-135m-instruct',
    label:'SmolLM2 135M Instruct — starter',
    task:'text-generation',
    source:'hub',
    model:'onnx-community/SmolLM2-135M-Instruct-ONNX',
    revision:'b8a5c0f183b78c55955a5364f610c36668b5e681',
    webgpuDtype:'q4f16',
    wasmDtype:'q4',
    maxContextTokens:8192,
    defaultMaxNewTokens:192,
    remoteDownloadAllowed:true,
    approximatePrimaryWeightMB:{webgpu:117,wasm:181},
    provenance:{library:'@huggingface/transformers',libraryVersion:'4.3.0',format:'ONNX'},
    license:{name:'Apache-2.0',modelFamily:'SmolLM2'},
    notes:'Small instruction-tuned starter chosen for browser feasibility. Model quality is intentionally secondary to proving real local inference.'
  }),
  Object.freeze({
    id:'qwen3-0.6b',
    label:'Qwen3 0.6B — higher capability',
    task:'text-generation',
    source:'hub',
    model:'onnx-community/Qwen3-0.6B-ONNX',
    revision:'5587500',
    webgpuDtype:'q4f16',
    wasmDtype:'q4',
    maxContextTokens:40960,
    defaultMaxNewTokens:256,
    remoteDownloadAllowed:true,
    approximatePrimaryWeightMB:{webgpu:570,wasm:919},
    provenance:{library:'@huggingface/transformers',libraryVersion:'4.3.0',format:'ONNX'},
    license:{name:'See model repository',modelFamily:'Qwen3'},
    notes:'Optional larger conversational model; use only on devices with sufficient memory.'
  })
]);

for(const manifest of STARTER_MODELS)assertValidModelManifest(manifest);

export function getStarterModel(id){return STARTER_MODELS.find(model=>model.id===id)||null}
