import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createBrowserTransformersHost,serializeDeclaredContext,TRANSFORMERS_JS_BROWSER_URL,TRANSFORMERS_JS_VERSION } from '../../../runtime/models/browser-transformers-host.mjs';
import { getStarterModel } from '../../../runtime/models/model-manifest.mjs';

assert.equal(TRANSFORMERS_JS_VERSION,'4.3.0');
assert.ok(TRANSFORMERS_JS_BROWSER_URL.includes('@huggingface/transformers@4.3.0'));
const manifest=getStarterModel('smollm2-135m-instruct');
assert.equal(manifest.model,'onnx-community/SmolLM2-135M-Instruct-ONNX');
assert.ok(manifest.approximatePrimaryWeightMB.webgpu<200);

const visible={artifactId:'visible',epistemicStatus:'inference',content:'VISIBLE_CONTEXT_7F3A'};
const hidden={artifactId:'hidden',epistemicStatus:'inference',content:'HIDDEN_CONTEXT_91C2'};
assert.deepEqual(serializeDeclaredContext([visible]),[visible]);

let pipelineArgs=null;let generationInput=null;let generationOptions=null;
class FakeStreamer{constructor(_tokenizer,options){this.options=options}}
class FakeStopping{interrupt(){this.interrupted=true}}
const fakeGenerator=async(input,options)=>{
  generationInput=input;generationOptions=options;
  options.streamer?.options?.callback_function?.('local ');
  options.streamer?.options?.callback_function?.('generation');
  return [{generated_text:[...input,{role:'assistant',content:'local generation'}]}];
};
fakeGenerator.tokenizer={};
const fakeModule={
  TextStreamer:FakeStreamer,InterruptableStoppingCriteria:FakeStopping,
  pipeline:async(...args)=>{pipelineArgs=args;args[2].progress_callback({status:'progress',progress:50});return fakeGenerator}
};
const progress=[];
const host=createBrowserTransformersHost({manifest,device:'webgpu',importTransformers:async url=>{assert.equal(url,TRANSFORMERS_JS_BROWSER_URL);return fakeModule},onProgress:event=>progress.push(event)});
assert.equal(host.state,'idle');
const loaded=await host.load();
assert.equal(host.state,'ready');
assert.equal(pipelineArgs[0],'text-generation');assert.equal(pipelineArgs[1],manifest.model);
assert.equal(pipelineArgs[2].device,'webgpu');assert.equal(pipelineArgs[2].dtype,'q4f16');
assert.equal(loaded.remoteInference,false);assert.equal(loaded.inferenceLocation,'browser-local');
assert.equal(progress.length,1);

const chunks=[];
const result=await host.generate({userText:'Which marker is declared?',contextManifest:[visible],onText:t=>chunks.push(t),maxNewTokens:32});
assert.equal(result.status,'ok');assert.equal(result.text,'local generation');assert.deepEqual(chunks,['local ','generation']);
assert.deepEqual(result.contextArtifactIds,['visible']);
const serialized=JSON.stringify(generationInput);
assert.ok(serialized.includes('VISIBLE_CONTEXT_7F3A'));assert.ok(!serialized.includes(hidden.content),'hidden context leaked into model input');
assert.equal(generationOptions.max_new_tokens,32);assert.equal(generationOptions.do_sample,false);
assert.equal(result.provenance.remoteInference,false);assert.equal(result.provenance.device,'webgpu');

const source=readFileSync('runtime/models/browser-transformers-host.mjs','utf8');
for(const forbidden of ['api.openai.com','api.anthropic.com','generativelanguage.googleapis.com','process.env','API_KEY','apiKey'])assert.ok(!source.includes(forbidden),`browser host contains forbidden remote/credential capability: ${forbidden}`);
const expression=readFileSync('cognition/expression/v0.mjs','utf8');
assert.ok(!expression.includes('browser-transformers-host')&&!expression.includes('.generate('),'Expression gained direct browser model access');

console.log('ConsciOS browser AI host contract verification passed: pinned local runtime, explicit declared context, streaming, provenance, and no proprietary inference fallback. Real WebGPU/WASM execution remains a physical-browser acceptance test.');
