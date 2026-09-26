export function disableWorkerNetworkCapabilities(){
  for(const key of ['fetch','WebSocket','EventSource','XMLHttpRequest']){
    try{Object.defineProperty(globalThis,key,{value:undefined,writable:false,configurable:false});}catch{}
  }
}

export async function bindWorkerEndpoint(handler){
  disableWorkerNetworkCapabilities();
  const respond=async message=>{
    const requestId=message?.requestId??null;
    try{
      const value=await handler(message);
      return {requestId,ok:true,value};
    }catch(error){
      return {requestId,ok:false,error:{name:error?.name??'Error',message:String(error?.message??error)}};
    }
  };

  if(typeof globalThis.addEventListener==='function'&&typeof globalThis.postMessage==='function'&&typeof globalThis.document==='undefined'){
    globalThis.addEventListener('message',async event=>globalThis.postMessage(await respond(event.data)));
    return;
  }

  const {parentPort}=await import('node:worker_threads');
  if(!parentPort)throw new Error('Worker endpoint requires a browser WorkerGlobalScope or node:worker_threads parentPort');
  parentPort.on('message',async message=>parentPort.postMessage(await respond(message)));
}
