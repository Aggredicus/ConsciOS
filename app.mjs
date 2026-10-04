import { createKernel } from './src/kernel.mjs';
import { createResearchLab } from './src/lab.mjs';
import { executeCommand } from './src/commands.mjs';
import { createLinuxController } from './src/linux-v86.mjs';

const $=id=>document.getElementById(id);
const output=$('output'),command=$('command'),prompt=$('prompt'),stateBadge=$('state');
let initialState=null,initialResults=[];
try{const saved=localStorage.getItem('conscios-rebuild-1-state');if(saved)initialState=JSON.parse(saved)}catch{}
try{const saved=localStorage.getItem('conscios-rebuild-1-results');if(saved)initialResults=JSON.parse(saved)}catch{}
const kernel=createKernel(initialState);
const lab=createResearchLab({kernel,initialResults});
const linux=createLinuxController({output:$('linux-output'),input:$('linux-input'),panel:$('linux-panel')});
const history=[];let historyIndex=0;

function write(text=''){output.textContent+=text;if(!text.endsWith('\n'))output.textContent+='\n';output.scrollTop=output.scrollHeight}
function persist(){
  try{localStorage.setItem('conscios-rebuild-1-state',JSON.stringify(kernel.snapshot()))}catch{}
  try{localStorage.setItem('conscios-rebuild-1-results',JSON.stringify(lab.results()))}catch{}
}
function refreshModelSelect(){
  const select=$('model-select'),current=lab.models.activeName()??'';
  const models=lab.models.list();
  select.innerHTML='<option value="">none</option>'+models.map(model=>`<option value="${model.name.replaceAll('"','&quot;')}">${model.name} · ${model.model}</option>`).join('');
  select.value=current;
}
function refresh(){
  const model=lab.models.active()?.manifest;
  stateBadge.textContent=model?`${model.name} · ${lab.interventionEnabled()?'intervention ON':'baseline'}`:'no model';
  const u=lab.universe.status();
  $('universe-state').textContent=u.loaded?`universe: ${u.nodes} nodes / ${u.edges} edges`:'universe: none';
  refreshModelSelect();
}
function showComparison(result){
  const s=result.summary;
  $('scoreboard').hidden=false;
  $('baseline-score').textContent=s.baselineECS.toFixed(3);
  $('control-score').textContent=s.controlECS===null?'—':s.controlECS.toFixed(3);
  $('intervention-score').textContent=s.interventionECS===null?'—':s.interventionECS.toFixed(3);
  $('delta-score').textContent=s.deltaECS===null?'—':`${s.deltaECS>=0?'+':''}${s.deltaECS.toFixed(3)}`;
}
async function run(line){
  const trimmed=line.trim();if(!trimmed)return;write(`conscios> ${trimmed}`);
  const result=await executeCommand(trimmed,{
    kernel,lab,linux,
    onExperimentProgress:event=>{if(event.phase==='complete')write(`[${event.condition}] ${event.index}/${event.total} ${event.dimension}: ${event.value.toFixed(3)}`)}
  });
  if(result.clear)output.textContent='';
  if(result.text)write(result.text);
  if(lab.lastComparison())showComparison(lab.lastComparison());
  persist();refresh();
}

prompt.addEventListener('submit',async event=>{event.preventDefault();const line=command.value;command.value='';if(!line.trim())return;history.push(line);historyIndex=history.length;await run(line)});
command.addEventListener('keydown',event=>{
  if(event.key==='ArrowUp'&&history.length){event.preventDefault();historyIndex=Math.max(0,historyIndex-1);command.value=history[historyIndex]??''}
  else if(event.key==='ArrowDown'&&history.length){event.preventDefault();historyIndex=Math.min(history.length,historyIndex+1);command.value=history[historyIndex]??''}
});

$('connect-model').addEventListener('click',()=>{
  try{
    const manifest=lab.addOpenAICompatible({name:$('model-name').value.trim(),baseUrl:$('model-url').value.trim(),model:$('model-id').value.trim(),apiKey:$('model-key').value});
    $('model-key').value='';write(`Loaded model ${manifest.name} -> ${manifest.model}`);refresh();
  }catch(error){write(`Model connection configuration failed: ${error.message}`)}
});
$('model-select').addEventListener('change',event=>{if(!event.target.value)return;try{lab.models.use(event.target.value);write(`Active model: ${event.target.value}`);refresh()}catch(error){write(error.message)}});
$('intervention-toggle').addEventListener('change',event=>{lab.setInterventionEnabled(event.target.checked);write(`Recursive self + universe intervention: ${event.target.checked?'ON':'OFF'}`);refresh()});

$('run-battery').addEventListener('click',async()=>{
  if(!lab.models.active()){write('Load a model before running the battery.');return}
  $('run-battery').disabled=true;write(`Running battery on ${lab.models.active().manifest.name}...`);
  try{
    const result=await lab.runComparativeBattery({onProgress:event=>{if(event.phase==='complete')write(`[${event.condition}] ${event.index}/${event.total} ${event.dimension}: ${event.value.toFixed(3)}`)}});
    showComparison(result);persist();write(`Battery complete: ${result.resultId}. Type "compare" or "results".`);
  }catch(error){write(`Battery failed: ${error.message}`)}
  finally{$('run-battery').disabled=false;refresh()}
});

$('export-results').addEventListener('click',()=>{
  const result=lab.lastComparison();
  if(!result){write('No experiment result to export.');return}
  const blob=new Blob([JSON.stringify(result,null,2)],{type:'application/json'});
  const url=URL.createObjectURL(blob),a=document.createElement('a');
  a.href=url;a.download=`${result.resultId}-${result.subject.name}-conscios.json`;a.click();
  setTimeout(()=>URL.revokeObjectURL(url),500);
});

$('universe-file').addEventListener('change',async event=>{
  const file=event.target.files?.[0];if(!file)return;
  try{const status=lab.universe.load(JSON.parse(await file.text()));write(`Loaded repository universe: ${status.nodes} nodes / ${status.edges} edges (${status.kind})`);refresh()}
  catch(error){write(`Universe import failed: ${error.message}`)}
  event.target.value='';
});

write('ConsciOS Rebuild 1 — comparative model consciousness laboratory');
write('Load one or more models, run standardized batteries, then compare results.');
write('The intervention checkbox adds the recursive self + bounded repository-universe treatment.');
write('Type "help" or "man experiments".\n');
if(lab.lastComparison())showComparison(lab.lastComparison());
refresh();
