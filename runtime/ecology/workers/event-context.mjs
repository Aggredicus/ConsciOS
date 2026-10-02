const clamp01=value=>Math.max(0,Math.min(1,value));

export function createWorkerEventContext({initialTick=0}={}){
  let tick=initialTick;
  const events=[];
  const makeEvent=partial=>Object.freeze({
    id:partial.id,
    timestamp:++tick,
    source:partial.source,
    target:partial.target??null,
    type:partial.type,
    content:partial.content,
    confidence:clamp01(partial.confidence??1),
    novelty:clamp01(partial.novelty??0),
    goalRelevance:clamp01(partial.goalRelevance??0),
    predictionError:clamp01(partial.predictionError??0),
    urgency:clamp01(partial.urgency??0),
    salience:clamp01(partial.salience??0),
    causalParents:[...(partial.causalParents??[])],
    epistemicStatus:partial.epistemicStatus??'observation',
    globallyAvailable:!!partial.globallyAvailable,
    metadata:partial.metadata??{}
  });
  const pushEvent=event=>{events.push(event);return event;};
  return Object.freeze({makeEvent,pushEvent,get tick(){return tick;},events});
}
