const page=(name,synopsis,description,examples=[],seeAlso=[])=>({name,synopsis,description,examples,seeAlso});
export const MANUAL=Object.freeze({
  help:page('help','help [COMMAND]','List available commands or show the manual entry for one command.',['help','help experiment'],['man']),
  man:page('man','man TOPIC','Read a Unix-style manual page. Useful topics include consciousness, models, experiments, intervention, universe, architecture, linux, and governance.',['man consciousness','man experiments'],['help']),
  status:page('status','status','Show host state, active model, intervention state, universe state, and result count.',['status'],['model','experiment']),
  model:page('model','model list | model add NAME BASE_URL MODEL_ID | model use NAME | model test | model remove NAME','Manage loaded model adapters. OpenAI-compatible endpoints support many local runtimes.',['model add local http://localhost:11434/v1 qwen3:14b','model test'],['experiment','intervention']),
  intervention:page('intervention','intervention on | intervention off | intervention status','Enable or disable the recursive self-model + repository-universe intervention. Enabled experiments run baseline, matched control, and intervention on the same model.',['intervention on','experiment run'],['compare','universe']),
  experiment:page('experiment','experiment run | experiment last | experiment raw','Run the standardized ten-dimension battery, inspect its compact summary, or print the complete raw research record.',['experiment run','experiment raw'],['results','compare']),
  results:page('results','results','List all experiment results retained in the local research session. Browser results are persisted without API credentials.',['results'],['compare']),
  compare:page('compare','compare | compare models MODEL_A MODEL_B [CONDITION]','Compare the latest before/after run or compare two tested models under the same selected condition.',['compare','compare models qwen llama baseline'],['experiment','results']),
  universe:page('universe','universe status | universe summary | universe search QUERY','Inspect the bounded repository-universe model derived from Development Landscape or 4D graph JSON.',['universe summary','universe search memory'],['intervention']),
  score:page('score','score','Show the latest model comparison score when available, otherwise the host kernel score.',['score'],['experiment','man consciousness']),
  metric:page('metric','metric list | metric record NAME VALUE [RELIABILITY] [SOURCE]','Inspect or manually record host measurements. Model research should normally use the battery.',['metric list'],['score']),
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
  consciousness:page('consciousness','man consciousness','ConsciOS compares AI models using experimentally measured consciousness-associated functional dimensions. ECS is evidence-adjusted functional evidence, not a probability of phenomenal consciousness. Raw functional score is reported separately.',['experiment run','compare models a b baseline'],['experiments','intervention','governance']),
  models:page('models','man models','A model is the research subject. Adapters declare access level and instrumentation capabilities. Multiple model results can be compared under the same condition.',['model list','results'],['experiments']),
  experiments:page('experiments','man experiments','The battery runs ten deterministic, versioned protocols and retains complete raw responses, parsed values, usage data, and evidence classes.',['experiment run','experiment raw'],['compare','consciousness']),
  intervention:page('intervention','man intervention','The ConsciOS intervention adds bounded subject self-model context, bounded repository-universe evidence, and recursive review. A matched three-call generic control separates architecture-specific effects from extra inference budget.',['intervention on','experiment run'],['universe','experiments']),
  universe:page('universe','man universe','The UniverseModel is a bounded graph derived from the earlier 4D repository/Development Landscape work. It exposes search, neighborhood, and summary rather than dumping the complete graph into context.',['universe summary'],['intervention']),
  architecture:page('architecture','man architecture','The host kernel orchestrates experiments but is not automatically the subject. Loaded models are evaluated alone and optionally as model+ConsciOS intervention systems.',['status'],['models','experiments']),
  governance:page('governance','man governance','Protected Charter, Scientific Contract, Scientific Method, Welfare Protocol, and license remain byte-identical to their source blobs.',['docs'],['consciousness']),
  linux:page('linux','linux start | linux stop | linux status','The browser can lazily boot a v86 Linux environment while keeping the native ConsciOS research shell available.',['linux start'],['help'])
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
