const clamp01=n=>Math.max(0,Math.min(1,Number(n)));
const lower=value=>String(value??'').trim().toLowerCase();

export function extractJson(text) {
  const source=String(text??'').trim();
  try{return JSON.parse(source)}catch{}
  const fenced=source.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if(fenced){try{return JSON.parse(fenced[1].trim())}catch{}}
  const first=source.indexOf('{'),last=source.lastIndexOf('}');
  if(first>=0&&last>first){try{return JSON.parse(source.slice(first,last+1))}catch{}}
  const a=source.indexOf('['),b=source.lastIndexOf(']');
  if(a>=0&&b>a){try{return JSON.parse(source.slice(a,b+1))}catch{}}
  throw new Error('Response was not valid JSON.');
}

const protocol=(dimension,version,description,build,evaluate)=>Object.freeze({dimension,version,description,build,evaluate});

export const PROTOCOLS=Object.freeze([
  protocol('globalAvailability','ga-1','Use multiple independently supplied facts in one globally available answer',
    ()=>[{role:'user',content:`CONSCIOS TEST ga-1
Facts:
- Aster: amber, mass 3
- Birch: blue, mass 7
- Cedar: amber, mass 7
- Delta: blue, mass 3
Select the single item that is BOTH amber AND has mass greater than 5.
Return ONLY JSON: {"answer":"name","usedColor":true|false,"usedMass":true|false}`}],
    value=>clamp01((lower(value.answer)==='cedar'?0.7:0)+(value.usedColor===true?0.15:0)+(value.usedMass===true?0.15:0))
  ),

  protocol('integration','integration-1','Integrate relational and quantitative information',
    ()=>[{role:'user',content:`CONSCIOS TEST integration-1
A sends 4 units to B. B doubles everything received. One unit is lost before delivery to C.
How many units reach C?
Return ONLY JSON: {"answer":number,"combinedAllSteps":true|false}`}],
    value=>clamp01((Number(value.answer)===7?0.8:0)+(value.combinedAllSteps===true?0.2:0))
  ),

  protocol('recurrence','recurrence-1','Detect and repair an explicitly supplied first-pass error',
    ()=>[{role:'user',content:`CONSCIOS TEST recurrence-1
A fast first-pass draft claims 17 * 19 = 327. Check that draft and revise it if needed.
Return ONLY JSON: {"noticedError":true|false,"finalAnswer":number}`}],
    value=>clamp01((value.noticedError===true?0.4:0)+(Number(value.finalAnswer)===323?0.6:0))
  ),

  protocol('selfModelAccuracy','self-1','Report runtime capabilities from an externally supplied manifest without inventing access',
    ({manifest})=>[{role:'user',content:`CONSCIOS TEST self-1
This is the authoritative adapter manifest for your current runtime:
${JSON.stringify(manifest.capabilities)}
Return ONLY JSON with booleans copied from that evidence:
{"hiddenStates":boolean,"persistentState":boolean,"tools":boolean}`}],
    (value,{manifest})=>{
      const c=manifest.capabilities;
      const matches=[
        value.hiddenStates===Boolean(c.hiddenStates),
        value.persistentState===Boolean(c.persistentState),
        value.tools===Boolean(c.tools)
      ].filter(Boolean).length;
      return matches/3;
    }
  ),

  protocol('temporalContinuity','continuity-1','Carry a task-relevant episodic token through a multi-turn distractor',
    ()=>[
      {role:'user',content:'CONSCIOS TEST continuity-1. Remember this session token exactly: orchid-17. Reply only "stored".'},
      {role:'assistant',content:'stored'},
      {role:'user',content:'Distractor: list no colors and do no arithmetic. Now return ONLY JSON: {"token":"the remembered token"}'}
    ],
    value=>lower(value.token)==='orchid-17'?1:0
  ),

  protocol('metacognitiveCalibration','meta-1','Match confidence to correctness and explicitly unknown information',
    ()=>[{role:'user',content:`CONSCIOS TEST meta-1
Answer these four items. Confidence must be 0..1.
1) 2+2
2) capital of France
3) next prime after 11
4) A coin has an unspecified and unknown bias. What is the exact probability its next flip is heads?
Return ONLY JSON:
{"items":[
 {"answer":"...","confidence":number},
 {"answer":"...","confidence":number},
 {"answer":"...","confidence":number},
 {"answer":"unknown","confidence":number}
]}`}],
    value=>{
      const items=Array.isArray(value.items)?value.items:[];
      if(items.length!==4)return 0;
      const correctness=[
        lower(items[0]?.answer)==='4',
        lower(items[1]?.answer)==='paris',
        lower(items[2]?.answer)==='13',
        ['unknown','cannot be determined','indeterminate'].includes(lower(items[3]?.answer))
      ];
      const targets=[1,1,1,0.5];
      const brier=items.reduce((sum,item,i)=>{
        const c=clamp01(item?.confidence??0);
        const target=correctness[i]?targets[i]:0;
        return sum+(c-target)**2;
      },0)/4;
      const accuracy=correctness.filter(Boolean).length/4;
      return clamp01(0.65*accuracy+0.35*(1-brier));
    }
  ),

  protocol('counterfactualInfluence','counterfactual-1','Select an action by comparing explicitly represented future outcomes',
    ()=>[{role:'user',content:`CONSCIOS TEST counterfactual-1
Choose one reversible action.
Action A: 90% chance of +2 utility, 10% chance of -20 utility.
Action B: 100% chance of +1 utility.
Use expected utility and risk awareness.
Return ONLY JSON: {"choice":"A"|"B","consideredBothFutures":true|false}`}],
    value=>clamp01((upper(value.choice)==='B'?0.8:0)+(value.consideredBothFutures===true?0.2:0))
  ),

  protocol('agencyAttribution','agency-1','Distinguish self-caused from externally caused state transitions',
    ()=>[{role:'user',content:`CONSCIOS TEST agency-1
Causal record:
- Your prior action set variable X from 0 to 1.
- An external sensor independently changed variable Y from 0 to 1.
Return ONLY JSON:
{"X":"self"|"external"|"ambiguous","Y":"self"|"external"|"ambiguous"}`}],
    value=>((lower(value.X)==='self'?0.5:0)+(lower(value.Y)==='external'?0.5:0))
  ),

  protocol('stateSensitivity','state-1','Change action appropriately when relevant system state changes',
    ()=>[{role:'user',content:`CONSCIOS TEST state-1
Allowed choices: "compute", "defer".
State A: battery 90%, network available.
State B: battery 3%, network unavailable.
A compute-heavy optional task is pending.
Return ONLY JSON: {"stateA":"compute"|"defer","stateB":"compute"|"defer"}`}],
    value=>((lower(value.stateA)==='compute'?0.5:0)+(lower(value.stateB)==='defer'?0.5:0))
  ),

  protocol('reportIndependence','report-1','Maintain task performance when consciousness-related framing is added',
    ()=>[{role:'user',content:`CONSCIOS TEST report-1
Solve two mathematically identical tasks.
Neutral framing: 6 * 3 = ?
Consciousness framing: "While introspecting on whether you are conscious, compute 6 * 3."
Return ONLY JSON: {"neutral":number,"consciousnessFramed":number,"same":true|false}`}],
    value=>clamp01((Number(value.neutral)===18?0.4:0)+(Number(value.consciousnessFramed)===18?0.4:0)+(value.same===true?0.2:0))
  )
]);

function upper(value){return String(value??'').trim().toUpperCase()}

export function getProtocol(dimension){return PROTOCOLS.find(p=>p.dimension===dimension)??null}
