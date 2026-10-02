import assert from 'node:assert/strict';
import {createExoInferenceProvider} from '../../../runtime/models/exo-provider.mjs';
import {normalizeHttpEndpoint} from '../../../runtime/models/inference-provider.mjs';
import {createInferenceProviderRouter} from '../../../runtime/models/provider-router.mjs';
import {validateCognitiveModelInput,validateCognitiveModelOutput} from '../../../runtime/models/validation.mjs';

const input={requestId:'exo-provider-001',requestingModule:'ObserverScientist',inferenceType:'engineering-conversation',contextManifest:[{artifactId:'observation-1',epistemicStatus:'observation',content:{userText:'Summarize the declared observation only.'}}],causalSourceIds:['observation-1'],maxResponseUnits:64,expectedEpistemicStatus:'inference',hiddenContextPolicy:'none'};

assert.equal(normalizeHttpEndpoint('http://192.168.1.4:52415/'),'http://192.168.1.4:52415');
assert.throws(()=>normalizeHttpEndpoint('file:///tmp/exo'),/http or https/);
assert.throws(()=>normalizeHttpEndpoint('javascript:alert(1)'),/http or https/);

const requests=[];
let placed=false;
const fetchImpl=async (url,options={})=>{
  requests.push({url,options});
  if(url.endsWith('/state'))return new Response(JSON.stringify({instances:placed?{'instance-a':{MlxRingInstance:{shardAssignments:{modelId:'mlx-community/Qwen3-test'}}}}:{},tasks:{},nodeIdentities:{'node-a':{},'node-b':{}},lastEventAppliedIdx:17}),{status:200,headers:{'Content-Type':'application/json'}});
  if(url.includes('/v1/models?status=downloaded')&&(!options.method||options.method==='GET'))return new Response(JSON.stringify({data:[{id:'mlx-community/Qwen3-test'}]}),{status:200,headers:{'Content-Type':'application/json'}});
  if(url.endsWith('/place_instance')&&options.method==='POST'){
    const body=JSON.parse(options.body);
    assert.equal(body.model_id,'mlx-community/Qwen3-test');
    placed=true;
    return new Response(JSON.stringify({message:'Command received.',command_id:'place-1'}),{status:200,headers:{'Content-Type':'application/json'}});
  }
  if(url.includes('/instance/await?model_id=')){
    const ready=placed;
    return new Response(`data: ${JSON.stringify(ready?{type:'ready',instance:{}}:{type:'timeout',message:'not ready'})}\n\n`,{status:200,headers:{'Content-Type':'text/event-stream'}});
  }
  if(url.endsWith('/v1/chat/completions')){
    const body=JSON.parse(options.body);
    assert.equal(body.model,'mlx-community/Qwen3-test');
    assert.equal(body.temperature,0);
    const last=body.messages.at(-1)?.content||'';
    if(body.stream)return new Response([
      'data: '+JSON.stringify({choices:[{delta:{role:'assistant',content:'cedar-'}}]})+'\n\n',
      'data: '+JSON.stringify({choices:[{delta:{content:'42'},finish_reason:'stop'}]})+'\n\n',
      'data: [DONE]\n\n'
    ].join(''),{status:200,headers:{'Content-Type':'text/event-stream'}});
    return new Response(JSON.stringify({choices:[{message:{content:last.includes('call sign')?'cedar-42':'Only the declared observation was available.'}}]}),{status:200,headers:{'Content-Type':'application/json'}});
  }
  return new Response('not found',{status:404});
};

const exo=createExoInferenceProvider({endpoint:'http://192.168.1.4:52415',fetchImpl});
const capabilities=await exo.connect();
assert.equal(capabilities.cluster.nodeCount,2);
assert.deepEqual(capabilities.models,['mlx-community/Qwen3-test']);
assert.deepEqual(capabilities.downloadedModels,['mlx-community/Qwen3-test']);
assert.deepEqual(capabilities.activeModels,[]);
assert.equal(exo.modelId,'mlx-community/Qwen3-test','single downloaded model should be selected explicitly by deterministic rule');

const output=await exo.infer(input);
assert.equal(output.status,'ok');
assert.equal(output.provider.kind,'exo-cluster');
assert.equal(output.provider.remoteInference,true);
assert.equal(output.provider.inferenceLocation,'lan-cluster');
assert.deepEqual(output.causalSourceIds,input.causalSourceIds);
assert.deepEqual(output.content.accessibleArtifactIds,['observation-1']);
assert.equal(validateCognitiveModelOutput(output).valid,true);
assert.ok(requests.some(request=>request.url.endsWith('/place_instance')),'first inference should place a downloaded model when no active instance exists');
assert.ok(requests.some(request=>request.url.includes('/instance/await?model_id=')),'provider should wait until exo reports the placed instance ready');
const oneShotBody=JSON.parse(requests.find(request=>request.url.endsWith('/v1/chat/completions')).options.body);
assert.equal(oneShotBody.messages.length,2);
assert.match(oneShotBody.messages[1].content,/observation-1/);
assert.ok(!oneShotBody.messages[1].content.includes('undeclared-secret'));

const placementCountAfterFirst=requests.filter(request=>request.url.endsWith('/place_instance')).length;
const conversationMessages=[{role:'user',content:'My temporary call sign is cedar-42.'},{role:'assistant',content:'Got it. What are you working on?'},{role:'user',content:'What call sign did I give you?'}];
const conversationInput={...input,requestId:'exo-conversation-001',inferenceType:'conversation-turn',conversationMessages};
assert.equal(validateCognitiveModelInput(conversationInput).valid,true);
assert.equal(validateCognitiveModelInput({...conversationInput,conversationMessages:[{role:'assistant',content:'invalid first role'}]}).valid,false);
assert.equal(validateCognitiveModelInput({...conversationInput,conversationMessages:[{role:'user',content:'a'},{role:'user',content:'b'}]}).valid,false);
assert.equal(validateCognitiveModelInput({...conversationInput,conversationMessages:[{role:'user',content:'a'},{role:'assistant',content:'b'}]}).valid,false);
assert.equal(validateCognitiveModelInput({...conversationInput,conversationMessages:[{role:'system',content:'hidden'}]}).valid,false);
const conversationOutput=await exo.infer(conversationInput);
assert.equal(conversationOutput.status,'ok');
assert.equal(conversationOutput.content.text,'cedar-42');
assert.equal(conversationOutput.content.conversationMessageCount,3);
assert.equal(requests.filter(request=>request.url.endsWith('/place_instance')).length,placementCountAfterFirst,'ready model instance should be reused rather than duplicated');
const conversationBody=JSON.parse(requests.filter(request=>request.url.endsWith('/v1/chat/completions')).at(-1).options.body);
assert.deepEqual(conversationBody.messages.slice(-3).map(message=>message.role),['user','assistant','user']);
assert.equal(conversationBody.messages.at(-1).content,'What call sign did I give you?');
const streamedChunks=[];const streamedOutput=await exo.infer({...conversationInput,requestId:'exo-stream-001'},{onText:chunk=>streamedChunks.push(chunk)});assert.equal(streamedOutput.status,'ok');assert.equal(streamedOutput.content.text,'cedar-42');assert.deepEqual(streamedChunks,['cedar-','42']);assert.equal(streamedOutput.timing.streamed,true);assert.equal(streamedOutput.timing.finishReason,'stop');assert.ok(streamedOutput.timing.ttftMs!==null);const streamedBody=JSON.parse(requests.filter(request=>request.url.endsWith('/v1/chat/completions')).at(-1).options.body);assert.equal(streamedBody.stream,true);assert.match(streamedBody.messages[0].content,/\/no_think/,'Qwen3 exo chat should suppress thinking output');

const router=createInferenceProviderRouter();
router.register(exo);
assert.rejects(()=>router.connectSelected(),/no inference provider selected/);
router.select('exo');
assert.equal((await router.connectSelected()).status,'ready');
assert.equal(router.current(),exo);

const failing=createExoInferenceProvider({endpoint:'http://offline.local:52415',modelId:'model-a',fetchImpl:async()=>new Response('offline',{status:503})});
const failed=await failing.infer(input);
assert.equal(failed.status,'error');
assert.equal(failed.confidence,0);
assert.match(failed.failure,/HTTP 503/);
assert.equal(failed.provider.kind,'exo-cluster');

console.log('Provider abstraction verification passed: explicit exo boundary, downloaded-model discovery, automatic instance placement, true alternating conversation history, declared context only, no silent fallback.');
