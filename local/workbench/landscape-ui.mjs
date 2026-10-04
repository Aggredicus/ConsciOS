const OWNER='Aggredicus';
const api=url=>fetch(url,{headers:{Accept:'application/vnd.github+json'}}).then(async r=>{if(!r.ok)throw new Error(`GitHub ${r.status}: ${(await r.text()).slice(0,120)}`);return r.json()});
const fmt=d=>d?new Date(d).toLocaleDateString():'—';

export async function mountLandscape(root){
  if(root.dataset.ready)return;root.dataset.ready='1';
  if(!document.getElementById('landscapeStyle')){const s=document.createElement('style');s.id='landscapeStyle';s.textContent=".landscape{height:100%;overflow:auto;padding:clamp(12px,3vw,24px)}#landscapeMount{max-width:1100px;margin:auto}.landHead{display:flex;gap:10px;align-items:end;justify-content:space-between}.landHead h1{margin:0}.landGrid{display:grid;grid-template-columns:minmax(0,1.3fr) minmax(260px,.7fr);gap:12px;margin:12px 0}.landViz canvas{display:block;width:100%;height:330px;border:1px solid var(--line);border-radius:10px;touch-action:manipulation}.landRepos{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:7px}.landRepo{text-align:left;display:grid;gap:2px}.landRepo strong,.landRepo span{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.landRepo span,.landCommit small{font-size:.7rem;color:var(--muted)}.landRepo.active{border-color:var(--accent);background:#143128}.landCommits{max-height:360px;overflow:auto}.landCommit{display:grid;gap:2px;padding:7px 0;border-bottom:1px solid var(--line)}@media(max-width:760px){.landHead{align-items:stretch;flex-direction:column}.landGrid{grid-template-columns:1fr}.landViz canvas{height:260px}}";document.head.append(s)}
  root.innerHTML=`<div class="landHead"><div><h1>Development Landscape</h1><p class="muted small">Repository topology, recent history, and imported ConsciOS landscape artifacts.</p></div><div class="row"><input id="landOwner" value="${OWNER}" aria-label="GitHub owner"><button id="landRefresh" class="primary" type="button">Load GitHub</button><label class="link landFile">Open JSON<input id="landFile" type="file" accept=".json,application/json" hidden></label></div></div>
  <div id="landStatus" class="status">Loading public GitHub repositories…</div>
  <div class="landGrid"><section class="card landViz"><canvas id="landCanvas" aria-label="Development repository topology"></canvas><div id="landMetrics" class="metrics"></div></section><section class="card landDetail"><h2 id="landTitle">Repository</h2><p id="landMeta" class="muted small">Select a repository.</p><div id="landCommits" class="landCommits"></div></section></div>
  <section class="card"><div class="row"><h2 class="grow">Repositories</h2><span class="small muted">Tap a repository to inspect recent history.</span></div><div id="landRepos" class="landRepos"></div></section>`;
  const $=id=>root.querySelector('#'+id),canvas=$('landCanvas'),ctx=canvas.getContext('2d'),state={repos:[],selected:null,artifact:null,points:[]};

  function tone(text,kind=''){const el=$('landStatus');el.textContent=text;el.className=`status ${kind}`.trim()}
  function resize(){const r=canvas.getBoundingClientRect(),d=Math.min(2,devicePixelRatio||1);canvas.width=Math.max(1,Math.round(r.width*d));canvas.height=Math.max(1,Math.round(r.height*d));draw()}
  function repoRowsFromArtifact(a){
    if(Array.isArray(a.repositories))return a.repositories.map(r=>({id:r.id,full_name:r.fullName||r.name||r.id,name:r.name||r.fullName||r.id,private:r.visibility==='private',fork:Boolean(r.fork),updated_at:null,description:r.role==='self'?'Current repository':r.role||'Neighbor repository',language:null,html_url:r.originUrl||null,role:r.role,commitCount:r.includedCommits??r.commitCount??0}));
    const nodes=Array.isArray(a.nodes)?a.nodes.filter(n=>n.type==='Repository'):[];
    return nodes.map(n=>({id:n.id,full_name:n.properties?.fullName||n.label||n.id,name:n.label||n.id,private:false,fork:false,updated_at:null,description:n.properties?.role||'',language:null,html_url:n.properties?.originUrl||null,role:n.properties?.role,commitCount:0}));
  }
  function commitNodes(repo){
    if(!state.artifact?.nodes)return [];
    return state.artifact.nodes.filter(n=>n.type==='Commit'&&(n.repo===repo.id||n.repo===repo.full_name)).sort((a,b)=>Date.parse(b.timestamp||0)-Date.parse(a.timestamp||0)).slice(0,40).map(n=>({sha:n.properties?.sha||n.id.split(':').at(-1),commit:{message:n.label||'',committer:{date:n.timestamp}}}));
  }
  function renderRepos(){
    const box=$('landRepos');box.textContent='';
    for(const repo of state.repos){
      const b=document.createElement('button');b.type='button';b.className='landRepo'+(state.selected===repo?' active':'');
      const strong=document.createElement('strong');strong.textContent=repo.full_name||repo.name;
      const small=document.createElement('span');small.textContent=[repo.role,repo.language,repo.private?'private':'public',repo.commitCount?`${repo.commitCount} commits loaded`:null].filter(Boolean).join(' · ');
      b.append(strong,small);b.onclick=()=>selectRepo(repo);box.append(b);
    }
  }
  function renderMetrics(){
    const loaded=state.repos.reduce((n,r)=>n+(Number(r.commitCount)||0),0),self=state.repos.filter(r=>r.role==='self').length;
    $('landMetrics').innerHTML=`<div class="metric"><b>${state.repos.length}</b><span>repositories</span></div><div class="metric"><b>${loaded.toLocaleString()}</b><span>commits loaded</span></div><div class="metric"><b>${self||1}</b><span>self</span></div>`;
  }
  function draw(){
    if(!ctx)return;const w=canvas.width,h=canvas.height,d=Math.min(2,devicePixelRatio||1);ctx.fillStyle='#081612';ctx.fillRect(0,0,w,h);state.points=[];
    const n=state.repos.length;if(!n)return;const cx=w/2,cy=h/2,scale=Math.min(w,h)*.36;
    state.repos.forEach((r,i)=>{const a=i*Math.PI*(3-Math.sqrt(5)),rad=n<2?0:scale*Math.sqrt((i+1)/n),x=cx+Math.cos(a)*rad,y=cy+Math.sin(a)*rad*.72,sel=r===state.selected,self=r.role==='self'||/\/ConsciOS$/.test(r.full_name||'');state.points.push({x,y,r,rad:sel?9*d:6*d});ctx.strokeStyle=self?'#8ce0b9':'#294b40';ctx.globalAlpha=.42;ctx.beginPath();ctx.moveTo(cx,cy);ctx.lineTo(x,y);ctx.stroke();ctx.globalAlpha=1;ctx.fillStyle=sel?'#f2cf7b':self?'#8ce0b9':'#91ada3';ctx.beginPath();ctx.arc(x,y,sel?9*d:self?7*d:5*d,0,Math.PI*2);ctx.fill()});
  }
  async function selectRepo(repo){
    state.selected=repo;renderRepos();draw();$('landTitle').textContent=repo.full_name||repo.name;$('landMeta').textContent=[repo.description,repo.language,repo.private?'private':'public',repo.updated_at?`updated ${fmt(repo.updated_at)}`:null].filter(Boolean).join(' · ');
    const box=$('landCommits');box.textContent='Loading history…';
    try{
      const commits=state.artifact?commitNodes(repo):await api(`https://api.github.com/repos/${repo.full_name}/commits?per_page=30`);
      box.textContent='';if(!commits.length){box.textContent='No commit history in this snapshot.';return}
      for(const c of commits.slice(0,30)){const row=document.createElement('div');row.className='landCommit';const msg=document.createElement('span');msg.textContent=String(c.commit?.message||c.sha).split(/\r?\n/)[0];const meta=document.createElement('small');meta.textContent=`${String(c.sha).slice(0,8)} · ${fmt(c.commit?.committer?.date||c.commit?.author?.date)}`;row.append(msg,meta);box.append(row)}
    }catch(error){box.textContent=`History unavailable: ${error.message}`}
  }
  async function loadGitHub(){
    const owner=$('landOwner').value.trim()||OWNER;tone(`Loading ${owner} repositories…`,'warn');state.artifact=null;
    try{const repos=await api(`https://api.github.com/users/${encodeURIComponent(owner)}/repos?type=owner&sort=updated&per_page=100`);state.repos=repos.map(r=>({...r,role:r.full_name===`${owner}/ConsciOS`?'self':'neighbor',commitCount:0}));state.selected=state.repos.find(r=>r.role==='self')||state.repos[0]||null;renderRepos();renderMetrics();resize();tone(`Loaded ${state.repos.length} public repositories. Select one to fetch recent commits.`,'ok');if(state.selected)selectRepo(state.selected)}catch(error){tone(error.message,'bad')}
  }
  async function loadFile(file){
    if(!file)return;if(file.size>30*1024*1024){tone('Landscape JSON exceeds the 30 MB safety cap.','bad');return}
    try{const a=JSON.parse(await file.text());if(!Array.isArray(a.nodes)&&!Array.isArray(a.repositories))throw new Error('Expected Development Landscape or codebase graph JSON');state.artifact=a;state.repos=repoRowsFromArtifact(a);state.selected=state.repos.find(r=>r.role==='self'||r.id==='repository:self')||state.repos[0]||null;renderRepos();renderMetrics();resize();tone(`Loaded ${state.repos.length} repositories from ${file.name}.`,'ok');if(state.selected)selectRepo(state.selected)}catch(error){tone(`Could not load JSON: ${error.message}`,'bad')}
  }
  canvas.addEventListener('click',e=>{const r=canvas.getBoundingClientRect(),d=canvas.width/r.width,x=(e.clientX-r.left)*d,y=(e.clientY-r.top)*d,hit=state.points.reduce((best,p)=>{const dist=Math.hypot(p.x-x,p.y-y);return dist<(best?.dist??18*d)?{p,dist}:best},null);if(hit)selectRepo(hit.p.r)});
  $('landRefresh').onclick=loadGitHub;$('landFile').onchange=e=>loadFile(e.target.files?.[0]);window.addEventListener('resize',resize,{passive:true});await loadGitHub();
}
