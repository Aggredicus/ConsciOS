import {createLiveScheduler,makeBrowserObservation} from '../runtime/live-scheduler.mjs';

export function runConversationArchitectureTrace({content,cycle=1,workspacePolicy='raw'}={}){
  const observation=makeBrowserObservation({
    id:`obs-local-conversation-${cycle}`,
    content:String(content??''),
    type:'human.message',
    confidence:1,
    novelty:.7,
    goalRelevance:.8,
    predictionError:.4,
    urgency:.2,
    metadata:{origin:'local-ai-lab',engineeringMode:true}
  });
  const scheduler=createLiveScheduler({fixture:[observation],workspacePolicy,cycle});
  const transitions=[];
  while(!scheduler.isComplete()){
    const step=scheduler.step();
    transitions.push({
      stage:step.stage,label:step.label,tick:step.tick,
      newEventIds:[...step.newEventIds],newEvents:step.newEvents
    });
    // The neural model is an ObserverScientist inference component, not Expression.
    // Stop after Executive so this trace cannot be mistaken for model-authored Expression.
    if(step.stage==='executive')break;
  }
  const state=scheduler.snapshot();
  return Object.freeze({
    cycle,workspacePolicy,observationId:observation.id,
    transitions,
    events:state.events,
    traceRoot:state.executive?.action?.id??state.events.at(-1)?.id??observation.id,
    state
  });
}

export function causalAncestry(events,eventId){
  const byId=new Map(events.map(event=>[event.id,event]));
  const visited=new Set();
  const ordered=[];
  function visit(id,depth=0){
    if(!id||visited.has(id))return;
    visited.add(id);
    const event=byId.get(id);
    if(!event)return;
    ordered.push({id:event.id,type:event.type,source:event.source,epistemicStatus:event.epistemicStatus,depth,causalParents:[...(event.causalParents||[])]});
    for(const parent of event.causalParents||[])visit(parent,depth+1);
  }
  visit(eventId);
  return ordered;
}
