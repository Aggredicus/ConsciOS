import assert from 'node:assert/strict';
import {createExoInferenceProvider} from '../../../runtime/models/exo-provider.mjs';
import {normalizeHttpEndpoint} from '../../../runtime/models/inference-provider.mjs';
import {createInferenceProviderRouter} from '../../../runtime/models/provider-router.mjs';
import {validateCognitiveModelOutput} from '../../../runtime/models/validation.mjs';

const input={requestId:'exo-provider-001',requestingModule:'ObserverScientist',inferenceType:'engineering-conversation',contextManifest:[{artifactId:'observation-1',epistemicStatus:'observation',content:{userText:'Summarize the declared observation only.'}}],causalSourceIds:['observation-1'],maxResponseUnits:64,expectedEpistemicStatus:'inference',hiddenContextPolicy:'none'};

assert.equal(normalizeHttpEndpoint('http://192.168.1.4:52415/'),'http://192.168.1.4:52415');
assert.throws(()=>normalizeHttpEndpoint('file:///tmp/exo'),/http or https/);
assert.throws(()=>normalizeHttpEndpoint('javascript:alert(1)'),/http or https/);

const requests=[];
const fetchImpl=async (url,options={})=>{
  requests.push({url,options});
  if(url.endsWith('/state'))return new Response(JSON.stringify({instances:{'instance-a':{}},tasks:{},nodeIdentities:{'node-a':{},'node-b':{}},lastEventAppliedIdx:17}),{status:200,headers:{'Content-Type':'application/json'}});
  if(url.endsWith('/v1/models')&&(!options.method||options.method==='GET'))return new Response(JSON.stringify({data:[{id:'mlx-community/Qwen3-test'}]}),{status:200,headers:{'Content-Type':'application/json'}});
  if(url.endsWith('/v1/chat/completions')){
    const body=JSON.parse(options.body);
    assert.equal(body.model,'mlx-community/Qwen3-test');
    assert.equal(body.temperature,0);
    assert.equal(body.messages.length,2);
    assert.match(body.messages[1].content,/observation-1/);
    assert.ok(!body.messages[1].content.includes('undeclared-secret'));
    return new Response(JSON.stringify({choices:[{message:{content:'Only the declared observation was available.'}}]}),{status:200,headers:{'Content-Type':'application/json'}});
  }
  return new Response('not found',{status:404});
};

const exo=createExoInferenceProvider({endpoint:'http://192.168.1.4:52415',fetchImpl});
const capabilities=await exo.connect();
assert.equal(capabilities.cluster.nodeCount,2);
assert.deepEqual(capabilities.models,['mlx-community/Qwen3-test']);
assert.equal(exo.modelId,'mlx-community/Qwen3-test','single discovered model should be selected explicitly by deterministic rule');

const output=await exo.infer(input);
assert.equal(output.status,'ok');
assert.equal(output.provider.kind,'exo-cluster');
assert.equal(output.provider.remoteInference,true);
assert.equal(output.provider.inferenceLocation,'lan-cluster');
assert.deepEqual(output.causalSourceIds,input.causalSourceIds);
assert.deepEqual(output.content.accessibleArtifactIds,['observation-1']);
assert.equal(validateCognitiveModelOutput(output).valid,true);

const router=createInferenceProviderRouter();
router.register(exo);
assert.rejects(()=>router.connectSelected(),/no inference provider selected/);
router.select('exo');
assert.equal((await router.connectSelected()).status,'ready');
assert.equal(router.current(),exo);
assert.equal(requests.some(request=>request.url.endsWith('/v1/chat/completions')),true);

const failing=createExoInferenceProvider({endpoint:'http://offline.local:52415',modelId:'model-a',fetchImpl:async()=>new Response('offline',{status:503})});
const failed=await failing.infer(input);
assert.equal(failed.status,'error');
assert.equal(failed.confidence,0);
assert.match(failed.failure,/HTTP 503/);
assert.equal(failed.provider.kind,'exo-cluster');

console.log('Provider abstraction verification passed: explicit exo boundary, declared context only, no silent fallback.');
