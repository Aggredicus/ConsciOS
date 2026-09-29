export function normalizeHttpEndpoint(value){
  if(typeof value!=='string'||value.trim()==='')throw new TypeError('provider endpoint must be a non-empty string');
  const url=new URL(value.trim());
  if(url.protocol!=='http:'&&url.protocol!=='https:')throw new TypeError('provider endpoint must use http or https');
  url.hash='';url.search='';url.pathname=url.pathname.replace(/\/+$/,'');
  return url.toString().replace(/\/$/,'');
}

export function declaredContextText(input){
  if(!input||!Array.isArray(input.contextManifest))throw new TypeError('input.contextManifest must be an array');
  return input.contextManifest.map(artifact=>{
    const body=typeof artifact.content==='string'?artifact.content:JSON.stringify(artifact.content);
    return `[artifact ${artifact.artifactId} | ${artifact.epistemicStatus}]\n${body}`;
  }).join('\n\n');
}

export function assertInferenceProvider(provider){
  if(!provider||typeof provider!=='object')throw new TypeError('provider is required');
  if(typeof provider.id!=='string'||provider.id.length===0)throw new TypeError('provider.id is required');
  if(typeof provider.infer!=='function')throw new TypeError('provider.infer() is required');
  if(typeof provider.provenance!=='function')throw new TypeError('provider.provenance() is required');
  return provider;
}

export function createProviderRecord({id,label,kind,location,remote}){
  if(!id||!label||!kind||!location)throw new TypeError('provider record requires id, label, kind, and location');
  return Object.freeze({id,label,kind,location,remote:Boolean(remote)});
}
