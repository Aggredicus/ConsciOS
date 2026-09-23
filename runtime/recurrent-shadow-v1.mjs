export const RECURRENT_STATE_SCHEMA_VERSION='1.4.0';
const WORKSPACE_CAPACITY=1;
const PREDICTION_ERROR_SALIENCE_WEIGHT=.40;

const clamp01=value=>Math.max(0,Math.min(1,value));
const round=value=>Math.round(value*1000)/1000;

function assertObservation(observation){
  if(!observation||typeof observation!=='object'||!observation.id||!observation.type)throw new TypeError('recurrent observation requires id and type');
  if(typeof observation.baseSalience!=='number'||typeof observation.confidence!=='number')throw new TypeError('recurrent observation requires numeric baseSalience and confidence');
  if(observation.type==='runtime.metric'&&typeof observation.observedRuntimeIncrease!=='boolean')throw new TypeError('runtime.metric requires observedRuntimeIncrease boolean');
}
function validatePriorState(priorState){
  if(priorState===null)return;
  const keys=['schemaVersion','cycleId','worldSummary','selfSummary','predictions','executiveActionId','homeostasisStatus','anchorEventId'];
  if(!priorState||typeof priorState!=='object'||priorState.schemaVersion!==RECURRENT_STATE_SCHEMA_VERSION)throw new TypeError('invalid recurrent state');
  for(const key of keys)if(!(key in priorState))throw new TypeError(`recurrent state missing ${key}`);
}

export function runtimeProbe(observedRuntimeIncrease){
  return Object.freeze({
    id:'runtime-probe',type:'runtime.metric',content:'Runtime memory utilization changed modestly.',
    observedRuntimeIncrease,baseSalience:.35,confidence:.98
  });
}
export function neutralCompetitor(){
  return Object.freeze({
    id:'neutral-competitor',type:'environment.neutral',content:'A neutral competing environmental event occurred.',
    baseSalience:.48,confidence:.99
  });
}

export function runRecurrentCycleV1({cycleId,observations,priorState=null}){
  if(!Number.isInteger(cycleId)||cycleId<1)throw new TypeError('cycleId must be a positive integer');
  if(!Array.isArray(observations)||observations.length===0)throw new TypeError('observations are required');
  observations.forEach(assertObservation);validatePriorState(priorState);

  const events=[];let sequence=0;
  const makeEvent=(stage,type,content,causalParents=[])=>{
    const event=Object.freeze({
      id:`cycle-${cycleId}-${stage}-${String(++sequence).padStart(2,'0')}`,
      cycleId,logicalTime:sequence,source:stage,type,content:structuredClone(content),causalParents:[...causalParents]
    });
    events.push(event);return event;
  };

  const expectedRuntimeIncrease=priorState?.predictions.runtimeIncreaseProbability??.50;
  const contextEvent=makeEvent('RecurrentInterface','recurrent.context',{
    status:priorState?'recurrent-state-received':'stateless-control',
    priorCycleId:priorState?.cycleId??null,
    expectedRuntimeIncrease,
    allowedFields:priorState?Object.keys(priorState):[]
  },priorState?[priorState.anchorEventId]:[]);

  const sensorEvents=observations.map(observation=>makeEvent('Sensorium','observation',observation,[]));
  const candidates=sensorEvents.map(sensorEvent=>{
    const observation=sensorEvent.content;
    const predictionError=observation.type==='runtime.metric'
      ?Math.abs((observation.observedRuntimeIncrease?1:0)-expectedRuntimeIncrease)
      :.10;
    const salience=round(clamp01(observation.baseSalience+predictionError*PREDICTION_ERROR_SALIENCE_WEIGHT));
    const candidate=makeEvent('GlobalWorkspace','attention.candidate',{
      observationId:observation.id,observationType:observation.type,baseSalience:observation.baseSalience,
      predictionError:round(predictionError),salience,confidence:observation.confidence
    },[sensorEvent.id,contextEvent.id]);
    return {candidate,sensorEvent,observation,predictionError:round(predictionError),salience};
  });
  const ranked=[...candidates].sort((a,b)=>b.salience-a.salience||a.candidate.id.localeCompare(b.candidate.id));
  const winner=ranked[0];
  const workspaceEvent=makeEvent('GlobalWorkspace','workspace.broadcast',{
    observationId:winner.observation.id,observationType:winner.observation.type,
    content:winner.observation.content,salience:winner.salience,predictionError:winner.predictionError
  },[winner.candidate.id]);

  const runtimeWinner=winner.observation.type==='runtime.metric';
  const runtimeChangeObserved=runtimeWinner
    ?winner.observation.observedRuntimeIncrease
    :(priorState?.worldSummary.runtimeChangeObserved??null);
  const world={
    runtimeChangeObserved,
    updateMode:runtimeWinner?'current-global-evidence':priorState?'carried-forward-no-new-global-runtime-evidence':'no-global-runtime-evidence',
    globalObservationId:winner.observation.id
  };
  const worldEvent=makeEvent('WorldModel','model.world.update',world,[workspaceEvent.id]);

  const self={
    cycleId,recurrentContextUsed:!!priorState,priorCycleId:priorState?.cycleId??null,
    previousExecutiveActionId:priorState?.executiveActionId??null,
    workspaceObservationId:winner.observation.id
  };
  const selfEvent=makeEvent('SelfModel','model.self.update',self,[workspaceEvent.id,contextEvent.id]);

  const nextProbability=runtimeWinner?(winner.observation.observedRuntimeIncrease?.80:.20):expectedRuntimeIncrease;
  const prediction={runtimeIncreaseProbability:round(nextProbability),confidence:runtimeWinner?.90:(priorState?.predictions.confidence??.50)};
  const predictionEvent=makeEvent('WorldModel','prediction.next-runtime-state',prediction,[worldEvent.id,contextEvent.id]);

  const metaConfidence=round(clamp01(winner.observation.confidence-.20*winner.predictionError));
  const meta={confidence:metaConfidence,predictionError:winner.predictionError,basis:'winning global observation confidence adjusted by prediction error'};
  const metaEvent=makeEvent('Metacognition','confidence.assessment',meta,[workspaceEvent.id,predictionEvent.id]);

  const homeostasis={
    status:winner.predictionError>.85?'attention-required':'stable',
    variables:{workspaceLoad:1/WORKSPACE_CAPACITY,predictionError:winner.predictionError,recurrentContextUsed:!!priorState}
  };
  const homeostasisEvent=makeEvent('Homeostasis','homeostasis.assessment',homeostasis,[metaEvent.id]);
  const guardian={decision:'allow',rationale:'Neutral reversible recurrent-laboratory expression only.'};
  const guardianEvent=makeEvent('Guardian','governance.decision',guardian,[homeostasisEvent.id,metaEvent.id]);
  const executive={status:'selected',action:{id:`action-cycle-${cycleId}-neutral-report`,kind:'neutral-temporal-report'}};
  const executiveEvent=makeEvent('Executive','action.selection',executive,[guardianEvent.id]);
  const expressionText=runtimeWinner
    ?`Cycle ${cycleId}: the runtime-memory observation is globally accessible.`
    :`Cycle ${cycleId}: the neutral competing observation is globally accessible; the runtime-memory observation is not globally accessible.`;
  const expression={content:`${expressionText} Metacognitive confidence ${metaConfidence.toFixed(3)}.`,claim:'functional recurrent-laboratory report only'};
  const expressionEvent=makeEvent('Expression','expression.report',expression,[executiveEvent.id,workspaceEvent.id]);

  const anchorContent={
    cycleId,
    worldSummary:{runtimeChangeObserved:world.runtimeChangeObserved,updateMode:world.updateMode},
    selfSummary:{recurrentContextUsed:self.recurrentContextUsed,priorCycleId:self.priorCycleId},
    predictions:{...prediction},
    executiveActionId:executive.action.id,
    homeostasisStatus:homeostasis.status
  };
  const anchorEvent=makeEvent('RecurrentInterface','recurrent.anchor',anchorContent,[worldEvent.id,selfEvent.id,predictionEvent.id,homeostasisEvent.id,executiveEvent.id]);
  const recurrentState=Object.freeze({
    schemaVersion:RECURRENT_STATE_SCHEMA_VERSION,
    cycleId,
    worldSummary:anchorContent.worldSummary,
    selfSummary:anchorContent.selfSummary,
    predictions:anchorContent.predictions,
    executiveActionId:anchorContent.executiveActionId,
    homeostasisStatus:anchorContent.homeostasisStatus,
    anchorEventId:anchorEvent.id
  });

  const runtimeCandidate=candidates.find(item=>item.observation.type==='runtime.metric')??null;
  return Object.freeze({
    cycleId,
    inputObservations:structuredClone(observations),
    priorStateUsed:!!priorState,
    events,
    workspace:{winnerObservationId:winner.observation.id,winnerEventId:workspaceEvent.id},
    world,self,prediction,meta,homeostasis,guardian,executive,expression,
    recurrentState,
    diagnostics:{
      expectedRuntimeIncrease:round(expectedRuntimeIncrease),
      runtimePredictionError:runtimeCandidate?.predictionError??null,
      runtimeCandidateSalience:runtimeCandidate?.salience??null,
      winningPredictionError:winner.predictionError,
      contextEventId:contextEvent.id,
      anchorEventId:anchorEvent.id
    }
  });
}

export function runRecurrentLaboratoryV1(){
  const stableInput=[runtimeProbe(false),neutralCompetitor()];
  const increaseInput=[runtimeProbe(true),neutralCompetitor()];
  const cycle1=runRecurrentCycleV1({cycleId:1,observations:stableInput});
  const cycle2=runRecurrentCycleV1({cycleId:2,observations:increaseInput,priorState:cycle1.recurrentState});
  const cycle3Recurrent=runRecurrentCycleV1({cycleId:3,observations:increaseInput,priorState:cycle2.recurrentState});
  const cycle3Stateless=runRecurrentCycleV1({cycleId:3,observations:increaseInput,priorState:null});
  return Object.freeze({
    id:'recurrent-cognition-lab-v1.4',owner:'ObserverScientist',causalAuthority:'none',
    cycles:{cycle1,cycle2,cycle3Recurrent,cycle3Stateless}
  });
}
