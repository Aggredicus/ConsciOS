import {selectPreviousResults} from '../../../local/workbench/context-selector.mjs';

export const BENCHMARK_FORMAT='conscios-notebook-context-benchmark/v1';

export const CONTEXT_BENCHMARK_TASKS=Object.freeze([
  {
    id:'exact-irrigation',group:'lexical',
    prompt:'Use the soil moisture deficit to choose the irrigation schedule.',
    expected:'soil',
    results:[
      {cellId:'soil',type:'python',title:'Soil moisture deficit',output:{summary:'Soil moisture deficit and irrigation schedule for the field.'}},
      {cellId:'palette',type:'javascript',title:'Chromatic palette',output:{summary:'Twelve color music palette.'}},
      {cellId:'camera',type:'markdown',title:'Camera framing',output:{summary:'Lens and focal length notes.'}},
      {cellId:'sales',type:'parameters',title:'Store metrics',output:{summary:'Monthly conversion totals.'}},
      {cellId:'travel',type:'markdown',title:'Trip plan',output:{summary:'Driving and campsite notes.'}}
    ]
  },
  {
    id:'exact-runtime',group:'lexical',
    prompt:'Check exo GPU temperature and node power before inference.',
    expected:'runtime',
    results:[
      {cellId:'runtime',type:'javascript',title:'exo runtime telemetry',output:{summary:'GPU temperature, node RAM, and system power telemetry.'}},
      {cellId:'garden',type:'markdown',title:'Garden beds',output:{summary:'Bed spacing and mulch depth.'}},
      {cellId:'audio',type:'javascript',title:'Audio graph',output:{summary:'Oscillator and gain nodes.'}},
      {cellId:'recipe',type:'markdown',title:'Recipe',output:{summary:'Bread hydration notes.'}},
      {cellId:'calendar',type:'parameters',title:'Calendar',output:{summary:'Dates and reminders.'}}
    ]
  },
  {
    id:'exact-responsive',group:'lexical',
    prompt:'Find the mobile responsive overflow check for the Workbench.',
    expected:'responsive',
    results:[
      {cellId:'responsive',type:'javascript',title:'Responsive browser audit',output:{summary:'Mobile viewport overflow checks for Workbench controls.'}},
      {cellId:'memory',type:'markdown',title:'Memory note',output:{summary:'Autobiographical recall discussion.'}},
      {cellId:'finance',type:'parameters',title:'Budget',output:{summary:'Cash flow estimates.'}},
      {cellId:'model',type:'markdown',title:'Model list',output:{summary:'Downloaded model names.'}},
      {cellId:'soil',type:'python',title:'Soil test',output:{summary:'Organic matter and pH.'}}
    ]
  },
  {
    id:'exact-continuity',group:'lexical',
    prompt:'Inspect autobiographical memory recall across session continuity.',
    expected:'continuity',
    results:[
      {cellId:'continuity',type:'markdown',title:'Autobiographical memory continuity',output:{summary:'Recall across browser sessions with provenance.'}},
      {cellId:'weather',type:'parameters',title:'Weather',output:{summary:'Temperature forecast.'}},
      {cellId:'geometry',type:'python',title:'Geometry',output:{summary:'Vector transform result.'}},
      {cellId:'swarm',type:'markdown',title:'Swarm pairing',output:{summary:'QR invitation notes.'}},
      {cellId:'color',type:'javascript',title:'Palette',output:{summary:'Hex color values.'}}
    ]
  },
  {
    id:'paraphrase-irrigation',group:'paraphrase',
    prompt:'Which earlier result tells us when the ground is dry enough that the crops should be watered?',
    expected:'soil',
    results:[
      {cellId:'soil',type:'python',title:'Root-zone balance',output:{summary:'Depletion threshold and refill trigger for sandy loam.'}},
      {cellId:'palette',type:'javascript',title:'Hue wheel',output:{summary:'Perceptual chroma mappings.'}},
      {cellId:'camera',type:'markdown',title:'Composition',output:{summary:'Focal choices for video.'}},
      {cellId:'sales',type:'parameters',title:'Conversion',output:{summary:'Leads and purchases.'}},
      {cellId:'travel',type:'markdown',title:'Route',output:{summary:'Stops and campsites.'}}
    ]
  },
  {
    id:'paraphrase-runtime',group:'paraphrase',
    prompt:'Do we have an earlier reading for how hot and busy the graphics processor is?',
    expected:'runtime',
    results:[
      {cellId:'runtime',type:'javascript',title:'Accelerator telemetry',output:{summary:'Thermal reading and utilization percentage for compute device.'}},
      {cellId:'garden',type:'markdown',title:'Perennials',output:{summary:'Plant guild notes.'}},
      {cellId:'audio',type:'javascript',title:'Mixer',output:{summary:'Gain staging.'}},
      {cellId:'recipe',type:'markdown',title:'Kitchen',output:{summary:'Fermentation timing.'}},
      {cellId:'calendar',type:'parameters',title:'Dates',output:{summary:'Scheduled events.'}}
    ]
  },
  {
    id:'paraphrase-responsive',group:'paraphrase',
    prompt:'Which check tells us whether the phone page spills sideways off the screen?',
    expected:'responsive',
    results:[
      {cellId:'responsive',type:'javascript',title:'Viewport containment',output:{summary:'Horizontal layout bounds at narrow widths.'}},
      {cellId:'memory',type:'markdown',title:'Recall',output:{summary:'Prior episode retrieval.'}},
      {cellId:'finance',type:'parameters',title:'Cash',output:{summary:'Monthly expenses.'}},
      {cellId:'model',type:'markdown',title:'Weights',output:{summary:'Local inference assets.'}},
      {cellId:'soil',type:'python',title:'Field chemistry',output:{summary:'pH result.'}}
    ]
  },
  {
    id:'paraphrase-continuity',group:'paraphrase',
    prompt:'Can it remember the useful result from an earlier visit after the browser was reopened?',
    expected:'continuity',
    results:[
      {cellId:'continuity',type:'markdown',title:'Longitudinal state',output:{summary:'Persisted episodic evidence restored after restart.'}},
      {cellId:'weather',type:'parameters',title:'Forecast',output:{summary:'Rain chance.'}},
      {cellId:'geometry',type:'python',title:'Vectors',output:{summary:'Coordinate calculation.'}},
      {cellId:'swarm',type:'markdown',title:'Pairing',output:{summary:'Device invitation.'}},
      {cellId:'color',type:'javascript',title:'Hue values',output:{summary:'Palette export.'}}
    ]
  }
]);

function mean(values){return values.length?values.reduce((sum,value)=>sum+value,0)/values.length:0}
function group(rows,name){return rows.filter(row=>row.group===name)}
function aggregate(rows,strategy){
  const selected=rows.map(row=>row[strategy]);
  return {
    recall:mean(selected.map(result=>result.hit?1:0)),
    meanSelectedBytes:mean(selected.map(result=>result.selectedBytes)),
    meanSelectedCount:mean(selected.map(result=>result.selectedCount)),
    maxSelectedBytes:Math.max(0,...selected.map(result=>result.selectedBytes))
  };
}

export function runContextSelectionBenchmark({tasks=CONTEXT_BENCHMARK_TASKS,budgetBytes=520,maxItems=2}={}){
  const rows=tasks.map(task=>{
    const evaluate=strategy=>{
      const selection=selectPreviousResults({query:task.prompt,results:task.results,strategy,budgetBytes,maxItems});
      return {
        hit:selection.results.some(result=>result.cellId===task.expected),
        selectedIds:selection.results.map(result=>result.cellId),
        selectedBytes:selection.selectedBytes,
        selectedCount:selection.selectedCount,
        candidateCount:selection.candidateCount,
        omittedCount:selection.omittedCount,
        budgetApplied:selection.budgetApplied
      };
    };
    return {id:task.id,group:task.group,expected:task.expected,relevant:evaluate('relevant'),recent:evaluate('recent'),all:evaluate('all')};
  });
  const lexical=group(rows,'lexical');const paraphrase=group(rows,'paraphrase');
  const relevant=aggregate(rows,'relevant');const all=aggregate(rows,'all');
  return {
    format:BENCHMARK_FORMAT,
    config:{budgetBytes,maxItems,taskCount:rows.length},
    rows,
    dimensions:{
      lexical:{relevant:aggregate(lexical,'relevant'),recent:aggregate(lexical,'recent'),all:aggregate(lexical,'all')},
      paraphrase:{relevant:aggregate(paraphrase,'relevant'),recent:aggregate(paraphrase,'recent'),all:aggregate(paraphrase,'all')},
      overall:{relevant,recent:aggregate(rows,'recent'),all},
      byteRatioToAll:all.meanSelectedBytes?relevant.meanSelectedBytes/all.meanSelectedBytes:1,
      byteReduction:all.meanSelectedBytes?1-(relevant.meanSelectedBytes/all.meanSelectedBytes):0
    }
  };
}
