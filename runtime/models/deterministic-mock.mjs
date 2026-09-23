import { assertValidModelInput, assertValidModelOutput } from './validation.mjs';

const PROVIDER=Object.freeze({kind:'deterministic-mock',name:'conscios-v0.8-mock',hiddenState:'none'});

function causalIds(input){return [...input.causalSourceIds]}
function worldStateSummary(input){
  const texts=input.contextManifest.map(a=>typeof a.content==='string'?a.content:JSON.stringify(a.content));
  return {
    activeHumanInstruction:texts.some(t=>t.includes('human supplied')),
    runtimeChangeObserved:texts.some(t=>t.includes('Memory utilization')),
    accessibleEventCount:input.contextManifest.length
  };
}
function successContent(input){
  const base={
    inferenceType:input.inferenceType,
    requestingModule:input.requestingModule,
    accessibleArtifactIds:input.contextManifest.map(a=>a.artifactId),
    result:`deterministic:${input.inferenceType}:${input.contextManifest.length}`
  };
  if(input.inferenceType==='world-state-summary')base.worldState=worldStateSummary(input);
  return base;
}

export class DeterministicMockModel {
  constructor({mode='ok'}={}){
    if(!['ok','timeout','error','malformed'].includes(mode))throw new TypeError('unsupported deterministic mock mode');
    this.mode=mode;
  }

  async infer(input){
    assertValidModelInput(input);
    if(this.mode==='malformed')return {requestId:input.requestId,status:'ok'};
    if(this.mode==='timeout')return assertValidModelOutput({
      requestId:input.requestId,provider:{...PROVIDER},status:'timeout',content:null,confidence:0,
      causalSourceIds:causalIds(input),timing:{deterministicSteps:1},failure:'deterministic timeout simulation',epistemicStatus:'error'
    });
    if(this.mode==='error')return assertValidModelOutput({
      requestId:input.requestId,provider:{...PROVIDER},status:'error',content:null,confidence:0,
      causalSourceIds:causalIds(input),timing:{deterministicSteps:1},failure:'deterministic provider error simulation',epistemicStatus:'error'
    });
    return assertValidModelOutput({
      requestId:input.requestId,provider:{...PROVIDER},status:'ok',content:successContent(input),confidence:1,
      causalSourceIds:causalIds(input),timing:{deterministicSteps:1},failure:null,epistemicStatus:input.expectedEpistemicStatus
    });
  }
}

export function createDeterministicMockModel(options){return new DeterministicMockModel(options)}
