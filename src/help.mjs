const page = (name, synopsis, description, examples = [], seeAlso = []) => ({name,synopsis,description,examples,seeAlso});
export const MANUAL = Object.freeze({
  help:page('help','help [COMMAND]','List available commands or show the manual entry for one command.',['help','help score'],['man']),
  man:page('man','man TOPIC','Read a Unix-style manual page. Useful topics include consciousness, architecture, score, linux, and governance.',['man consciousness','man linux'],['help']),
  status:page('status','status','Show compact kernel state: cycle, event count, memory size, measured dimensions, and current experimental score.',['status'],['score','trace']),
  observe:page('observe','observe TEXT','Record a sensory observation without running a full cognitive cycle.',['observe soil moisture changed'],['run']),
  run:page('run','run [TEXT]','Run one complete transparent cognitive cycle using TEXT as the current observation.',['run a human asked for system status'],['trace','memory']),
  score:page('score','score','Calculate ECS, coverage, and loss from recorded experimental measurements. Self-report language is not a scoring input.',['score'],['metric','man consciousness']),
  metric:page('metric','metric list | metric record NAME VALUE [RELIABILITY] [SOURCE]','Inspect or record a normalized experimental dimension. Publication-quality scores should come from preregistered experiments.',['metric list','metric record selfModelAccuracy 0.82 0.9 preregistered'],['score']),
  trace:page('trace','trace [N]','Show the most recent N causal events.',['trace','trace 8'],['run']),
  memory:page('memory','memory [N]','Show the most recent N episodic records.',['memory 10'],['run']),
  docs:page('docs','docs','List repository documentation entry points.',['docs'],['man']),
  linux:page('linux','linux start | linux stop | linux status','In the browser, control the optional v86 Linux VM. The native ConsciOS shell works even when the VM is unavailable.',['linux start','linux status'],['man linux']),
  clear:page('clear','clear','Clear terminal display without modifying kernel state.',['clear']),
  reset:page('reset','reset','Reset non-protected runtime state for this local session.',['reset'],['status']),
  about:page('about','about','Describe the purpose and epistemic limits of this build.',['about'],['man consciousness']),
  exit:page('exit','exit','Exit the native Node CLI. In the browser this command has no destructive effect.',['exit'])
});
export const TOPICS = Object.freeze({
  consciousness:page('consciousness','man consciousness','ConsciOS optimizes an Experimental Consciousness Score built from independently measured functional dimensions. ECS is an operational research score, not validated evidence of phenomenal experience. Loss is 1 - ECS. Missing dimensions reduce coverage; geometric aggregation makes weak core dimensions difficult to hide behind strong ones.',['score','metric list'],['score','governance','architecture']),
  architecture:page('architecture','man architecture','Rebuild 1 has one canonical event-driven kernel: Sensorium → candidate formation → bounded Global Workspace → world/self models → counterfactuals → metacognition → Welfare Guardian → Executive → expression. Browser and CLI share this implementation.',['run hello','trace'],['consciousness','governance']),
  governance:page('governance','man governance','Protected Charter, Scientific Contract, Scientific Method, Welfare Protocol, and license are preserved byte-for-byte and verified in CI. Welfare and authorization invariants are hard constraints, not score terms an optimizer may trade away.',['docs'],['consciousness']),
  linux:page('linux','linux start | linux stop | linux status','The browser can lazily load v86 and boot a small Linux environment. VM assets are not downloaded until requested. Rebuild 1 uses a serial console and public development assets; production should pin and self-host reviewed assets.',['linux start'],['help'])
});
export function formatManual(entry) {
  const wrapped = String(entry.description).match(/.{1,76}(?:\s|$)/g)?.map(x=>`    ${x.trim()}`) ?? [`    ${entry.description}`];
  const lines=['NAME',`    ${entry.name}`,'','SYNOPSIS',`    ${entry.synopsis}`,'','DESCRIPTION',...wrapped];
  if(entry.examples?.length) lines.push('','EXAMPLES',...entry.examples.map(x=>`    ${x}`));
  if(entry.seeAlso?.length) lines.push('','SEE ALSO',`    ${entry.seeAlso.join(', ')}`);
  return lines.join('\n');
}
export function helpIndex() {
  const rows=Object.entries(MANUAL).map(([name,entry])=>`  ${name.padEnd(10)} ${entry.description.split('.')[0]}.`).join('\n');
  return `ConsciOS Rebuild 1 commands\n\n${rows}\n\nTry: help <command>   or   man consciousness`;
}
