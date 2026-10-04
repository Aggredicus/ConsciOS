const page=(name,synopsis,description,examples=[],seeAlso=[])=>({name,synopsis,description,examples,seeAlso});
export const MANUAL=Object.freeze({
  help:page('help','help [COMMAND]','List available commands or show the manual entry for one command.',['help','help experiment'],['man']),
  man:page('man','man TOPIC','Read a Unix-style manual page. Useful topics include consciousness, models, experiments, intervention, universe, architecture, linux, and governance.',['man consciousness','man experiments'],['help']),
  status:page('status','status','Show host state, active model, intervention state, universe state, and current measurements.',['status'],['model','experiment']),
  model:page('model','model list | model add NAME BASE_URL MODEL_ID | model use NAME | model test | model remove NAME','Manage loaded model adapters. OpenAI-compatible endpoints include many local runtimes such as Ollama, llama.cpp, LM Studio, and vLLM when configured with a compatible /chat/completions API.',['model add local http://localhost:11434/v1 qwen3:14b','model test'],['experiment','intervention']),
  intervention:page('intervention','intervention on | intervention off | intervention status','Enable or disable the ConsciOS recursive self-model + repository-universe intervention. When enabled, comparative experiments run baseline, a three-pass matched control, and the three-pass ConsciOS intervention on the same model.',['intervention on','experiment run'],['compare','universe']),
  experiment:page('experiment','experiment run | experiment last','Run the standardized ten-dimension consciousness-associated function battery on the active model. With intervention enabled, the same model serves as its own before/after control.',['experiment run','experiment last'],['compare','score']),
  compare:page('compare','compare','Show the latest baseline/control/intervention comparison including ΔECS and per-condition call counts.',['compare'],['experiment']),
  universe:page('universe','universe status | universe summary | universe search QUERY','Inspect the bounded repository-universe model derived from a Development Landscape or 4D repository graph. Load graph JSON through the browser UI; external agents can use the read-only MCP server.',['universe summary','universe search memory'],['intervention']),
  score:page('score','score','Show the latest model comparison score when available, otherwise the host kernel score. ECS is evidence-adjusted; functional score is reported separately.',['score'],['experiment','man consciousness']),
  metric:page('metric','metric list | metric record NAME VALUE [RELIABILITY] [SOURCE]','Inspect or manually record a host measurement. Model research should normally use the standardized experiment battery.',['metric list'],['score']),
  observe:page('observe','observe TEXT','Record a host sensory observation without running a full host cycle.',['observe model endpoint connected'],['run']),
  run:page('run','run [TEXT]','Run one transparent host cognitive cycle. This is not the model consciousness battery.',['run model comparison requested'],['trace']),
  trace:page('trace','trace [N]','Show recent host causal events.',['trace 10'],['run']),
  memory:page('memory','memory [N]','Show recent host episodic records.',['memory 10'],['run']),
  docs:page('docs','docs','List repository documentation entry points.',['docs'],['man']),
  linux:page('linux','linux start | linux stop | linux status','Control the optional browser-hosted v86 Linux VM.',['linux start'],['man linux']),
  clear:page('clear','clear','Clear terminal display without modifying state.',['clear']),
  reset:page('reset','reset','Reset non-protected host runtime state.',['reset'],['status']),
  about:page('about','about','Describe the research purpose and epistemic limits of ConsciOS.',['about'],['man consciousness']),
  exit:page('exit','exit','Exit the native Node CLI.',['exit'])
});
export const TOPICS=Object.freeze({
  consciousness:page('consciousness','man consciousness','ConsciOS compares AI models using experimentally measured consciousness-associated functional dimensions. ECS is evidence-adjusted functional evidence, not a probability of phenomenal consciousness. The raw functional score is always reported separately so instrumentation quality cannot masquerade as capability.',['experiment run','compare'],['experiments','intervention','governance']),
  models:page('models','man models','A model is treated as the research subject. Adapters declare access level and instrumentation capabilities. Black-box APIs receive lower evidentiary reliability than internal causal instrumentation even when behavioral performance is identical.',['model list','model test'],['experiments']),
  experiments:page('experiments','man experiments','The battery runs ten deterministic, versioned protocols: global availability, integration, recurrence, self-model accuracy, temporal continuity, metacognitive calibration, counterfactual influence, agency attribution, state sensitivity, and report independence.',['experiment run'],['compare','consciousness']),
  intervention:page('intervention','man intervention','The ConsciOS intervention adds a bounded subject self-model, bounded repository-universe context, and recursive review. A matched three-call generic reflection control is also run so extra inference budget can be separated from architecture-specific effects.',['intervention on','experiment run'],['universe','experiments']),
  universe:page('universe','man universe','The UniverseModel is a bounded graph derived from the earlier 4D repository/Development Landscape work. It exposes search, neighborhood, and summary rather than dumping the entire graph into model context. The same query implementation backs browser intervention and read-only MCP.',['universe summary'],['intervention']),
  architecture:page('architecture','man architecture','The ConsciOS host kernel orchestrates experiments but is not automatically the subject. Loaded models are evaluated alone and, optionally, as model+ConsciOS intervention systems.',['status'],['models','experiments']),
  governance:page('governance','man governance','Protected Charter, Scientific Contract, Scientific Method, Welfare Protocol, and license remain byte-identical to their source blobs. Welfare and authorization constraints are not tradeable score terms.',['docs'],['consciousness']),
  linux:page('linux','linux start | linux stop | linux status','The browser can lazily boot a v86 Linux environment while keeping the native ConsciOS research shell available on low-resource devices.',['linux start'],['help'])
});
export function formatManual(entry){
  const wrapped=String(entry.description).match(/.{1,76}(?:\s|$)/g)?.map(x=>`    ${x.trim()}`)??[`    ${entry.description}`];
  const lines=['NAME',`    ${entry.name}`,'','SYNOPSIS',`    ${entry.synopsis}`,'','DESCRIPTION',...wrapped];
  if(entry.examples?.length)lines.push('','EXAMPLES',...entry.examples.map(x=>`    ${x}`));
  if(entry.seeAlso?.length)lines.push('','SEE ALSO',`    ${entry.seeAlso.join(', ')}`);
  return lines.join('\n');
}
export function helpIndex(){
  const rows=Object.entries(MANUAL).map(([name,entry])=>`  ${name.padEnd(13)} ${entry.description.split('.')[0]}.`).join('\n');
  return `ConsciOS Rebuild 1 research commands\n\n${rows}\n\nTry: model list   |   help experiment   |   man consciousness`;
}
