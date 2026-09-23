import { assertValidModelManifest } from './model-manifest.mjs';

export const TRANSFORMERS_JS_VERSION='4.3.0';
export const TRANSFORMERS_JS_BROWSER_URL=`https://cdn.jsdelivr.net/npm/@huggingface/transformers@${TRANSFORMERS_JS_VERSION}`;

const now=()=>globalThis.performance?.now?.()??Date.now();

export function serializeDeclaredContext(contextManifest=[]){
  if(!Array.isArray(contextManifest))throw new TypeError('contextManifest must be an array');
  return contextManifest.map(({artifactId,epistemicStatus,content})=>({artifactId,epistemicStatus,content}));
}

export class BrowserTransformersHost {
  constructor({manifest,device='webgpu',dtype,importTransformers=url=>import(url),onProgress=()=>{}}={}){
    this.manifest=assertValidModelManifest(manifest);
    if(!['webgpu','wasm'].includes(device))throw new TypeError('device must be webgpu or wasm');
    this.device=device;
    this.dtype=dtype||(device==='webgpu'?manifest.webgpuDtype:manifest.wasmDtype);
    this.importTransformers=importTransformers;
    this.onProgress=onProgress;
    this.generator=null;
    this.module=null;
    this.state='idle';
    this.cancelRequested=false;
    this.loadTelemetry=null;
  }

  provenance(extra={}){
    return {
      provider:'transformers-js-browser-local',modelId:this.manifest.model,revision:this.manifest.revision||null,
      dtype:this.dtype,device:this.device,runtime:`@huggingface/transformers@${TRANSFORMERS_JS_VERSION}`,
      inferenceLocation:'browser-local',remoteInference:false,...extra
    };
  }

  async load(){
    if(this.generator)return this.loadTelemetry;
    if(this.state==='loading')throw new Error('model load already in progress');
    this.state='loading';
    const started=now();
    try{
      this.module=await this.importTransformers(TRANSFORMERS_JS_BROWSER_URL);
      if(typeof this.module?.pipeline!=='function')throw new Error('Transformers.js pipeline export unavailable');
      const progress_callback=event=>this.onProgress({phase:'download-load',...event});
      this.generator=await this.module.pipeline(this.manifest.task,this.manifest.model,{
        device:this.device,dtype:this.dtype,revision:this.manifest.revision,progress_callback
      });
      this.state='ready';
      this.loadTelemetry=this.provenance({loadElapsedMs:Math.round(now()-started)});
      return this.loadTelemetry;
    }catch(error){
      this.state='error';this.generator=null;
      throw new Error(`local model load failed: ${error?.message||error}`);
    }
  }

  cancel(){this.cancelRequested=true}

  async generate({userText,contextManifest=[],maxNewTokens=this.manifest.defaultMaxNewTokens,onText=()=>{},doSample=false}={}){
    if(!this.generator)throw new Error('local model is not loaded');
    if(typeof userText!=='string'||!userText.trim())throw new TypeError('userText is required');
    const declared=serializeDeclaredContext(contextManifest);
    const messages=[];
    if(declared.length)messages.push({role:'system',content:`Declared ConsciOS context artifacts (and only these artifacts):\n${JSON.stringify(declared)}`});
    messages.push({role:'user',content:userText});
    this.cancelRequested=false;
    const started=now();let firstChunkAt=null;let streamedText='';
    const callback=text=>{
      if(this.cancelRequested)return;
      if(firstChunkAt===null)firstChunkAt=now();
      streamedText+=text;onText(text);
    };
    const streamer=this.module?.TextStreamer?new this.module.TextStreamer(this.generator.tokenizer,{skip_prompt:true,skip_special_tokens:true,callback_function:callback}):undefined;
    const stoppingCriteria=this.module?.InterruptableStoppingCriteria?new this.module.InterruptableStoppingCriteria():null;
    const cancelPoll=stoppingCriteria?setInterval(()=>{if(this.cancelRequested)stoppingCriteria.interrupt?.()},10):null;
    try{
      const output=await this.generator(messages,{max_new_tokens:maxNewTokens,do_sample:doSample,streamer,stopping_criteria:stoppingCriteria?[stoppingCriteria]:undefined});
      const ended=now();
      const generated=output?.[0]?.generated_text;
      const finalText=streamedText||((Array.isArray(generated)?generated.at(-1)?.content:generated)||'');
      return {
        status:this.cancelRequested?'cancelled':'ok',text:finalText,
        contextArtifactIds:declared.map(x=>x.artifactId),
        provenance:this.provenance(),
        telemetry:{elapsedMs:Math.round(ended-started),ttftMs:firstChunkAt===null?null:Math.round(firstChunkAt-started),streamed:Boolean(streamer)}
      };
    }finally{if(cancelPoll)clearInterval(cancelPoll)}
  }
}

export function createBrowserTransformersHost(options){return new BrowserTransformersHost(options)}
