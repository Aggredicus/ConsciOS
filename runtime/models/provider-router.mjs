import {assertInferenceProvider} from './inference-provider.mjs';

export class InferenceProviderRouter{
  constructor(){this.providers=new Map();this.selectedId=null}
  register(provider){assertInferenceProvider(provider);if(this.providers.has(provider.id))throw new Error(`provider '${provider.id}' is already registered`);this.providers.set(provider.id,provider);return provider}
  replace(provider){assertInferenceProvider(provider);this.providers.set(provider.id,provider);return provider}
  list(){return [...this.providers.values()].map(provider=>typeof provider.record==='function'?provider.record():{id:provider.id,label:provider.id})}
  select(id){if(!this.providers.has(id))throw new Error(`unknown inference provider '${id}'`);this.selectedId=id;return this.current()}
  current(){return this.selectedId===null?null:this.providers.get(this.selectedId)??null}
  async connectSelected(){const provider=this.current();if(!provider)throw new Error('no inference provider selected');return typeof provider.connect==='function'?provider.connect():{status:'ready',provenance:provider.provenance()}}
  infer(input){const provider=this.current();if(!provider)throw new Error('no inference provider selected');return provider.infer(input)}
  cancel(){return this.current()?.cancel?.()}
}

export function createInferenceProviderRouter(){return new InferenceProviderRouter()}
