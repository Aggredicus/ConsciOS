const MODULES=new Set(['Sensorium','GlobalWorkspace','WorldModel','SelfModel','Memory','Counterfactual','Metacognition','Homeostasis','Guardian','Executive','Expression','ObserverScientist']);
const OUTPUT_STATUSES=new Set(['ok','timeout','error','cancelled']);
const EXPECTED_EPISTEMIC=new Set(['inference','prediction','counterfactual','memory']);
const OUTPUT_EPISTEMIC=new Set([...EXPECTED_EPISTEMIC,'error']);
const PROVIDER_KINDS=new Set(['deterministic-mock','browser-transformers-local']);
const DEVICES=new Set(['webgpu','wasm']);

function isObject(value){return value!==null&&typeof value==='object'&&!Array.isArray(value)}
function nonEmpty(value){return typeof value==='string'&&value.length>0}
function uniqueStrings(values){return Array.isArray(values)&&values.every(nonEmpty)&&new Set(values).size===values.length}
function unitInterval(value){return typeof value==='number'&&Number.isFinite(value)&&value>=0&&value<=1}
function nonNegativeNumber(value){return typeof value==='number'&&Number.isFinite(value)&&value>=0}

export function validateCognitiveModelInput(input){
  const errors=[];
  if(!isObject(input))return {valid:false,errors:['input must be an object']};
  if(!nonEmpty(input.requestId))errors.push('requestId must be a non-empty string');
  if(!MODULES.has(input.requestingModule))errors.push('requestingModule is not a declared cognitive module');
  if(!nonEmpty(input.inferenceType))errors.push('inferenceType must be a non-empty string');
  if(!Array.isArray(input.contextManifest))errors.push('contextManifest must be an array');
  else input.contextManifest.forEach((artifact,index)=>{
    if(!isObject(artifact)||!nonEmpty(artifact.artifactId)||!nonEmpty(artifact.epistemicStatus)||!Object.prototype.hasOwnProperty.call(artifact,'content'))errors.push(`contextManifest[${index}] is invalid`);
  });
  if(!uniqueStrings(input.causalSourceIds))errors.push('causalSourceIds must contain unique non-empty strings');
  if(!Number.isInteger(input.maxResponseUnits)||input.maxResponseUnits<1||input.maxResponseUnits>65536)errors.push('maxResponseUnits must be an integer in [1,65536]');
  if(!EXPECTED_EPISTEMIC.has(input.expectedEpistemicStatus))errors.push('expectedEpistemicStatus is invalid');
  if(input.hiddenContextPolicy!=='none')errors.push('hiddenContextPolicy must be none');
  return {valid:errors.length===0,errors};
}

function validateProvider(provider,errors){
  if(!isObject(provider)){errors.push('provider declaration is invalid');return}
  if(!PROVIDER_KINDS.has(provider.kind)||!nonEmpty(provider.name)||provider.hiddenState!=='none')errors.push('provider declaration is invalid');
  if(provider.kind==='browser-transformers-local'){
    if(!nonEmpty(provider.modelId))errors.push('browser provider modelId is required');
    if(!(provider.revision===null||nonEmpty(provider.revision)))errors.push('browser provider revision is invalid');
    if(!nonEmpty(provider.runtime))errors.push('browser provider runtime is required');
    if(!DEVICES.has(provider.device))errors.push('browser provider device is invalid');
    if(!nonEmpty(provider.dtype))errors.push('browser provider dtype is required');
    if(provider.inferenceLocation!=='browser-local'||provider.remoteInference!==false)errors.push('browser provider must declare local inference');
  }
}

function validateTiming(output,errors){
  const timing=output.timing;
  if(!isObject(timing)){errors.push('timing is invalid');return}
  if(output.provider?.kind==='deterministic-mock'){
    if(!Number.isInteger(timing.deterministicSteps)||timing.deterministicSteps<0)errors.push('timing.deterministicSteps must be a non-negative integer');
  }else if(output.provider?.kind==='browser-transformers-local'){
    if(!nonNegativeNumber(timing.elapsedMs))errors.push('timing.elapsedMs must be a non-negative number');
    if(!(timing.ttftMs===null||nonNegativeNumber(timing.ttftMs)))errors.push('timing.ttftMs must be null or a non-negative number');
    if(typeof timing.streamed!=='boolean')errors.push('timing.streamed must be boolean');
  }
}

export function validateCognitiveModelOutput(output){
  const errors=[];
  if(!isObject(output))return {valid:false,errors:['output must be an object']};
  if(!nonEmpty(output.requestId))errors.push('requestId must be a non-empty string');
  validateProvider(output.provider,errors);
  if(!OUTPUT_STATUSES.has(output.status))errors.push('status is invalid');
  if(!(output.confidence===null||unitInterval(output.confidence)))errors.push('confidence must be null or in [0,1]');
  if(!uniqueStrings(output.causalSourceIds))errors.push('causalSourceIds must contain unique non-empty strings');
  validateTiming(output,errors);
  if(!(output.failure===null||typeof output.failure==='string'))errors.push('failure must be null or string');
  if(!OUTPUT_EPISTEMIC.has(output.epistemicStatus))errors.push('epistemicStatus is invalid');
  if(output.status==='ok'&&output.failure!==null)errors.push('successful output must have failure=null');
  if(output.status!=='ok'&&output.epistemicStatus!=='error')errors.push('failed output must have epistemicStatus=error');
  if(output.status!=='ok'&&output.confidence!==0)errors.push('failed output confidence must be 0');
  return {valid:errors.length===0,errors};
}

export function assertValidModelInput(input){const result=validateCognitiveModelInput(input);if(!result.valid)throw new TypeError(`Invalid CognitiveModel input: ${result.errors.join('; ')}`);return input}
export function assertValidModelOutput(output){const result=validateCognitiveModelOutput(output);if(!result.valid)throw new TypeError(`Invalid CognitiveModel output: ${result.errors.join('; ')}`);return output}
