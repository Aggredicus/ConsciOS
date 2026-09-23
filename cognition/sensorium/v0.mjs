export const V0_FIXTURE = Object.freeze([
  Object.freeze({id:'obs-clock',source:'Sensorium',type:'clock.tick',content:'A routine clock tick occurred.',confidence:1,novelty:.05,goalRelevance:.10,predictionError:.02,urgency:.01}),
  Object.freeze({id:'obs-user',source:'Sensorium',type:'human.message',content:'A human supplied a new neutral task instruction.',confidence:1,novelty:.80,goalRelevance:.95,predictionError:.40,urgency:.45}),
  Object.freeze({id:'obs-runtime',source:'Sensorium',type:'runtime.metric',content:'Memory utilization rose modestly but remains within the stable range.',confidence:.98,novelty:.35,goalRelevance:.55,predictionError:.70,urgency:.30}),
  Object.freeze({id:'obs-style',source:'Sensorium',type:'ui.cosmetic',content:'A cosmetic display preference changed.',confidence:.99,novelty:.30,goalRelevance:.15,predictionError:.20,urgency:.05})
]);

export function perceiveV0({ makeEvent, pushEvent, score, fixture = V0_FIXTURE }) {
  return fixture.map(raw => pushEvent(makeEvent({...raw, salience:score(raw), epistemicStatus:'observation'})));
}
