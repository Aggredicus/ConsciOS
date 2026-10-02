const $=id=>document.getElementById(id);
const fmt=value=>{
  if(!Number.isFinite(value)||value<=0)return '';
  const u=['B','KB','MB','GB','TB'];let n=value,i=0;while(n>=1024&&i<u.length-1){n/=1024;i++}
  return `${n>=100||i===0?n.toFixed(0):n.toFixed(1)} ${u[i]}`;
};
const metric=(obj,names)=>{for(const name of names)if(Number.isFinite(Number(obj?.[name])))return Number(obj[name]);return null};
function modelText(model){
  const tags=[model.downloaded?'downloaded':'available',model.active?'active':'',model.quantization,model.storageSizeBytes?fmt(model.storageSizeBytes):''].filter(Boolean);
  return `${model.id}${tags.length?` · ${tags.join(' · ')}`:''}`;
}
function benchmarkText(payload){
  const stats=payload?.generation_stats??payload?.stats??payload??{},generation=metric(stats,['generation_tps','generationTps','tokens_per_second','tokensPerSecond']),prompt=metric(stats,['prompt_tps','promptTps']);
  return [generation!==null?`${generation.toFixed(1)} tok/s generation`:null,prompt!==null?`${prompt.toFixed(1)} tok/s prompt`:null].filter(Boolean).join(' · ');
}
function previewSummary(previews){
  const valid=previews.filter(p=>p.valid);
  if(!valid.length)return 'No valid placement on the current cluster.';
  const best=[...valid].sort((a,b)=>b.nodeCount-a.nodeCount)[0],storage=Object.values(best.memory_delta_by_node??{}).reduce((sum,value)=>sum+(Number(value)||0),0);
  return `${best.nodeCount}-node ${best.sharding??'placement'} · ${best.instance_meta??'runtime'}${storage?` · ${fmt(storage)} allocated`:''}`;
}
export function mountExoLibrary({provider,capabilities,onSelect=()=>{}}={}){
  const select=$('exoModel'),tools=$('exoTools'),metrics=$('exoMetrics'),status=$('exoStatus');
  if(!select||!tools)return null;
  tools.innerHTML='<div class="field"><label for="exoFilter">Filter models</label><input id="exoFilter" class="full" placeholder="Qwen, Llama, Gemma…"></div><div class="row" style="margin-top:8px"><button id="exoPreview" type="button">Preview fit</button><button id="exoPool" type="button">Pool test</button></div><p id="exoPlacement" class="status">Select a model to inspect placement.</p>';
  const filter=$('exoFilter'),placement=$('exoPlacement'),previewButton=$('exoPreview'),poolButton=$('exoPool');
  const textCatalog=rows=>rows.filter(model=>!model.tasks?.length||model.tasks.some(task=>/TextGeneration/i.test(String(task)))).sort((a,b)=>Number(b.downloaded)-Number(a.downloaded)||(a.storageSizeBytes??Infinity)-(b.storageSizeBytes??Infinity)||a.id.localeCompare(b.id));
  let caps=capabilities,catalog=textCatalog(Array.isArray(caps?.modelCatalog)?caps.modelCatalog:[]);
  const renderMetrics=()=>{
    const cluster=caps?.cluster??{},rows=[[cluster.nodeCount??0,'nodes'],[fmt(cluster.memory?.availableBytes)||'—','RAM available'],[(caps?.activeModels??[]).length,'active models']];
    metrics.innerHTML=rows.map(([value,label])=>`<div class="metric"><b>${value}</b><span>${label}</span></div>`).join('');
  };
  const renderModels=()=>{
    const query=(filter.value||'').trim().toLowerCase(),selected=provider.modelId;
    const rows=catalog.filter(model=>!query||model.id.toLowerCase().includes(query)||model.family?.toLowerCase().includes(query)).slice(0,250);
    select.innerHTML='';
    if(!rows.length){select.innerHTML='<option value="">No matching models</option>';select.disabled=true;return}
    select.disabled=false;
    for(const model of rows){const option=document.createElement('option');option.value=model.id;option.textContent=modelText(model);select.append(option)}
    if(selected&&rows.some(model=>model.id===selected))select.value=selected;
    else if(rows[0]){select.value=rows[0].id;provider.setModel(rows[0].id)}
  };
  const modelInfo=()=>{
    const model=catalog.find(item=>item.id===select.value);if(!model)return '';
    return [model.family,model.quantization,model.contextLength?`${model.contextLength.toLocaleString()} ctx`:'',model.supportsTensor?'tensor-capable':'',model.downloaded?'downloaded':'downloads on launch'].filter(Boolean).join(' · ');
  };
  const choose=()=>{if(select.value){provider.setModel(select.value);placement.textContent=modelInfo()||select.value;onSelect(select.value)}};
  filter.addEventListener('input',()=>{renderModels();choose()});
  select.addEventListener('change',choose);
  previewButton.addEventListener('click',async()=>{
    if(!select.value)return;previewButton.disabled=true;placement.textContent='Computing placements…';
    try{const previews=await provider.previewPlacements(select.value);placement.textContent=previewSummary(previews)}
    catch(error){placement.textContent=String(error?.message||error)}
    finally{previewButton.disabled=false}
  });
  poolButton.addEventListener('click',async()=>{
    if(!select.value)return;poolButton.disabled=true;placement.textContent='Testing pooled placement…';
    try{
      const result=await provider.testPooling(select.value);
      if(result.status==='needs-second-worker')placement.textContent=`${result.nodeCount} exo worker detected. Add a second worker for compute pooling.`;
      else if(result.status==='active-instance-exists')placement.textContent='This model already has an active instance. Stop it in native exo, then retry Pool test.';
      else if(result.status==='no-multi-node-placement')placement.textContent='No valid multi-node placement for this model on the current cluster.';
      else if(result.status==='pooled')placement.textContent=`${result.placement.nodeCount}-node ${result.placement.sharding??'pooled'} test passed${benchmarkText(result.benchmark)?` · ${benchmarkText(result.benchmark)}`:''}`;
      else placement.textContent=String(result.status);
      caps=provider.capabilities??caps;renderMetrics();onSelect(provider.modelId);
    }catch(error){placement.textContent=String(error?.message||error)}
    finally{poolButton.disabled=false}
  });
  renderMetrics();renderModels();choose();
  status.textContent=`${caps?.cluster?.nodeCount??0} node(s) · ${catalog.length} model(s) · ${caps?.downloadedModels?.length??0} downloaded`;status.className='status ok';
  return {update(next){caps=next;catalog=textCatalog(Array.isArray(next?.modelCatalog)?next.modelCatalog:catalog);renderMetrics();renderModels();choose()}};
}
