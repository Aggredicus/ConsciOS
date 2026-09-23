export const COGNITIVE_MODEL_ADAPTER_VERSION='2.0.0';

const clean=x=>String(x??'').trim();
const compact=x=>JSON.stringify(x);

export function adaptExperienceFrameToModelMessages(frame){
  if(!frame?.schemaVersion)throw new TypeError('ExperienceFrame required');
  const human=frame.present?.observations?.filter(x=>x?.type==='human.message').map(x=>clean(x.content)).filter(Boolean)??[];
  const workspace=frame.present?.workspace??[];
  const recent=frame.remembered?.recentEvents??[];
  const internal={
    cycleId:frame.cycleId,
    workspace,
    remembered:recent,
    world:frame.modeled?.world??{},
    self:frame.modeled?.self??{},
    predictions:frame.anticipated?.predictions??[],
    counterfactuals:frame.anticipated?.counterfactuals??[],
    affordances:frame.possible?.affordances??[],
    uncertainty:frame.uncertain?.assessments??[]
  };
  const stateText=compact(internal);
  const messages=[{role:'system',content:`Operational cognitive context for the current cycle. Use it as internal context rather than as a document to summarize. Do not invent observations not present here.\n${stateText}`}];
  for(const turn of recent){
    const role=turn?.role==='human'?'user':'assistant';
    const content=clean(turn?.content);
    if(content)messages.push({role,content});
  }
  for(const content of human)messages.push({role:'user',content});
  if(!human.length)messages.push({role:'user',content:'Continue the current cognitive cycle. An external reply is optional; produce text only if expression is appropriate.'});
  return Object.freeze({adapterVersion:COGNITIVE_MODEL_ADAPTER_VERSION,stateText,messages:Object.freeze(messages.map(Object.freeze))});
}
