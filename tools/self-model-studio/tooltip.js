(()=>{'use strict';
const stage=document.getElementById('stage'),canvas=document.getElementById('canvas'),inspector=document.getElementById('inspector');
if(!stage||!canvas||!inspector)return;
const tip=document.createElement('div');
tip.id='node-tooltip';tip.setAttribute('role','status');tip.setAttribute('aria-live','polite');
Object.assign(tip.style,{position:'absolute',zIndex:'20',display:'none',maxWidth:'min(320px,82vw)',padding:'.58rem .68rem',border:'1px solid #3a465a',borderRadius:'10px',background:'rgba(17,22,31,.97)',color:'#eef2f7',font:'12px/1.38 Inter,ui-sans-serif,system-ui,sans-serif',boxShadow:'0 8px 30px rgba(0,0,0,.35)',pointerEvents:'none',overflowWrap:'anywhere'});
stage.appendChild(tip);
let hideTimer=null;
function hide(){tip.style.display='none';clearTimeout(hideTimer);hideTimer=null;}
function showAt(clientX,clientY){queueMicrotask(()=>{const title=inspector.querySelector('h2')?.textContent?.trim();const badges=[...inspector.querySelectorAll('.badge')].map(x=>x.textContent.trim()).filter(Boolean);if(!title||title==='Selection')return;tip.textContent='';const strong=document.createElement('strong');strong.textContent=title;strong.style.display='block';tip.appendChild(strong);if(badges.length){const meta=document.createElement('div');meta.textContent=badges.join(' · ');meta.style.color='#97a4b7';meta.style.marginTop='.2rem';tip.appendChild(meta)}tip.style.visibility='hidden';tip.style.display='block';const stageRect=stage.getBoundingClientRect(),tipRect=tip.getBoundingClientRect(),pad=8;let x=(Number.isFinite(clientX)?clientX-stageRect.left:stageRect.width/2)+12,y=(Number.isFinite(clientY)?clientY-stageRect.top:stageRect.height/2)+12;x=Math.max(pad,Math.min(stageRect.width-tipRect.width-pad,x));y=Math.max(pad,Math.min(stageRect.height-tipRect.height-pad,y));tip.style.left=`${x}px`;tip.style.top=`${y}px`;tip.style.visibility='visible';clearTimeout(hideTimer);hideTimer=setTimeout(hide,4200);});}
canvas.addEventListener('conscios:node-selected',e=>showAt(e.detail?.clientX,e.detail?.clientY));
canvas.addEventListener('pointerdown',e=>{if(e.pointerType==='touch'&&e.isPrimary===false)hide()});
canvas.addEventListener('pointerleave',e=>{if(e.pointerType!=='touch')hide()});
window.addEventListener('keydown',e=>{if(e.key==='Escape')hide()});
})();
