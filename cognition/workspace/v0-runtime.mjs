import { salience } from './policies.mjs';

export const V0_WEIGHTS = Object.freeze({novelty:.30, goalRelevance:.30, predictionError:.25, urgency:.15});
export const V0_WORKSPACE_CAPACITY = 2;

export function scoreV0(event) {
  return salience(event, V0_WEIGHTS);
}

export const V0_LOCAL_PROCESSORS = Object.freeze([
  Object.freeze({name:'RelevanceProcessor', matches:e=>e.goalRelevance>=.5, type:'candidate.relevance', text:e=>`Potentially goal-relevant event: ${e.content}`}),
  Object.freeze({name:'PredictionErrorProcessor', matches:e=>e.predictionError>=.5, type:'candidate.surprise', text:e=>`Prediction discrepancy merits evaluation: ${e.content}`}),
  Object.freeze({name:'NoveltyProcessor', matches:e=>e.novelty>=.25, type:'candidate.novelty', text:e=>`New information detected: ${e.content}`})
]);

export function localProcessV0(observations, { makeEvent, pushEvent, processors = V0_LOCAL_PROCESSORS, score = scoreV0 }) {
  const out=[];
  for (const obs of observations) for (const p of processors) if (p.matches(obs)) {
    out.push(pushEvent(makeEvent({
      id:`cand-${p.name}-${obs.id}`, source:p.name, target:'GlobalWorkspace', type:p.type, content:p.text(obs),
      confidence:obs.confidence, novelty:obs.novelty, goalRelevance:obs.goalRelevance, predictionError:obs.predictionError, urgency:obs.urgency,
      salience:score(obs), causalParents:[obs.id], epistemicStatus:'inference'
    })));
  }
  return out;
}

export function workspaceCompetitionV0(candidates, { makeEvent, pushEvent, capacity = V0_WORKSPACE_CAPACITY }) {
  const sorted=[...candidates].sort((a,b)=>b.salience-a.salience || a.id.localeCompare(b.id));
  const winners=sorted.slice(0,capacity).map(c=>pushEvent(makeEvent({...c,
    id:`broadcast-${c.id}`, source:'GlobalWorkspace', target:'*', type:'workspace.broadcast',
    content:c.content, globallyAvailable:true, causalParents:[c.id], epistemicStatus:'inference'
  })));
  const parentIds=new Set(winners.map(w=>w.causalParents[0]));
  return { winners, suppressed:sorted.filter(c=>!parentIds.has(c.id)) };
}
