import { DIMENSIONS } from './objective.mjs';
import { MANUAL, TOPICS, formatManual, helpIndex } from './help.mjs';
function tokenize(line){const tokens=String(line??'').match(/"[^"]*"|'[^']*'|\S+/g)??[];return tokens.map(t=>((t.startsWith('"')&&t.endsWith('"'))||(t.startsWith("'")&&t.endsWith("'")))?t.slice(1,-1):t)}
const json=value=>JSON.stringify(value,null,2);

export async function executeCommand(line, context) {
  const [rawCommand='',...args]=tokenize(line);
  const command=rawCommand.toLowerCase();
  const kernel=context.kernel;
  if(!command) return {text:''};

  if(command==='help'){
    if(!args[0]) return {text:helpIndex()};
    const entry=MANUAL[args[0]]??TOPICS[args[0]];
    return {text:entry?formatManual(entry):`No help entry for "${args[0]}". Try: help`};
  }
  if(command==='man'){
    const entry=TOPICS[args[0]]??MANUAL[args[0]];
    return {text:entry?formatManual(entry):'Usage: man <topic>\nTry: man consciousness'};
  }
  if(command==='status') return {text:json(kernel.status())};
  if(command==='observe') return args.length?{text:json(kernel.observe(args.join(' ')))}:{text:'Usage: observe TEXT'};
  if(command==='run'){const result=kernel.runCycle(args.join(' ')||'manual cycle');return {text:result.expression.content}}
  if(command==='score'){
    const result=kernel.score();
    return {text:[
      `Experimental Consciousness Score: ${result.score.toFixed(6)}`,
      `Loss (1 - ECS):                  ${result.loss.toFixed(6)}`,
      `Measurement coverage:            ${(result.coverage*100).toFixed(1)}%`,
      '',
      'This is an operational architecture score, not proof of phenomenal consciousness.'
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
      if(!name||rawValue===undefined) return {text:'Usage: metric record NAME VALUE [RELIABILITY] [SOURCE]'};
      try{return {text:`Recorded ${name}: ${json(kernel.recordMeasurement(name,Number(rawValue),Number(rawReliability),{source}))}`}}
      catch(error){return {text:`metric: ${error.message}`}}
    }
    return {text:'Usage: metric list | metric record NAME VALUE [RELIABILITY] [SOURCE]'};
  }
  if(command==='trace') return {text:json(kernel.trace(args[0]??20))};
  if(command==='memory') return {text:json(kernel.recall(args[0]??20))};
  if(command==='docs') return {text:['README.md','docs/ARCHITECTURE.md','docs/REBUILD_AUDIT.md','docs/CONSCIOUSNESS_OBJECTIVE.md','docs/TERMINAL.md','docs/PROTECTED_CONTINUITY.md'].join('\n')};
  if(command==='linux'){
    const action=(args[0]??'status').toLowerCase();
    if(!context.linux) return {text:'Linux VM control is available in the browser interface. The native ConsciOS shell remains fully usable.'};
    if(action==='start') return {text:await context.linux.start()};
    if(action==='stop') return {text:await context.linux.stop()};
    if(action==='status') return {text:context.linux.status()};
    return {text:'Usage: linux start | linux stop | linux status'};
  }
  if(command==='clear') return {text:'',clear:true};
  if(command==='reset'){kernel.reset();return {text:'Runtime state reset. Protected repository documents are unaffected.'}}
  if(command==='about') return {text:'ConsciOS Rebuild 1 is a minimal, transparent research kernel for testing consciousness-associated computational functions. It makes no claim that its current runtime is phenomenally conscious.'};
  if(command==='exit') return {text:'Exiting ConsciOS shell.',exit:true};
  return {text:`${command}: command not found\nTry: help`};
}
