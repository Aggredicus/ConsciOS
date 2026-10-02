import assert from 'node:assert/strict';
import http from 'node:http';
import {createExoInferenceProvider} from '../../../runtime/models/exo-provider.mjs';

const modelId='mlx-community/Qwen3-sim';
let placed=false;
const requests=[];

function json(res,status,payload){
  res.writeHead(status,{'Content-Type':'application/json','Access-Control-Allow-Origin':'*'});
  res.end(JSON.stringify(payload));
}
function state(){
  return {
    topology:{nodes:['node-sim'],connections:{}},
    instances:placed?{
      'instance-sim':{MlxRingInstance:{shardAssignments:{modelId,runnerToShard:{},nodeToRunner:{'node-sim':'runner-sim'}}}}
    }:{},
    tasks:{},
    nodeIdentities:{'node-sim':{friendlyName:'Simulated desktop',modelId:'Desktop-class node',chipId:'SimGPU',osVersion:'simOS 1.0'}},
    nodeMemory:{'node-sim':{ramTotal:{inBytes:128*1024**3},ramAvailable:{inBytes:96*1024**3},swapTotal:{inBytes:8*1024**3},swapAvailable:{inBytes:8*1024**3}}},
    nodeSystem:{'node-sim':{gpuUsage:0.42,temp:54,sysPower:118,pcpuUsage:0.12,ecpuUsage:0.08}},
    nodeDisk:{'node-sim':{total:{inBytes:2*1024**4},available:{inBytes:1.4*1024**4}}},
    lastEventAppliedIdx:7
  };
}

const server=http.createServer(async(req,res)=>{
  const url=new URL(req.url||'/',`http://${req.headers.host||'127.0.0.1'}`);
  requests.push({method:req.method,path:url.pathname,search:url.search});
  if(req.method==='OPTIONS'){
    res.writeHead(204,{'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'Content-Type','Access-Control-Allow-Methods':'GET,POST,OPTIONS'});
    res.end();return;
  }
  if(url.pathname==='/node_id')return json(res,200,{node_id:'node-sim'});
  if(url.pathname==='/state')return json(res,200,state());
  if(url.pathname==='/v1/feature-flags')return json(res,200,{disaggregation:false});
  if(url.pathname==='/v1/models')return json(res,200,{object:'list',data:[{id:modelId,object:'model'}]});
  if(url.pathname==='/place_instance'&&req.method==='POST'){
    let body='';for await(const chunk of req)body+=chunk;
    const parsed=JSON.parse(body||'{}');
    assert.equal(parsed.model_id,modelId);
    placed=true;
    return json(res,200,{message:'Command received.',command_id:'sim-command',model_card:{model_id:modelId}});
  }
  if(url.pathname==='/instance/await'){
    res.writeHead(200,{'Content-Type':'text/event-stream','Access-Control-Allow-Origin':'*','Cache-Control':'no-cache'});
    if(placed)res.end(`data: {"type":"ready","instance":{"MlxRingInstance":{"shardAssignments":{"modelId":"${modelId}"}}}}\n\n`);
    else res.end(`data: {"type":"timeout","message":"No instance found for model ${modelId}"}\n\n`);
    return;
  }
  if(url.pathname==='/v1/chat/completions'&&req.method==='POST'){
    assert.equal(placed,true,'chat completion must not run before placement');
    let body='';for await(const chunk of req)body+=chunk;
    const parsed=JSON.parse(body||'{}');
    assert.equal(parsed.model,modelId);
    return json(res,200,{id:'sim-chat',choices:[{index:0,message:{role:'assistant',content:'SIM_EXO_OK'},finish_reason:'stop'}]});
  }
  json(res,404,{detail:'not found'});
});

await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const address=server.address();
assert.ok(address&&typeof address==='object');
const endpoint=`http://127.0.0.1:${address.port}`;

const input={
  requestId:'exo-sim-001',
  requestingModule:'ObserverScientist',
  inferenceType:'engineering-conversation',
  contextManifest:[{artifactId:'sim-context',epistemicStatus:'observation',content:{userText:'Return a short simulated result.'}}],
  causalSourceIds:['sim-context'],
  maxResponseUnits:32,
  expectedEpistemicStatus:'inference',
  hiddenContextPolicy:'none'
};

try{
  const provider=createExoInferenceProvider({endpoint});
  const capabilities=await provider.connect();
  assert.equal(capabilities.status,'ready');
  assert.equal(capabilities.cluster.nodeCount,1);
  assert.equal(capabilities.cluster.nodes[0].name,'Simulated desktop');
  assert.equal(capabilities.cluster.nodes[0].ramTotalBytes,128*1024**3);
  assert.equal(capabilities.cluster.nodes[0].ramAvailableBytes,96*1024**3);
  assert.equal(capabilities.cluster.nodes[0].gpuUsage,0.42);
  assert.equal(capabilities.cluster.memory.availableBytes,96*1024**3);
  assert.deepEqual(capabilities.models,[modelId]);
  assert.deepEqual(capabilities.activeModels,[]);

  provider.setModel(modelId);
  const output=await provider.infer(input);
  assert.equal(output.status,'ok');
  assert.equal(output.content.text,'SIM_EXO_OK');
  assert.equal(requests.filter(item=>item.path==='/place_instance').length,1,'provider should place the downloaded model exactly once');
  assert.equal(requests.filter(item=>item.path==='/v1/chat/completions').length,1);

  const refreshed=await provider.refreshRuntime();
  assert.ok(refreshed.activeModels.includes(modelId),'runtime refresh should observe the placed model');
  assert.equal(refreshed.cluster.instanceCount,1);

  console.log('Simulated exo runtime verification passed: real HTTP transport, resource snapshot, downloaded-model discovery, automatic placement, readiness wait, and chat completion.');
}finally{
  await new Promise(resolve=>server.close(resolve));
}
