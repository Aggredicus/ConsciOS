import {runRecurrentLaboratoryV1} from '../runtime/recurrent-shadow-v1.mjs';

const finite=value=>Number.isFinite(Number(value))?Number(value):null;
const mean=values=>{const xs=values.map(finite).filter(value=>value!==null);return xs.length?xs.reduce((sum,value)=>sum+value,0)/xs.length:null};

export function summarizeArchitectureTrace(trace){
  const events=trace?.events||[];
  const state=trace?.state||{};
  const workspace=state.workspace||[];
  const candidates=state.candidates||[];
  return Object.freeze({
    cycle:trace?.cycle??null,
    eventCount:events.length,
    workspaceOccupancy:workspace.length,
    meanCandidateSalience:mean(candidates.map(candidate=>candidate.salience)),
    meanPredictionError:mean(events.map(event=>event.predictionError)),
    metacognitiveConfidence:finite(state.meta?.confidence),
    homeostasisStatus:state.homeostasis?.status??state.homeostasis?.state??'not exposed',
    guardianState:state.guardian?.decision??state.guardian?.status??'not exposed',
    executiveState:state.executive?.action?.type??state.executive?.decision??state.executive?.status??'not exposed'
  });
}

export function recurrentVsStatelessControl(){
  const lab=runRecurrentLaboratoryV1();
  const recurrent=lab.cycles.cycle3Recurrent;
  const stateless=lab.cycles.cycle3Stateless;
  return Object.freeze({
    owner:lab.owner,
    causalAuthority:lab.causalAuthority,
    inputMatched:JSON.stringify(recurrent.inputObservations)===JSON.stringify(stateless.inputObservations),
    recurrent:Object.freeze({
      expectedRuntimeIncrease:recurrent.diagnostics.expectedRuntimeIncrease,
      runtimePredictionError:recurrent.diagnostics.runtimePredictionError,
      workspaceWinner:recurrent.workspace.winnerObservationId,
      metacognitiveConfidence:recurrent.meta.confidence,
      worldUpdateMode:recurrent.world.updateMode,
      recurrentAnchor:recurrent.recurrentState.anchorEventId
    }),
    stateless:Object.freeze({
      expectedRuntimeIncrease:stateless.diagnostics.expectedRuntimeIncrease,
      runtimePredictionError:stateless.diagnostics.runtimePredictionError,
      workspaceWinner:stateless.workspace.winnerObservationId,
      metacognitiveConfidence:stateless.meta.confidence,
      worldUpdateMode:stateless.world.updateMode,
      recurrentAnchor:null
    })
  });
}
