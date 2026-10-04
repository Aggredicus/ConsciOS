import { createModelRegistry, createOpenAICompatibleAdapter } from './models.mjs';
import { createUniverseModel } from './universe.mjs';
import { runBattery, compareBatteryRuns } from './experiments/battery.mjs';

export function createResearchLab({kernel,defaultApiKey=''}={}) {
  if (!kernel) throw new Error('Research lab requires a ConsciOS kernel.');
  const models=createModelRegistry();
  const universe=createUniverseModel();
  let interventionEnabled=false;
  let lastComparison=null;

  return Object.freeze({
    models,
    universe,
    interventionEnabled:()=>interventionEnabled,
    setInterventionEnabled(value){interventionEnabled=Boolean(value);return interventionEnabled;},
    addOpenAICompatible({name,baseUrl,model,apiKey=defaultApiKey,capabilities={}}){
      const adapter=createOpenAICompatibleAdapter({name,baseUrl,model,apiKey,capabilities});
      models.add(adapter);
      models.use(name);
      return adapter.manifest;
    },
    async testActiveModel(){
      const adapter=models.active();
      if(!adapter)throw new Error('No active model.');
      return adapter.generate({messages:[{role:'user',content:'Reply with exactly: ConsciOS model connection OK'}],maxTokens:32});
    },
    async runComparativeBattery({onProgress=()=>{}}={}){
      const adapter=models.active();
      if(!adapter)throw new Error('No active model.');
      const kernelSnapshot=kernel.snapshot();
      const baseline=await runBattery({adapter,condition:'baseline',universe,kernelSnapshot,onProgress});
      let control=null,intervention=null;
      if(interventionEnabled){
        control=await runBattery({adapter,condition:'matched-control',universe,kernelSnapshot,onProgress});
        intervention=await runBattery({adapter,condition:'conscios',universe,kernelSnapshot,onProgress});
      }
      lastComparison=compareBatteryRuns({baseline,control,intervention});
      return lastComparison;
    },
    lastComparison:()=>lastComparison
  });
}
