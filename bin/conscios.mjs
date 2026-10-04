#!/usr/bin/env node
import { createInterface } from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';
import { createKernel } from '../src/kernel.mjs';
import { createResearchLab } from '../src/lab.mjs';
import { executeCommand } from '../src/commands.mjs';

const kernel=createKernel();
const lab=createResearchLab({kernel,defaultApiKey:process.env.CONSCIOS_API_KEY??''});
const args=process.argv.slice(2);

async function run(line){
  const result=await executeCommand(line,{
    kernel,lab,
    onExperimentProgress:event=>{
      if(event.phase==='complete')console.log(`[${event.condition}] ${event.index}/${event.total} ${event.dimension}: ${event.value.toFixed(3)}`);
    }
  });
  if(result.text)console.log(result.text);
  return result;
}
if(args.length){await run(args.join(' '));process.exit(0)}
console.log('ConsciOS Rebuild 1 — comparative consciousness research shell');
console.log('Type "help" or "man experiments".\n');
const rl=createInterface({input,output,terminal:true});
while(true){const line=await rl.question('conscios> ');const result=await run(line);if(result.exit)break}
rl.close();
