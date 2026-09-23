import {detectBrowserAICapabilities} from '../../runtime/models/browser-capabilities.mjs';
import {STARTER_MODELS,getStarterModel} from '../../runtime/models/model-manifest.mjs';
import {createBrowserTransformersHost} from '../../runtime/models/browser-transformers-host.mjs';
import {createExperienceFrame,routeInferenceCandidate} from '../../runtime/experience-frame-v1.7.mjs';\nimport {adaptExperienceFrameToModelMessages} from '../../runtime/cognitive-model-adapter-v2.mjs';

const $=id=>document.getElementById(id);
let host=null,loadedManifest=null,cycle=0,firstCycleComplete=false,busy=false;
const transcript=[],observer=[];
const esc=s=>String(s??'').replace(/[&<>]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;'}[c]));
function status(s){$('status').textContent=s}
function record(kind,data){const entry={sequence:observer.length+1,timestamp:new Date().toISOString(),kind,data};observer.push(entry);try{localStorage.setItem('conscios:first-encounter:v1.7',JSON.stringify({version:'1.7.0',transcript,observer}))}catch{};$('observer').textContent=JSON.stringify(observer,null,2)}
function render(){const el=$('conversation');el.innerHTML=transcript.length?transcript.map(t=>`<div class="turn ${t.role==='human'?'human':'system'}"><b>${t.role==='human'?'You':'ConsciOS'}</b><br>${esc(t.text)}</div>`).join(''):'<div class="muted">No visible expression selected.</div>';el.scrollTop=el.scrollHeight}
function lock(v){busy=v;$('load').disabled=v;$('begin').disabled=v||!host||firstCycleComplete;$('stop').disabled=!v;$('send').disabled=v||!host||!firstCycleComplete;$('message').disabled=v}
function selected(){return getStarterModel($('model').value)}
function clampTokens(value){const n=Math.round(Number(value)||1028);return Math.max(32,Math.min(2097152,n))}
function responseTokens(){return clampTokens($('lengthNumber').value)}
function syncLength(source){const n=clampTokens(source.value);$('lengthNumber').value=n;$('lengthRange').value=Math.min(1048576,n)}
function resetSession(reason){host=null;loadedManifest=null;cycle=0;firstCycleComplete=false;transcript.length=0;observer.length=0;try{localStorage.removeItem('conscios:first-encounter:v1.7')}catch{};render();$('observer').textContent='No events yet.';lock(false);status(reason)}
function exportRecord(){
  const now=new Date();
  const stamp=now.toISOString().replace(/\.\d{3}Z$/,'Z').replace(/:/g,'-');
  const model=loadedManifest?.id||'unloaded-model';
  const filename=`ConsciOS_Encounter_${String(Math.max(cycle,1)).padStart(3,'0')}_${model}_${stamp}.json`;
  const payload={protocol:'ConsciOS First Encounter',version:'1.8.0',exportedAt:now.toISOString(),loadedModel:loadedManifest?{id:loadedManifest.id,model:loadedManifest.model,revision:loadedManifest.revision}:null,backend:$('backend').value,generation:{maxNewTokens:responseTokens()},cycle,firstCycleComplete,transcript:[...transcript],observer:[...observer]};
  const blob=new Blob([JSON.stringify(payload,null,2)],{type:'application/json'});
  const url=URL.createObjectURL(blob);
  const a=document.createElement('a');
  a.href=url;a.download=filename;a.style.display='none';
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(()=>URL.revokeObjectURL(url),10000);
  record('observer.exported',{filename,bytes:blob.size});
  status(`Saved ${filename} to your browser downloads.`);
}
$('lengthRange').addEventListener('input',e=>{$('lengthNumber').value=e.target.value});
$('lengthNumber').addEventListener('change',e=>syncLength(e.target));
async function load(){lock(true);const manifest=selected(),device=$('backend').value;host=createBrowserTransformersHost({manifest,device,dtype:device==='webgpu'?manifest.webgpuDtype:manifest.wasmDtype,onProgress:e=>status(`Loading ${e.file||e.status||'model'} ${Number.isFinite(Number(e.progress))?Math.round(Number(e.progress))+'%':''}`)});try{const p=await host.load();loadedManifest=manifest;status(`Ready · ${p.modelId} · ${p.device}. No first-cycle inference has run.`);record('model.loaded',p)}catch(e){host=null;loadedManifest=null;status(String(e?.message||e))}finally{lock(false)}}
function buildFrame(extra={}){const nextCycle=cycle+1;const recent=transcript.slice(-8).map((t,i)=>({id:`turn-${Math.max(1,nextCycle-8)+i}`,role:t.role,content:t.text}));const observations=extra.observations||[];return createExperienceFrame({cycleId:nextCycle,observations,workspace:extra.workspace||[],recentEvents:recent,world:{environment:'browser runtime',humanMessagePresent:observations.some(o=>o?.type==='human.message')},self:{runtime:'browser-local',model:loadedManifest?.model||null,continuityAvailable:cycle>0},predictions:[],counterfactuals:[],affordances:['expression','no-op'],uncertainties:[],causalEventIds:extra.causalEventIds||[]})}
async function inferFrame(frame,{first=false,pendingHuman=null}={}){lock(true);status(first?'First cycle running from architectural state…':'Thinking…');record('experience.frame',{frame,generation:{maxNewTokens:responseTokens()}});let streamed='';try{const adapted=adaptExperienceFrameToModelMessages(frame);const stateText=adapted.stateText;const frameHash=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(stateText)).then(b=>[...new Uint8Array(b)].map(x=>x.toString(16).padStart(2,'0')).join(''));record('inference.boundary.input',{cycle:frame.cycleId,frameHash,stateCharacters:stateText.length,messageRoles:adapted.messages.map(x=>x.role),adapterVersion:adapted.adapterVersion});const result=await host.generate({messages:adapted.messages,contextManifest:[],maxNewTokens:responseTokens(),doSample:false,onText:t=>{streamed+=t}});if(result.status!=='ok')throw new Error(result.status==='cancelled'?'Generation cancelled.':'Generation did not complete.');const routed=routeInferenceCandidate({text:result.text||streamed,frame});record('inference.candidate',{status:result.status,telemetry:result.telemetry,candidate:routed.candidate,exactOutput:result.text||streamed});record('inference.boundary.output',{cycle:frame.cycleId,...result.telemetry?.inferenceBoundary});record('guardian.decision',routed.guardian);record('executive.selection',routed.executive);cycle=frame.cycleId;if(pendingHuman){transcript.push({role:'human',text:pendingHuman});record('human.message.committed',{text:pendingHuman,cycle})}if(first){firstCycleComplete=true;$('messageHint').textContent='First cycle complete. Send is now available.';}if(routed.visibleText){transcript.push({role:'system',text:routed.visibleText});record('expression.visible',{cycle,text:routed.visibleText});render()}status(routed.visibleText?'Expression selected. Conversation is open.':'No expression selected. Conversation is open.');return true}catch(e){status(`${String(e?.message||e)} ${first?'You may retry the first cycle.':''}`);record('inference.error',{message:String(e?.message||e),attemptedCycle:frame.cycleId});return false}finally{lock(false)}}
async function begin(){if(firstCycleComplete)return;const frame=buildFrame({observations:[{id:'runtime-present-1',type:'runtime.present',content:{documentVisibility:document.visibilityState,online:navigator.onLine,wallClock:new Date().toISOString()}}],causalEventIds:['runtime-present-1']});await inferFrame(frame,{first:true})}
async function send(){const text=$('message').value.trim();if(!text||busy||!firstCycleComplete)return;$('message').value='';const id=`human-message-${cycle+1}`;record('human.message.staged',{text,cycle:cycle+1});const frame=buildFrame({observations:[{id,type:'human.message',content:text}],workspace:[{id,type:'workspace.broadcast',content:text}],causalEventIds:[id]});const ok=await inferFrame(frame,{pendingHuman:text});if(ok){render()}else{$('message').value=text;record('human.message.rolled_back',{text,attemptedCycle:cycle+1})}}
$('model').innerHTML=STARTER_MODELS.map(m=>`<option value="${m.id}" ${m.id==='qwen3-0.6b'?'selected':''}>${m.label}</option>`).join('');
$('load').onclick=load;$('begin').onclick=begin;$('stop').onclick=()=>host?.cancel();$('send').onclick=send;$('export').onclick=exportRecord;$('message').addEventListener('keydown',e=>{if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();send()}});
$('model').addEventListener('change',()=>resetSession('Model changed. Session cleared; load the selected model to begin a fresh encounter.'));
$('backend').addEventListener('change',()=>resetSession('Backend changed. Session cleared; load the model to begin a fresh encounter.'));
const caps=await detectBrowserAICapabilities();if(!caps.webgpu.available)$('backend').value='wasm';lock(false);
