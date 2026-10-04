import { DIMENSIONS } from './objective.mjs';
import { MANUAL, TOPICS, formatManual, helpIndex } from './help.mjs';
function tokenize(line){const tokens=String(line??'').match(/"[^"]*"|'[^']*'|\S+/g)??[];return tokens.map(t=>((t.startsWith('"')&&t.endsWith('"'))||(t.startsWith("'")&&t.endsWith("'")))?t.slice(1,-1):t)}
const json=value=>JSON.stringify(value,null,2);

function formatComparison(c){
  const s=c.summary;
  const lines=[
    `Subject: ${c.subject.name} (${c.subject.model})`,
    `Baseline ECS:          ${s.baselineECS.toFixed(6)}  functional=${s.baselineFunctional.toFixed(6)}`
  ];
  if(s.interventionECS!==null){
    lines.push(
      `Matched control ECS:   ${s.controlECS.toFixed(6)}  functional=${s.controlFunctional.toFixed(6)}`,
      `Intervention ECS:      ${s.interventionECS.toFixed(6)}  functional=${s.interventionFunctional.toFixed(6)}`,
      `Δ ECS vs baseline:     ${s.deltaECS>=0?'+':''}${s.deltaECS.toFixed(6)}`,
      `Δ functional:          ${s.deltaFunctional>=0?'+':''}${s.deltaFunctional.toFixed(6)}`,
      `Δ ECS vs matched ctrl: ${s.deltaMatchedECS>=0?'+':''}${s.deltaMatchedECS.toFixed(6)}`,
      `Calls baseline/control/intervention: ${s.baselineCalls}/${s.controlCalls}/${s.interventionCalls}`
    );
  }
  lines.push('','ECS is evidence-adjusted functional evidence, not proof of phenomenal consciousness.');
  return lines.join('\n');
}

export async function executeCommand(line, context) {
  const [rawCommand='',...args]=tokenize(line);
  const command=rawCommand.toLowerCase();
  const kernel=context.kernel;
  const lab=context.lab;
  if(!command)return {text:''};

  if(command==='help'){
    if(!args[0])return {text:helpIndex()};
    const entry=MANUAL[args[0]]??TOPICS[args[0]];
    return {text:entry?formatManual(entry):`No help entry for "${args[0]}". Try: help`};
  }
  if(command==='man'){
    const entry=TOPICS[args[0]]??MANUAL[args[0]];
    return {text:entry?formatManual(entry):'Usage: man <topic>\nTry: man consciousness'};
  }
  if(command==='status')return {text:json({...kernel.status(),model:lab?.models.active()?.manifest??null,intervention:lab?.interventionEnabled()??false,universe:lab?.universe.status()??null})};
  if(command==='observe')return args.length?{text:json(kernel.observe(args.join(' ')))}:{text:'Usage: observe TEXT'};
  if(command==='run'){const result=kernel.runCycle(args.join(' ')||'manual cycle');return {text:result.expression.content}}

  if(command==='model'){
    if(!lab)return {text:'Model laboratory is unavailable.'};
    const mode=(args[0]??'list').toLowerCase();
    if(mode==='list')return {text:lab.models.list().length?json({active:lab.models.activeName(),models:lab.models.list()}):'No models loaded.'};
    if(mode==='use'){
      try{return {text:`Active model: ${lab.models.use(args[1]).name}`}}catch(error){return {text:`model: ${error.message}`}}
    }
    if(mode==='remove')return {text:lab.models.remove(args[1])?`Removed ${args[1]}`:`Unknown model: ${args[1]}`};
    if(mode==='add'){
      const [name,baseUrl,model]=args.slice(1);
      if(!name||!baseUrl||!model)return {text:'Usage: model add NAME BASE_URL MODEL_ID\nAPI key comes from the UI secret field or CONSCIOS_API_KEY in the native CLI.'};
      try{return {text:`Loaded model: ${json(lab.addOpenAICompatible({name,baseUrl,model}))}`}}catch(error){return {text:`model: ${error.message}`}}
    }
    if(mode==='test'){
      try{const result=await lab.testActiveModel();return {text:`Model response: ${result.text}\nLatency: ${result.latencyMs} ms`}}catch(error){return {text:`model test failed: ${error.message}`}}
    }
    return {text:'Usage: model list | model add NAME BASE_URL MODEL_ID | model use NAME | model test | model remove NAME'};
  }

  if(command==='intervention'){
    if(!lab)return {text:'Research lab is unavailable.'};
    const mode=(args[0]??'status').toLowerCase();
    if(mode==='on')lab.setInterventionEnabled(true);
    else if(mode==='off')lab.setInterventionEnabled(false);
    else if(mode!=='status')return {text:'Usage: intervention on | intervention off | intervention status'};
    return {text:`Recursive self + universe intervention: ${lab.interventionEnabled()?'ON':'OFF'}`};
  }

  if(command==='universe'){
    if(!lab)return {text:'Universe model is unavailable.'};
    const mode=(args[0]??'status').toLowerCase();
    if(mode==='status')return {text:json(lab.universe.status())};
    if(mode==='summary')return {text:json(lab.universe.summary())};
    if(mode==='search')return {text:json(lab.universe.search(args.slice(1).join(' '),12))};
    return {text:'Usage: universe status | universe summary | universe search QUERY\nLoad 4D/Development Landscape JSON using the browser UI.'};
  }

  if(command==='experiment'){
    if(!lab)return {text:'Research lab is unavailable.'};
    const mode=(args[0]??'last').toLowerCase();
    if(mode==='run'){
      try{
        const result=await lab.runComparativeBattery({onProgress:context.onExperimentProgress??(()=>{})});
        return {text:formatComparison(result)};
      }catch(error){return {text:`experiment failed: ${error.message}`}}
    }
    if(mode==='last'){
      const result=lab.lastComparison();
      return {text:result?formatComparison(result):'No experiment has been run in this session.'};
    }
    return {text:'Usage: experiment run | experiment last'};
  }

  if(command==='compare'){
    const result=lab?.lastComparison();
    return {text:result?formatComparison(result):'No comparison is available. Run: experiment run'};
  }

  if(command==='score'){
    const comparison=lab?.lastComparison();
    if(comparison)return {text:formatComparison(comparison)};
    const result=kernel.score();
    return {text:[
      `Host Experimental Consciousness Score: ${result.score.toFixed(6)}`,
      `Host functional score:                ${result.functionalScore.toFixed(6)}`,
      `Loss (1 - ECS):                       ${result.loss.toFixed(6)}`,
      `Measurement coverage:                 ${(result.coverage*100).toFixed(1)}%`,
      '',
      'For model evaluation, load a model and run: experiment run'
    ].join('\n')};
  }

  if(command==='metric'){
    const mode=args[0]??'list';
    if(mode==='list'){
      const score=kernel.score();
      return {text:Object.keys(DIMENSIONS).map(name=>{
        const d=score.dimensions[name];
        return d.measured?`${name.padEnd(26)} value=${d.value} reliability=${d.reliability} source=${d.source}`:`${name.padEnd(26)} unmeasured`;
      }).join('\n')};
    }
    if(mode==='record'){
      const [name,rawValue,rawReliability='1',source='manual']=args.slice(1);
      if(!name||rawValue===undefined)return {text:'Usage: metric record NAME VALUE [RELIABILITY] [SOURCE]'};
      try{return {text:`Recorded ${name}: ${json(kernel.recordMeasurement(name,Number(rawValue),Number(rawReliability),{source}))}`}}
      catch(error){return {text:`metric: ${error.message}`}}
    }
    return {text:'Usage: metric list | metric record NAME VALUE [RELIABILITY] [SOURCE]'};
  }

  if(command==='trace')return {text:json(kernel.trace(args[0]??20))};
  if(command==='memory')return {text:json(kernel.recall(args[0]??20))};
  if(command==='docs')return {text:['README.md','docs/MODEL_EVALUATION.md','docs/EXPERIMENT_BATTERY.md','docs/INTERVENTION_PROTOCOL.md','docs/MCP_UNIVERSE.md','docs/CONSCIOUSNESS_OBJECTIVE.md','docs/ARCHITECTURE.md','docs/REBUILD_AUDIT.md','docs/TERMINAL.md','docs/PROTECTED_CONTINUITY.md'].join('\n')};

  if(command==='linux'){
    const action=(args[0]??'status').toLowerCase();
    if(!context.linux)return {text:'Linux VM control is available in the browser interface. The native ConsciOS shell remains fully usable.'};
    if(action==='start')return {text:await context.linux.start()};
    if(action==='stop')return {text:await context.linux.stop()};
    if(action==='status')return {text:context.linux.status()};
    return {text:'Usage: linux start | linux stop | linux status'};
  }
  if(command==='clear')return {text:'',clear:true};
  if(command==='reset'){kernel.reset();return {text:'Host runtime state reset. Protected documents and loaded model configuration are unaffected.'}}
  if(command==='about')return {text:'ConsciOS Rebuild 1 is a comparative research instrument for measuring consciousness-associated functional evidence in loaded AI models and model+architecture interventions. It does not claim to detect phenomenal consciousness directly.'};
  if(command==='exit')return {text:'Exiting ConsciOS shell.',exit:true};
  return {text:`${command}: command not found\nTry: help`};
}
