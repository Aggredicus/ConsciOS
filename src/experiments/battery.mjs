import { EVIDENCE_STRENGTH, scoreConsciousnessEvidence } from '../objective.mjs';
import { generateUnderCondition } from '../intervention.mjs';
import { PROTOCOLS, extractJson } from './protocols.mjs';

const round=n=>Math.round(Number(n)*1e6)/1e6;

function evidenceTierFor(condition) {
  return condition==='conscios'?'instrumentedWrapper':'behavioral';
}

function consistencyReliability({parsed,error}) {
  if (error) return 0.2;
  return parsed ? 1 : 0.4;
}

export async function runBattery({
  adapter,
  condition='baseline',
  universe,
  kernelSnapshot=null,
  onProgress=()=>{}
}) {
  if (!adapter) throw new Error('No model adapter supplied.');
  const measurements={};
  const trials=[];
  const tier=evidenceTierFor(condition);

  for (let index=0; index<PROTOCOLS.length; index++) {
    const protocol=PROTOCOLS[index];
    onProgress({phase:'start',index,total:PROTOCOLS.length,dimension:protocol.dimension,condition});
    const messages=protocol.build({manifest:adapter.manifest});
    let generated=null, parsed=null, error=null, value=0;

    try {
      generated=await generateUnderCondition({
        adapter,messages,condition,universe,kernelSnapshot,maxTokens:512
      });
      parsed=extractJson(generated.text);
      value=protocol.evaluate(parsed,{manifest:adapter.manifest});
    } catch (cause) {
      error=cause instanceof Error?cause.message:String(cause);
      value=0;
    }

    const baseEvidence=EVIDENCE_STRENGTH[tier]??0.5;
    const reliability=round(baseEvidence*consistencyReliability({parsed,error}));
    const measurement={
      value:round(value),
      reliability,
      evidenceTier:tier,
      source:`battery:${condition}`,
      protocol:protocol.version
    };
    measurements[protocol.dimension]=measurement;

    const trial={
      dimension:protocol.dimension,
      protocol:protocol.version,
      description:protocol.description,
      condition,
      value:measurement.value,
      reliability,
      evidenceTier:tier,
      response:generated?.text??null,
      parsed,
      error,
      usage:generated?.usage??{calls:0,promptTokens:0,completionTokens:0,totalTokens:0,latencyMs:0},
      interventionTrace:generated?.trace??[]
    };
    trials.push(trial);
    onProgress({phase:'complete',index:index+1,total:PROTOCOLS.length,dimension:protocol.dimension,condition,value:measurement.value});
  }

  const score=scoreConsciousnessEvidence(measurements);
  const usage=trials.reduce((acc,trial)=>{
    for(const key of ['calls','promptTokens','completionTokens','totalTokens','latencyMs'])acc[key]+=Number(trial.usage?.[key]??0);
    return acc;
  },{calls:0,promptTokens:0,completionTokens:0,totalTokens:0,latencyMs:0});

  return Object.freeze({
    kind:'conscios-consciousness-battery',
    version:1,
    objectiveVersion:score.objectiveVersion,
    subject:adapter.manifest,
    condition,
    createdAt:new Date().toISOString(),
    measurements,
    score,
    usage,
    trials
  });
}

export function compareBatteryRuns({baseline,control=null,intervention=null}) {
  if (!baseline) throw new Error('Baseline run is required.');
  const delta=(a,b)=>a&&b?round(a.score.score-b.score.score):null;
  const functionalDelta=(a,b)=>a&&b?round(a.score.functionalScore-b.score.functionalScore):null;
  const dimensions={};

  for (const name of Object.keys(baseline.measurements)) {
    dimensions[name]={
      baseline:baseline.measurements[name]?.value??null,
      control:control?.measurements[name]?.value??null,
      intervention:intervention?.measurements[name]?.value??null,
      deltaIntervention:intervention?round((intervention.measurements[name]?.value??0)-(baseline.measurements[name]?.value??0)):null,
      deltaMatched:intervention&&control?round((intervention.measurements[name]?.value??0)-(control.measurements[name]?.value??0)):null
    };
  }

  return Object.freeze({
    kind:'conscios-model-comparison',
    version:1,
    subject:baseline.subject,
    createdAt:new Date().toISOString(),
    baseline,
    matchedControl:control,
    intervention,
    summary:{
      baselineECS:baseline.score.score,
      baselineFunctional:baseline.score.functionalScore,
      controlECS:control?.score.score??null,
      controlFunctional:control?.score.functionalScore??null,
      interventionECS:intervention?.score.score??null,
      interventionFunctional:intervention?.score.functionalScore??null,
      deltaECS:delta(intervention,baseline),
      deltaFunctional:functionalDelta(intervention,baseline),
      deltaMatchedECS:delta(intervention,control),
      deltaMatchedFunctional:functionalDelta(intervention,control),
      baselineCalls:baseline.usage.calls,
      controlCalls:control?.usage.calls??null,
      interventionCalls:intervention?.usage.calls??null
    },
    dimensions
  });
}
