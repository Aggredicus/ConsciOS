import { runModularV0 } from '../../../../runtime/v0-modular.mjs';
import { createLiveScheduler } from '../../../../runtime/live-scheduler.mjs';
import { runRecurrentLaboratoryV1 } from '../../../../runtime/recurrent-shadow-v1.mjs';

export function runCorticalEcologyBaselineFixtures(){
  const acceptedState=runModularV0();
  const scheduler=createLiveScheduler({cycle:1,workspacePolicy:'raw'});
  const liveSteps=[];
  while(!scheduler.isComplete())liveSteps.push(scheduler.step());
  const liveFinal=scheduler.snapshot();
  const recurrentLab=runRecurrentLaboratoryV1();
  return Object.freeze({acceptedState,liveSteps,liveFinal,recurrentLab});
}
