import {createExoInferenceProvider} from '../../runtime/models/exo-provider.mjs';

export function normalizeExoEndpoint(value){
  const url=new URL(String(value??'').trim());
  if(!['http:','https:'].includes(url.protocol))throw new Error('exo address must use http:// or https://');
  if(url.username||url.password)throw new Error('Do not put credentials in the exo address.');
  return url.origin;
}
export const isMixedExoContent=endpoint=>location.protocol==='https:'&&new URL(endpoint).protocol==='http:';

export async function connectExoProvider({endpoint,modelId=null}={}){
  const normalized=normalizeExoEndpoint(endpoint);
  const provider=createExoInferenceProvider({endpoint:normalized,modelId});
  const capabilities=await provider.connect();
  if(modelId&&capabilities.models.includes(modelId))provider.setModel(modelId);
  return {provider,capabilities,endpoint:normalized};
}
