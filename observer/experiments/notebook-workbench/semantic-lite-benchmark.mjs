import {selectPreviousResults} from '../../../local/workbench/context-selector.mjs';

export const SEMANTIC_LITE_BENCHMARK_FORMAT='conscios-semantic-lite-context-benchmark/v1';

export const SEMANTIC_LITE_TASKS=Object.freeze([
  {
    id:'holdout-soil',prompt:'Is the earth too parched to delay watering?',expected:'soil',
    results:[
      {cellId:'soil',type:'python',title:'Soil moisture advisory',output:{summary:'Irrigation depletion threshold and refill trigger.'}},
      {cellId:'camera',type:'markdown',title:'Lens choice',output:{summary:'Focal framing notes.'}},
      {cellId:'finance',type:'parameters',title:'Cash projection',output:{summary:'Monthly revenue estimate.'}},
      {cellId:'audio',type:'javascript',title:'Oscillator patch',output:{summary:'Frequency and gain settings.'}},
      {cellId:'travel',type:'markdown',title:'Road route',output:{summary:'Campsites and fuel stops.'}}
    ]
  },
  {
    id:'holdout-accelerator',prompt:'Is the graphics card running hot under load?',expected:'runtime',
    results:[
      {cellId:'runtime',type:'javascript',title:'Accelerator telemetry',output:{summary:'GPU temperature and utilization.'}},
      {cellId:'garden',type:'markdown',title:'Perennial guild',output:{summary:'Plant spacing notes.'}},
      {cellId:'calendar',type:'parameters',title:'Dates',output:{summary:'Upcoming reminders.'}},
      {cellId:'recipe',type:'markdown',title:'Bread formula',output:{summary:'Hydration and fermentation.'}},
      {cellId:'palette',type:'javascript',title:'Color wheel',output:{summary:'Hue and chroma values.'}}
    ]
  },
  {
    id:'holdout-mobile',prompt:'Does the handset layout spill to the side?',expected:'responsive',
    results:[
      {cellId:'responsive',type:'javascript',title:'Mobile viewport audit',output:{summary:'Horizontal overflow bounds at narrow width.'}},
      {cellId:'memory',type:'markdown',title:'Episode note',output:{summary:'Prior event evidence.'}},
      {cellId:'soil',type:'python',title:'Field chemistry',output:{summary:'pH and organic matter.'}},
      {cellId:'model',type:'markdown',title:'Weights',output:{summary:'Local inference assets.'}},
      {cellId:'sales',type:'parameters',title:'Leads',output:{summary:'Conversion counts.'}}
    ]
  },
  {
    id:'holdout-continuity',prompt:'Can it recollect state after reopening a later visit?',expected:'continuity',
    results:[
      {cellId:'continuity',type:'markdown',title:'Memory continuity',output:{summary:'Recall survives restart across session boundary.'}},
      {cellId:'weather',type:'parameters',title:'Forecast',output:{summary:'Rain probability.'}},
      {cellId:'geometry',type:'python',title:'Vector transform',output:{summary:'Coordinate result.'}},
      {cellId:'swarm',type:'markdown',title:'Device pairing',output:{summary:'Invitation flow.'}},
      {cellId:'camera',type:'markdown',title:'Exposure',output:{summary:'Shutter and ISO notes.'}}
    ]
  }
]);

function mean(values){return values.length?values.reduce((sum,value)=>sum+value,0)/values.length:0}
function aggregate(rows,strategy){
  const values=rows.map(row=>row[strategy]);
  return {
    recall:mean(values.map(value=>value.hit?1:0)),
    meanSelectedBytes:mean(values.map(value=>value.selectedBytes)),
    meanSelectedCount:mean(values.map(value=>value.selectedCount)),
    maxSelectedBytes:Math.max(0,...values.map(value=>value.selectedBytes))
  };
}

export function runSemanticLiteBenchmark({tasks=SEMANTIC_LITE_TASKS,budgetBytes=520,maxItems=2}={}){
  const rows=tasks.map(task=>{
    const evaluate=strategy=>{
      const selection=selectPreviousResults({query:task.prompt,results:task.results,strategy,budgetBytes,maxItems});
      return {
        hit:selection.results.some(result=>result.cellId===task.expected),
        selectedIds:selection.results.map(result=>result.cellId),
        selectedBytes:selection.selectedBytes,
        selectedCount:selection.selectedCount,
        budgetApplied:selection.budgetApplied,
        queryTerms:selection.queryTerms,
        expandedQueryTerms:selection.expandedQueryTerms
      };
    };
    return {id:task.id,expected:task.expected,relevant:evaluate('relevant'),'semantic-lite':evaluate('semantic-lite'),all:evaluate('all')};
  });
  const semantic=aggregate(rows,'semantic-lite');const relevant=aggregate(rows,'relevant');const all=aggregate(rows,'all');
  return {
    format:SEMANTIC_LITE_BENCHMARK_FORMAT,
    config:{budgetBytes,maxItems,taskCount:rows.length},
    rows,
    dimensions:{
      semanticLite:semantic,
      relevant,
      all,
      byteRatioToAll:all.meanSelectedBytes?semantic.meanSelectedBytes/all.meanSelectedBytes:1,
      byteReduction:all.meanSelectedBytes?1-(semantic.meanSelectedBytes/all.meanSelectedBytes):0,
      recallLift:semantic.recall-relevant.recall
    }
  };
}
