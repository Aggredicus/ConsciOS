import {assertValidModelManifest} from './model-manifest-validation.mjs';

export const COMPACT_MODELS=Object.freeze([
  Object.freeze({
    id:'smollm2-135m-instruct',label:'SmolLM2 135M · fastest',
    task:'text-generation',source:'hub',model:'onnx-community/SmolLM2-135M-Instruct-ONNX',
    revision:'b8a5c0f183b78c55955a5364f610c36668b5e681',webgpuDtype:'q4f16',wasmDtype:'q4',
    maxContextTokens:8192,defaultMaxNewTokens:192,remoteDownloadAllowed:true,
    approximatePrimaryWeightMB:{webgpu:117,wasm:181},
    provenance:{library:'@huggingface/transformers',libraryVersion:'4.3.0',format:'ONNX'},
    license:{name:'Apache-2.0',modelFamily:'SmolLM2'}
  }),
  Object.freeze({
    id:'qwen3-0.6b',label:'Qwen3 0.6B · stronger',
    task:'text-generation',source:'hub',model:'onnx-community/Qwen3-0.6B-ONNX',
    revision:'5587500',webgpuDtype:'q4f16',wasmDtype:'q4',
    maxContextTokens:40960,defaultMaxNewTokens:256,remoteDownloadAllowed:true,
    approximatePrimaryWeightMB:{webgpu:570,wasm:919},
    provenance:{library:'@huggingface/transformers',libraryVersion:'4.3.0',format:'ONNX'},
    license:{name:'See model repository',modelFamily:'Qwen3'}
  })
]);
for(const model of COMPACT_MODELS)assertValidModelManifest(model);
export const getCompactModel=id=>COMPACT_MODELS.find(model=>model.id===id)||null;
