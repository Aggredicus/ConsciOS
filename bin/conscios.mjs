#!/usr/bin/env node
import { createInterface } from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';
import { createKernel } from '../src/kernel.mjs';
import { executeCommand } from '../src/commands.mjs';
const kernel=createKernel();
const args=process.argv.slice(2);
async function run(line){const result=await executeCommand(line,{kernel});if(result.text)console.log(result.text);return result}
if(args.length){await run(args.join(' '));process.exit(0)}
console.log('ConsciOS Rebuild 1');
console.log('Type "help" for commands or "man consciousness" for the research objective.\n');
const rl=createInterface({input,output,terminal:true});
while(true){const line=await rl.question('conscios> ');const result=await run(line);if(result.exit)break}
rl.close();
