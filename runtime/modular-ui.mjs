import { blankV0State, runModularV0 } from './v0-modular.mjs';

const $=id=>document.getElementById(id);
const esc=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let state=blankV0State();

function eventById(id){return state.events.find(e=>e.id===id)}
function ancestry(rootId,seen=new Set(),depth=0){
  if(!rootId||seen.has(rootId))return[];
  seen.add(rootId);const event=eventById(rootId);if(!event)return[];
  let rows=[{event,depth}];
  for(const parent of event.causalParents)rows=rows.concat(ancestry(parent,seen,depth+1));
  return rows;
}
function eventHTML(event,cls=''){
  return `<div class="event ${cls}" data-event="${esc(event.id)}"><div class="row"><b>${esc(event.type)}</b><span class="small">${Number(event.salience).toFixed(3)}</span></div><div class="small">${esc(typeof event.content==='string'?event.content:JSON.stringify(event.content))}</div><span class="pill">${esc(event.source)}</span><span class="pill">confidence ${Number(event.confidence).toFixed(2)}</span></div>`;
}
function modelHTML(model){
  return Object.entries(model).map(([key,value])=>`<div class="kv"><b>${esc(key)}</b><span>${esc(Array.isArray(value)?value.join(', '):typeof value==='object'?JSON.stringify(value):value)}</span></div>`).join('')||'<div class="empty">Not initialized.</div>';
}
function attachEventDetails(){
  document.querySelectorAll('[data-event]').forEach(node=>node.addEventListener('click',()=>{
    const event=eventById(node.dataset.event);if(!event)return;
    $('detailTitle').textContent=`${event.type} — ${event.id}`;
    $('detailBody').textContent=JSON.stringify(event,null,2);
    $('detailDialog').showModal();
  }));
}
function render(){
  const observations=state.events.filter(e=>e.epistemicStatus==='observation');
  $('sensorCount').textContent=`${observations.length} observations · ${state.candidates.length} candidates`;
  $('sensorium').innerHTML=observations.length?observations.map(e=>eventHTML(e)).join('')+state.candidates.map(e=>eventHTML(e,state.suppressed.some(s=>s.id===e.id)?'suppressed':'')).join(''):'<div class="empty">Run the modular scenario to populate the cognitive loop.</div>';
  $('workspaceCount').textContent=`${state.workspace.length}/2 occupied`;
  $('workspace').innerHTML=state.workspace.map(e=>eventHTML(e,'global')).join('')||'<div class="empty">No information has global access.</div>';
  $('worldModel').innerHTML=modelHTML(state.world);
  $('selfModel').innerHTML=modelHTML(state.self);
  $('counterfactual').innerHTML=state.counterfactual.candidates.length?state.counterfactual.candidates.map(c=>`<div class="event"><div class="row"><b>${esc(c.action.kind)}</b><span class="small">utility ${Number(c.utility).toFixed(2)}</span></div><div class="small">${esc(c.id===state.counterfactual.recommendedCandidateId?'recommended shadow future':'alternative shadow future')}</div><span class="pill">reversible ${Number(c.reversibility).toFixed(2)}</span><span class="pill">confidence ${Number(c.confidence).toFixed(2)}</span></div>`).join(''):'<div class="empty">No counterfactual futures generated.</div>';
  $('metacognition').innerHTML=state.meta.confidence===null?'<div class="empty">No assessment yet.</div>':`<div class="banner"><b>Confidence ${state.meta.confidence.toFixed(3)}</b><br>${state.meta.basis.map(esc).join('<br>')}</div>`;
  $('homeostasis').innerHTML=modelHTML(state.homeostasis);
  $('guardian').innerHTML=`<div class="banner"><b>${esc(state.guardian.decision.toUpperCase())}</b><br>${esc(state.guardian.rationale)}</div>`;
  $('executive').innerHTML=`<div class="banner"><b>${esc(state.executive.status.toUpperCase())}</b><br>${esc(state.executive.rationale)}</div>${state.executive.action?`<p class="small">Action: ${esc(state.executive.action.kind)}</p>`:''}`;
  $('expression').innerHTML=state.expression?`<div class="expression">${esc(state.expression.content)}</div><p class="small">Rendered only after Executive selects a Guardian-permitted action.</p>`:'<div class="empty">No expression has been generated.</div>';
  $('memoryCount').textContent=`${state.memory.length} records`;
  $('memory').innerHTML=state.memory.slice().reverse().map(m=>`<div class="event"><div class="row"><b>${esc(m.epistemicStatus)}</b><span class="small">t${m.timestamp}</span></div><div class="small">${esc(m.summary)}</div><span class="pill">${esc(m.eventId)}</span></div>`).join('')||'<div class="empty">Episodic memory is empty.</div>';
  const trace=ancestry(state.traceRoot);
  $('trace').innerHTML=trace.map(({event,depth})=>`<button class="trace" data-event="${esc(event.id)}" style="margin-left:${Math.min(depth*9,36)}px;width:calc(100% - ${Math.min(depth*9,36)}px)"><b>${esc(event.type)}</b><br><span class="small">${esc(event.source)} · ${esc(event.id)}</span></button>`).join('')||'<div class="empty">Causal ancestry appears after Executive or Expression.</div>';
  attachEventDetails();
}
function run(){state=runModularV0();render()}
function reset(){state=blankV0State();render()}
function exportState(){
  const blob=new Blob([JSON.stringify({exportedAt:new Date().toISOString(),state},null,2)],{type:'application/json'});
  const link=document.createElement('a');link.href=URL.createObjectURL(blob);link.download='conscios-modular-v0-state.json';link.click();setTimeout(()=>URL.revokeObjectURL(link.href),500);
}
$('runBtn').addEventListener('click',run);
$('resetBtn').addEventListener('click',reset);
$('exportBtn').addEventListener('click',exportState);
render();
