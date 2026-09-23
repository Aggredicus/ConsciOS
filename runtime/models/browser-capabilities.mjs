export async function detectBrowserAICapabilities(scope=globalThis){
  const nav=scope?.navigator;
  const result={
    webgpu:{available:false,fp16:false,adapterInfo:null,error:null},
    wasm:typeof scope?.WebAssembly!=='undefined',
    workers:typeof scope?.Worker!=='undefined',
    crossOriginIsolated:Boolean(scope?.crossOriginIsolated),
    sharedArrayBuffer:typeof scope?.SharedArrayBuffer!=='undefined',
    hardwareConcurrency:Number.isFinite(nav?.hardwareConcurrency)?nav.hardwareConcurrency:null,
    deviceMemoryGB:Number.isFinite(nav?.deviceMemory)?nav.deviceMemory:null,
    indexedDB:typeof scope?.indexedDB!=='undefined',
    cacheStorage:typeof scope?.caches!=='undefined'
  };
  if(nav?.gpu){
    try{
      const adapter=await nav.gpu.requestAdapter();
      if(adapter){
        result.webgpu.available=true;
        result.webgpu.fp16=Boolean(adapter.features?.has?.('shader-f16'));
        if(typeof adapter.requestAdapterInfo==='function'){
          try{result.webgpu.adapterInfo=await adapter.requestAdapterInfo()}catch{}
        }else if(adapter.info){
          result.webgpu.adapterInfo={...adapter.info};
        }
      }
    }catch(error){
      result.webgpu.error=String(error?.message||error);
    }
  }
  return result;
}

export function chooseBrowserExecution(capabilities,{prefer='webgpu'}={}){
  if(prefer==='webgpu'&&capabilities?.webgpu?.available){
    return {device:'webgpu',dtype:capabilities.webgpu.fp16?'q4f16':'q4',reason:capabilities.webgpu.fp16?'WebGPU with shader-f16':'WebGPU without shader-f16'};
  }
  if(capabilities?.wasm)return {device:'wasm',dtype:'q4',reason:'WebAssembly fallback'};
  throw new Error('No supported browser inference backend detected.');
}
