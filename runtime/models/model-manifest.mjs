import {assertValidModelManifest,validateModelManifest} from './model-manifest-validation.mjs';
export {assertValidModelManifest,validateModelManifest} from './model-manifest-validation.mjs';

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
    id:'smollm2-360m-instruct',
    label:'SmolLM2 360M Instruct — lightweight reactive',
    task:'text-generation',
    source:'hub',
    model:'onnx-community/SmolLM2-360M-Instruct-ONNX',
    revision:'fe7c7db4c8921c9e3fa1c65cfd296fb3b1b1a8f9',
    webgpuDtype:'q4f16',
    wasmDtype:'q4',
    maxContextTokens:8192,
    defaultMaxNewTokens:192,
    remoteDownloadAllowed:true,
    approximatePrimaryWeightMB:{webgpu:272,wasm:386},
    provenance:{library:'@huggingface/transformers',libraryVersion:'4.3.0',format:'ONNX'},
    license:{name:'Apache-2.0',modelFamily:'SmolLM2'},
    notes:'Intermediate instruction-tuned browser model used for reactive E2E validation when the 135M starter is too weak for reliable instruction following.'
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
  }),
  Object.freeze({
    id:'gemma-3-1b-it',
    label:'Gemma 3 1B IT — cross-family control',
    task:'text-generation',source:'hub',model:'onnx-community/gemma-3-1b-it-ONNX',revision:'a58439f',
    webgpuDtype:'q4f16',wasmDtype:'q4',maxContextTokens:32768,defaultMaxNewTokens:256,remoteDownloadAllowed:true,
    approximatePrimaryWeightMB:{webgpu:763,wasm:859},
    provenance:{library:'@huggingface/transformers',libraryVersion:'4.3.0',format:'ONNX'},
    license:{name:'Gemma',modelFamily:'Gemma 3'},
    notes:'Compact Google-family instruction model for cross-family comparison.'
  }),
  Object.freeze({
    id:'llama-3.2-1b-instruct',
    label:'Llama 3.2 1B Instruct — cross-family control',
    task:'text-generation',source:'hub',model:'onnx-community/Llama-3.2-1B-Instruct-ONNX',revision:'1400754',
    webgpuDtype:'q4f16',wasmDtype:'q4',maxContextTokens:131072,defaultMaxNewTokens:256,remoteDownloadAllowed:true,
    approximatePrimaryWeightMB:{webgpu:1090,wasm:1690},
    provenance:{library:'@huggingface/transformers',libraryVersion:'4.3.0',format:'ONNX'},
    license:{name:'Llama 3.2 Community License',modelFamily:'Llama 3.2'},
    notes:'Independent Meta-family instruction model; useful for separating architecture effects from Qwen-specific behavior.'
  }),
  Object.freeze({
    id:'llama-3.2-1b-base',
    label:'Llama 3.2 1B Base — non-instruct control',
    task:'text-generation',source:'hub',model:'onnx-community/Llama-3.2-1B',revision:'fa71d56',
    webgpuDtype:'q4f16',wasmDtype:'q4',maxContextTokens:131072,defaultMaxNewTokens:256,remoteDownloadAllowed:true,
    approximatePrimaryWeightMB:{webgpu:1070,wasm:1660},
    provenance:{library:'@huggingface/transformers',libraryVersion:'4.3.0',format:'ONNX'},
    license:{name:'Llama 3.2 Community License',modelFamily:'Llama 3.2'},
    notes:'Base-model control with less assistant-style instruction tuning. Its behavior under chat-shaped state input is intentionally experimental.'
  }),
  Object.freeze({
    id:'qwen3-1.7b',
    label:'Qwen3 1.7B — scale comparison',
    task:'text-generation',source:'hub',model:'onnx-community/Qwen3-1.7B-ONNX',revision:'e1da89f',
    webgpuDtype:'q4f16',wasmDtype:'q4',maxContextTokens:40960,defaultMaxNewTokens:384,remoteDownloadAllowed:true,
    approximatePrimaryWeightMB:{webgpu:1430,wasm:2150},
    provenance:{library:'@huggingface/transformers',libraryVersion:'4.3.0',format:'ONNX'},
    license:{name:'See model repository',modelFamily:'Qwen3'},
    notes:'Larger Qwen-family condition for capacity comparisons while keeping model lineage relatively constant.'
  })
]);

for(const manifest of STARTER_MODELS)assertValidModelManifest(manifest);

export function getStarterModel(id){return STARTER_MODELS.find(model=>model.id===id)||null}
