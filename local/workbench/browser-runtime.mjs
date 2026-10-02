import {detectBrowserAICapabilities,chooseBrowserExecution} from '../../runtime/models/browser-capabilities.mjs';
import {getCompactModel} from '../../runtime/models/compact-models.mjs';
import {createBrowserTransformersHost} from '../../runtime/models/browser-transformers-host.mjs';
import {createBrowserTransformersCognitiveModel} from '../../runtime/models/browser-cognitive-model.mjs';
import {createBrowserLocalInferenceProvider} from '../../runtime/models/browser-provider.mjs';

export async function loadBrowserProvider({modelId,onProgress=()=>{}}={}){
  const manifest=getCompactModel(modelId);
  if(!manifest)throw new Error('Select a browser model.');
  const capabilities=await detectBrowserAICapabilities();
  const execution=chooseBrowserExecution(capabilities,{prefer:'webgpu'});
  const host=createBrowserTransformersHost({manifest,device:execution.device,dtype:execution.dtype,onProgress});
  const model=createBrowserTransformersCognitiveModel({host});
  await model.load();
  const provider=createBrowserLocalInferenceProvider({model,label:manifest.label});
  await provider.connect();
  return {provider,host,manifest,execution,capabilities};
}
