export const EXPERIENCE_FRAME_VERSION='1.7.0';

const clone=value=>typeof structuredClone==='function'?structuredClone(value):JSON.parse(JSON.stringify(value));

export function createExperienceFrame({
  cycleId=1,observations=[],workspace=[],recentEvents=[],retrievedMemories=[],
  world={},self={},predictions=[],counterfactuals=[],affordances=[],uncertainties=[],causalEventIds=[]
}={}){
  if(!Number.isInteger(cycleId)||cycleId<1)throw new TypeError('cycleId must be a positive integer');
  return Object.freeze({
    schemaVersion:EXPERIENCE_FRAME_VERSION,
    cycleId,
    present:Object.freeze({observations:clone(observations),workspace:clone(workspace)}),
    remembered:Object.freeze({recentEvents:clone(recentEvents),retrievedAutobiographicalEvents:clone(retrievedMemories)}),
    modeled:Object.freeze({world:clone(world),self:clone(self)}),
    anticipated:Object.freeze({predictions:clone(predictions),counterfactuals:clone(counterfactuals)}),
    possible:Object.freeze({affordances:clone(affordances)}),
    uncertain:Object.freeze({assessments:clone(uncertainties)}),
    provenance:Object.freeze({causalEventIds:[...causalEventIds]})
  });
}

export function serializeExperienceFrame(frame){
  if(!frame||frame.schemaVersion!==EXPERIENCE_FRAME_VERSION)throw new TypeError('ExperienceFrame v1.7 required');
  return JSON.stringify(frame);
}

export function routeInferenceCandidate({text,frame}={}){
  const content=String(text??'').trim();
  const candidate=Object.freeze({
    type:content?'candidate.expression':'candidate.no_action',
    content,
    epistemicStatus:'inference',
    causalParents:[...frame.provenance.causalEventIds]
  });
  const guardian=Object.freeze({
    decision:'allow',
    rationale:'Expression is reversible, human-visible only, and contains no actuator authority.'
  });
  const executive=Object.freeze({
    status:'selected',
    action:content?{kind:'expression',content}:{kind:'no-op'}
  });
  return Object.freeze({candidate,guardian,executive,visibleText:content||null});
}
