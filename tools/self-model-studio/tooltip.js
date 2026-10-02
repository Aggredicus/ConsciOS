(()=>{'use strict';
const stage=document.getElementById('stage'),canvas=document.getElementById('canvas'),inspector=document.getElementById('inspector');
if(!stage||!canvas||!inspector)return;
const tip=document.createElement('div');
tip.id='node-tooltip';tip.setAttribute('role','status');tip.setAttribute('aria-live','polite');
Object.assign(tip.style,{position:'absolute',zIndex:'20',display:'none',maxWidth:'min(320px,80vw)',padding:'.55rem .65rem',border:'1px solid #3a465a',borderRadius:'9px',background:'rgba(17,22,31,.97)',color:'#eef2f7',font:'12px/1.35 Inter,ui-sans-serif,system-ui,sans-serif',boxShadow:'0 8px 30px rgba(0,0,0,.35)',pointerEvents:'none',overflowWrap:'anywhere'});
stage.appendChild(tip);
let hideTimer=null;
function show(e){queueMicrotask(()=>{const title=inspector.querySelector('h2')?.textContent?.trim();const badges=[...inspector.querySelectorAll('.badge')].map(x=>x.textContent.trim()).filter(Boolean);if(!title||title==='Selection')return;tip.textContent='';const strong=document.createElement('strong');strong.textContent=title;strong.style.display='block';tip.appendChild(strong);if(badges.length){const meta=document.createElement('div');meta.textContent=badges.join(' · ');meta.style.color='#97a4b7';meta.style.marginTop='.2rem';tip.appendChild(meta)}const r=stage.getBoundingClientRect(),x=Math.max(8,Math.min(r.width-330,e.clientX-r.left+12)),y=Math.max(8,Math.min(r.height-90,e.clientY-r.top+12));tip.style.left=`${x}px`;tip.style.top=`${y}px`;tip.style.display='block';clearTimeout(hideTimer);hideTimer=setTimeout(()=>tip.style.display='none',4200);});}
canvas.addEventListener('pointerup',show);
canvas.addEventListener('pointerleave',()=>{if(!hideTimer)tip.style.display='none'});
window.addEventListener('keydown',e=>{if(e.key==='Escape')tip.style.display='none'});
})();
