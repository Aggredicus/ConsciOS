import {detectBrowserAICapabilities} from '../../runtime/models/browser-capabilities.mjs';
import {STARTER_MODELS,getStarterModel} from '../../runtime/models/model-manifest.mjs';
import {createBrowserTransformersHost} from '../../runtime/models/browser-transformers-host.mjs';
import {createExperienceFrame,serializeExperienceFrame,routeInferenceCandidate} from '../../runtime/experience-frame-v1.7.mjs';

const $=id=>document.getElementById(id);
let host=null,cycle=0,busy=false;const transcript=[],observer=[];
const esc=s=>String(s??'').replace(/[&<>]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;'}[c]));
function status(s){$('status').textContent=s}
function record(kind,data){observer.push({sequence:observer.length+1,kind,data});$('observer').textContent=JSON.stringify(observer,null,2)}
function render(){const el=$('conversation');el.innerHTML=transcript.length?transcript.map(t=>`<div class="turn ${t.role==='human'?'human':'system'}"><b>${t.role==='human'?'You':'ConsciOS'}</b><br>${esc(t.text)}</div>`).join(''):'<div class="muted">No visible expression selected.</div>';el.scrollTop=el.scrollHeight}
function lock(v){busy=v;$('load').disabled=v;$('begin').disabled=v||!host||cycle>0;$('stop').disabled=!v;$('send').disabled=v||!host||cycle===0;$('message').disabled=v||!host||cycle===0}
function selected(){return getStarterModel($('model').value)}
function clampTokens(value){const n=Math.round(Number(value)||512);return Math.max(32,Math.min(65536,n))}
function responseTokens(){return clampTokens($('lengthNumber').value)}
function syncLength(source){const n=clampTokens(source.value);$('lengthNumber').value=n;$('lengthRange').value=Math.min(32768,n)}
$('lengthRange').addEventListener('input',e=>{$('lengthNumber').value=e.target.value});
$('lengthNumber').addEventListener('change',e=>syncLength(e.target));
async function load(){lock(true);const manifest=selected(),device=$('backend').value;host=createBrowserTransformersHost({manifest,device,dtype:device==='webgpu'?manifest.webgpuDtype:manifest.wasmDtype,onProgress:e=>status(`Loading ${e.file||e.status||'model'} ${Number.isFinite(Number(e.progress))?Math.round(Number(e.progress))+'%':''}`)});try{const p=await host.load();status(`Ready · ${p.modelId} · ${p.device}. No first-cycle inference has run.`);record('model.loaded',p)}catch(e){host=null;status(String(e?.message||e))}finally{lock(false)}}
function baseFrame(extra={}){cycle++;const recent=transcript.slice(-8).map((t,i)=>({id:`turn-${Math.max(1,cycle-8)+i}`,role:t.role,content:t.text}));return createExperienceFrame({cycleId:cycle,observations:extra.observations||[],workspace:extra.workspace||[],recentEvents:recent,world:{environment:'browser runtime',humanMessagePresent:Boolean(extra.observations?.length)},self:{runtime:'browser-local',model:selected()?.model||null,continuityAvailable:cycle>1},predictions:[],counterfactuals:[],affordances:['expression','no-op'],uncertainties:['subjective experience is not observable from this interface'],causalEventIds:extra.causalEventIds||[]})}
async function inferFrame(frame,{first=false}={}){lock(true);status(first?'First cycle running from architectural state…':'Thinking…');record('experience.frame',{frame,generation:{maxNewTokens:responseTokens()}});let streamed='';try{const result=await host.generate({userText:serializeExperienceFrame(frame),contextManifest:[],maxNewTokens:responseTokens(),doSample:false,onText:t=>{streamed+=t}});const routed=routeInferenceCandidate({text:result.text||streamed,frame});record('inference.candidate',{status:result.status,telemetry:result.telemetry,candidate:routed.candidate});record('guardian.decision',routed.guardian);record('executive.selection',routed.executive);if(routed.visibleText){transcript.push({role:'system',text:routed.visibleText});render()}status(routed.visibleText?'Expression selected. Conversation is open.':'No expression selected. Conversation is open.')}catch(e){status(String(e?.message||e));record('inference.error',{message:String(e?.message||e)})}finally{lock(false)}}
async function begin(){const frame=baseFrame({observations:[{type:'runtime.present',content:{documentVisibility:document.visibilityState,online:navigator.onLine,wallClock:new Date().toISOString()}}],causalEventIds:['runtime-present-1']});await inferFrame(frame,{first:true})}
async function send(){const text=$('message').value.trim();if(!text||busy)return;$('message').value='';transcript.push({role:'human',text});render();const id=`human-message-${cycle+1}`;const frame=baseFrame({observations:[{id,type:'human.message',content:text}],workspace:[{id,type:'workspace.broadcast',content:text}],causalEventIds:[id]});await inferFrame(frame)}
$('model').innerHTML=STARTER_MODELS.map(m=>`<option value="${m.id}" ${m.id==='qwen3-0.6b'?'selected':''}>${m.label}</option>`).join('');
$('load').onclick=load;$('begin').onclick=begin;$('stop').onclick=()=>host?.cancel();$('send').onclick=send;$('message').addEventListener('keydown',e=>{if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();send()}});
$('backend').addEventListener('change',()=>{host=null;cycle=0;lock(false);status('Backend changed. Load model again.')});
const caps=await detectBrowserAICapabilities();if(!caps.webgpu.available)$('backend').value='wasm';lock(false);
