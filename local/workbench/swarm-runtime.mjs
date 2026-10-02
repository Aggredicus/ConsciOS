import {createBrowserSwarmProvider} from '../../runtime/models/browser-swarm-provider.mjs';

export const DEFAULT_SECURE_SWARM_URL='https://aggredicus.github.io/ConsciOS/local/swarm/';

export function openSwarmBridge(provider,{url=location.protocol==='https:'?new URL('../swarm/',location.href).toString():DEFAULT_SECURE_SWARM_URL}={}){
  const target=new URL(url),token=crypto.randomUUID();
  target.searchParams.set('bridge',token);target.searchParams.set('openerOrigin',location.origin);
  const bridgeWindow=window.open(target.toString(),'conscios-swarm-worker','popup=yes,width=520,height=820');
  if(!bridgeWindow)throw new Error('Swarm window was blocked. Allow pop-ups for this site and try again.');
  provider.attachWindow(bridgeWindow,{origin:target.origin,token});return {bridgeWindow,url:target.toString(),origin:target.origin,token};
}
export async function connectBrowserSwarm({openIfMissing=true,timeoutMs=180000}={}){
  const provider=createBrowserSwarmProvider();
  if(openIfMissing){const bridge=openSwarmBridge(provider);return {provider,bridge,capabilities:await provider.waitForWorker({timeoutMs}),opened:true}}
  try{return {provider,capabilities:await provider.connect({timeoutMs:1200}),opened:false}}catch(error){provider.dispose();throw error}
}
export async function runHybridPoolTest({exoProvider,swarmProvider}={}){
  if(!exoProvider?.modelId)throw new Error('Connect exo and select a model first.');
  if(!swarmProvider?.capability?.enabled)throw new Error('Connect a paired browser worker first.');
  await exoProvider.ensureModelInstance(exoProvider.modelId);
  const nonce=crypto.randomUUID().slice(0,8),input={requestId:`hybrid-${nonce}`,requestingModule:'ObserverScientist',inferenceType:'pool-verification',contextManifest:[],causalSourceIds:[],conversationMessages:[{role:'user',content:`Reply with exactly BROWSER-${nonce}.`}],maxResponseUnits:64,expectedEpistemicStatus:'inference',hiddenContextPolicy:'none'};
  const started=performance.now();
  const [exo,swarm]=await Promise.all([
    exoProvider.benchmark({modelId:exoProvider.modelId,prompt:`Reply with exactly EXO-${nonce}.`,maxTokens:64}),
    swarmProvider.infer(input)
  ]);
  const elapsedMs=Math.max(0,performance.now()-started);
  if(swarm.status!=='ok')throw new Error(swarm.failure||'browser swarm task failed');
  return {status:'pooled-task-parallel',elapsedMs,exoModel:exoProvider.modelId,browserModel:swarmProvider.capability.modelId,exo,swarm,nonce,semantics:'independent inference tasks executed concurrently; not native exo tensor/pipeline sharding'};
}
