const WORKER_URL=new URL('./browser-inference-worker.mjs',import.meta.url);

function workerClient(onProgress){
  if(typeof Worker==='undefined')throw new Error('Dedicated Web Workers are unavailable in this browser. Use exo for lag-free inference.');
  const worker=new Worker(WORKER_URL,{type:'module',name:'conscios-browser-inference'});
  let sequence=0,closed=false;const pending=new Map();
  const rejectAll=error=>{for(const entry of pending.values())entry.reject(error);pending.clear()};
  worker.addEventListener('message',event=>{
    const message=event.data??{},entry=pending.get(message.requestId);
    if(message.type==='progress'){entry?.onProgress?.(message.event);return}
    if(message.type==='text'){entry?.onText?.(message.chunk);return}
    if(!entry)return;
    if(message.type==='error'){pending.delete(message.requestId);entry.reject(new Error(message.message||'Browser worker error'));return}
    if(['ready','result','disposed'].includes(message.type)){pending.delete(message.requestId);entry.resolve(message);return}
  });
  worker.addEventListener('error',event=>{const error=new Error(event.message||'Browser inference worker crashed');rejectAll(error)});
  worker.addEventListener('messageerror',()=>rejectAll(new Error('Browser inference worker message could not be decoded.')));
  const call=(type,payload={},handlers={})=>new Promise((resolve,reject)=>{
    if(closed)return reject(new Error('Browser inference worker is closed.'));
    const requestId=`w${++sequence}`;pending.set(requestId,{resolve,reject,...handlers});worker.postMessage({type,requestId,...payload});
  });
  return {
    call,
    cancel(){if(!closed)worker.postMessage({type:'cancel'})},
    dispose(){
      if(closed)return;closed=true;worker.postMessage({type:'dispose',requestId:`w${++sequence}`});
      rejectAll(new Error('Browser inference worker disposed.'));worker.terminate();
    }
  };
}

export async function loadBrowserProvider({modelId,onProgress=()=>{}}={}){
  const client=workerClient(onProgress);
  try{
    const ready=await client.call('load',{modelId},{onProgress});
    const provenance=()=>ready.provenance;
    const provider={
      id:'browser-local',provenance,cancel:()=>client.cancel(),dispose:()=>client.dispose(),
      async infer(input,{onText=()=>{}}={}){
        const response=await client.call('infer',{input},{onText});
        return response.result;
      }
    };
    return {provider,manifest:ready.manifest,execution:ready.execution,capabilities:ready.capabilities};
  }catch(error){client.dispose();throw error}
}
