import { createKernel } from './src/kernel.mjs';
import { executeCommand } from './src/commands.mjs';
import { createLinuxController } from './src/linux-v86.mjs';
const $=id=>document.getElementById(id);
const output=$('output'),command=$('command'),prompt=$('prompt'),stateBadge=$('state');
let initialState=null;
try{const saved=localStorage.getItem('conscios-rebuild-1-state');if(saved)initialState=JSON.parse(saved)}catch{}
const kernel=createKernel(initialState);
const linux=createLinuxController({output:$('linux-output'),input:$('linux-input'),panel:$('linux-panel')});
const history=[];let historyIndex=0;
function write(text=''){output.textContent+=text;if(!text.endsWith('\n'))output.textContent+='\n';output.scrollTop=output.scrollHeight}
function persist(){try{localStorage.setItem('conscios-rebuild-1-state',JSON.stringify(kernel.snapshot()))}catch{}}
function refreshStatus(){const status=kernel.status();stateBadge.textContent=`cycle ${status.cycle} · ECS ${status.experimentalScore.toFixed(3)}`}
async function run(line){
  const trimmed=line.trim();if(!trimmed)return;write(`conscios> ${trimmed}`);
  const result=await executeCommand(trimmed,{kernel,linux});
  if(result.clear)output.textContent='';if(result.text)write(result.text);persist();refreshStatus();
}
prompt.addEventListener('submit',async event=>{event.preventDefault();const line=command.value;command.value='';if(!line.trim())return;history.push(line);historyIndex=history.length;await run(line)});
command.addEventListener('keydown',event=>{
  if(event.key==='ArrowUp'&&history.length){event.preventDefault();historyIndex=Math.max(0,historyIndex-1);command.value=history[historyIndex]??''}
  else if(event.key==='ArrowDown'&&history.length){event.preventDefault();historyIndex=Math.min(history.length,historyIndex+1);command.value=history[historyIndex]??''}
});
write('ConsciOS Rebuild 1');
write('Protected constitutional continuity verified by repository CI.');
write('Type "help" for commands or "man consciousness" for the objective.\n');
refreshStatus();
