import { createModelRegistry, createOpenAICompatibleAdapter } from './models.mjs';
import { createUniverseModel } from './universe.mjs';
import { runBattery, compareBatteryRuns } from './experiments/battery.mjs';

function pickCondition(comparison,condition){
  if(condition==='baseline')return comparison.baseline;
  if(condition==='matched-control'||condition==='control')return comparison.matchedControl;
  if(condition==='intervention')return comparison.intervention;
  throw new Error('Condition must be baseline, matched-control, or intervention.');
}

export function createResearchLab({kernel,defaultApiKey='',initialResults=[]}={}) {
  if(!kernel)throw new Error('Research lab requires a ConsciOS kernel.');
  const models=createModelRegistry(),universe=createUniverseModel();
  let interventionEnabled=false;
  const results=Array.isArray(initialResults)?structuredClone(initialResults):[];
  let lastComparison=results.at(-1)??null;

  return Object.freeze({
    models,universe,
    interventionEnabled:()=>interventionEnabled,
    setInterventionEnabled(value){interventionEnabled=Boolean(value);return interventionEnabled},
    addOpenAICompatible({name,baseUrl,model,apiKey=defaultApiKey,capabilities={}}){
      const adapter=createOpenAICompatibleAdapter({name,baseUrl,model,apiKey,capabilities});
      models.add(adapter);models.use(name);return adapter.manifest;
    },
    async testActiveModel(){
      const adapter=models.active();if(!adapter)throw new Error('No active model.');
      return adapter.generate({messages:[{role:'user',content:'Reply with exactly: ConsciOS model connection OK'}],maxTokens:32});
    },
    async runComparativeBattery({onProgress=()=>{}}={}){
      const adapter=models.active();if(!adapter)throw new Error('No active model.');
      const kernelSnapshot=kernel.snapshot();
      const baseline=await runBattery({adapter,condition:'baseline',universe,kernelSnapshot,onProgress});
      let control=null,intervention=null;
      if(interventionEnabled){
        control=await runBattery({adapter,condition:'matched-control',universe,kernelSnapshot,onProgress});
        intervention=await runBattery({adapter,condition:'conscios',universe,kernelSnapshot,onProgress});
      }
      const comparison=compareBatteryRuns({baseline,control,intervention});
      lastComparison={...comparison,resultId:`result-${String(results.length+1).padStart(4,'0')}`};
      results.push(lastComparison);
      return lastComparison;
    },
    lastComparison:()=>lastComparison,
    results:()=>structuredClone(results),
    latestForModel(name){
      return [...results].reverse().find(result=>result.subject?.name===name)??null;
    },
    compareModels(nameA,nameB,condition='baseline'){
      const a=[...results].reverse().find(result=>result.subject?.name===nameA);
      const b=[...results].reverse().find(result=>result.subject?.name===nameB);
      if(!a)throw new Error(`No results for model: ${nameA}`);
      if(!b)throw new Error(`No results for model: ${nameB}`);
      const runA=pickCondition(a,condition),runB=pickCondition(b,condition);
      if(!runA||!runB)throw new Error(`Condition "${condition}" is missing for one or both models.`);
      const dimensions={};
      for(const key of Object.keys(runA.measurements)){
        dimensions[key]={
          [nameA]:runA.measurements[key]?.value??null,
          [nameB]:runB.measurements[key]?.value??null,
          delta:(runB.measurements[key]?.value??0)-(runA.measurements[key]?.value??0)
        };
      }
      return{
        kind:'conscios-cross-model-comparison',version:1,condition,
        modelA:{name:nameA,ecs:runA.score.score,functional:runA.score.functionalScore},
        modelB:{name:nameB,ecs:runB.score.score,functional:runB.score.functionalScore},
        deltaECS:runB.score.score-runA.score.score,
        deltaFunctional:runB.score.functionalScore-runA.score.functionalScore,
        dimensions
      };
    }
  });
}
