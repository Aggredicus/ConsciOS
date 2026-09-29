import assert from 'node:assert/strict';
import {validateCognitiveModelInput} from '../../../runtime/models/validation.mjs';
import {createExoInferenceProvider} from '../../../runtime/models/exo-provider.mjs';

const base={requestId:'conversation-provider-001',requestingModule:'ObserverScientist',inferenceType:'conversation-turn',contextManifest:[{artifactId:'conversation-meta',epistemicStatus:'observation',content:{threadId:'test-thread',turn:2}}],causalSourceIds:['conversation-meta'],maxResponseUnits:128,expectedEpistemicStatus:'inference',hiddenContextPolicy:'none'};
const messages=[{role:'user',content:'My temporary call sign is cedar-42.'},{role:'assistant',content:'Got it. What are you working on?'},{role:'user',content:'What call sign did I give you?'}];
assert.equal(validateCognitiveModelInput({...base,conversationMessages:messages}).valid,true);
assert.equal(validateCognitiveModelInput({...base,conversationMessages:[{role:'assistant',content:'wrong first role'}]}).valid,false);
assert.equal(validateCognitiveModelInput({...base,conversationMessages:[{role:'user',content:'a'},{role:'user',content:'b'}]}).valid,false);
assert.equal(validateCognitiveModelInput({...base,conversationMessages:[{role:'user',content:'a'},{role:'assistant',content:'b'}]}).valid,false,'conversation must end on current user turn');
assert.equal(validateCognitiveModelInput({...base,conversationMessages:[{role:'system',content:'hidden'}]}).valid,false,'notebook may not inject system conversation messages');

let chatBody=null;
const fetchImpl=async(url,options={})=>{
  if(url.endsWith('/v1/chat/completions')){
    chatBody=JSON.parse(options.body);
    return new Response(JSON.stringify({choices:[{message:{content:'cedar-42'}}]}),{status:200,headers:{'Content-Type':'application/json'}});
  }
  throw new Error(`unexpected URL ${url}`);
};
const provider=createExoInferenceProvider({endpoint:'http://127.0.0.1:52415',modelId:'test-model',fetchImpl});
const output=await provider.infer({...base,conversationMessages:messages});
assert.equal(output.status,'ok');
assert.equal(output.content.text,'cedar-42');
assert.equal(output.content.conversationMessageCount,3);
assert.ok(chatBody);
assert.equal(chatBody.messages[0].role,'system');
assert.equal(chatBody.messages[1].role,'system','declared ConsciOS context should precede conversation turns');
assert.deepEqual(chatBody.messages.slice(2).map(message=>message.role),['user','assistant','user']);
assert.equal(chatBody.messages.at(-1).content,'What call sign did I give you?');
assert.ok(chatBody.messages.every(message=>message.content!=='hidden'));

console.log('Conversation provider verification passed: explicit alternating history, no notebook system-message injection, native chat-message routing.');
