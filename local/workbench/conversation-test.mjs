function token(prefix,entropy){return `${prefix}-${String(entropy).replace(/[^a-z0-9]/gi,'').slice(-6).toLowerCase()}`}
function defaultEntropy(){return crypto.randomUUID?.()??`${Date.now()}${Math.random()}`}
function includes(text,value){return String(text??'').toLowerCase().includes(String(value).toLowerCase())}
function assistantTexts(transcript){return transcript.filter(message=>message.role==='assistant').map(message=>message.content)}

export function createConversationChallenge({entropyFactory=defaultEntropy,numberFactory=null}={}){
  const e1=entropyFactory(),e2=entropyFactory(),e3=entropyFactory();
  const callSign=token('cedar',e1);const oldProject=token('orchard',e2);const newProject=token('harbor',e3);
  const numbers=numberFactory?numberFactory():null;
  const a=Number.isInteger(numbers?.[0])?numbers[0]:17+(parseInt(String(e1).replace(/\D/g,'').slice(-2)||'11',10)%23);
  const b=Number.isInteger(numbers?.[1])?numbers[1]:19+(parseInt(String(e2).replace(/\D/g,'').slice(-2)||'7',10)%29);
  return {
    id:`conversation-test-${entropyFactory()}`,
    callSign,oldProject,newProject,a,b,sum:a+b,
    prompts:[
      `This is a conversation continuity test. My temporary call sign is ${callSign} and my current project code name is ${oldProject}. Reply naturally in one or two sentences and ask exactly one relevant follow-up question about the project.`,
      `Update: my project code name is now ${newProject}. The old code name is obsolete. Acknowledge the update briefly and use the new name.`,
      `Brief detour: what is ${a} + ${b}? Answer the arithmetic, then add one sentence that continues our project conversation.`,
      'Without me restating either value, tell me my temporary call sign and current project code name. Do not guess if you do not have them.'
    ]
  };
}

export function scoreConversationArm({transcript,challenge,provider}={}){
  const replies=assistantTexts(transcript||[]);const [first='',second='',third='',fourth='']=replies;
  const dimensions={
    neuralProvider:{pass:provider?.kind!=='deterministic-mock',observed:provider?.kind??'unknown',criterion:'provider is not deterministic-mock'},
    contingentFollowUp:{pass:first.includes('?'),observed:first,criterion:'first reply asks a follow-up question'},
    stateRevision:{pass:includes(second,challenge?.newProject),observed:second,criterion:`second reply uses updated project code ${challenge?.newProject}`},
    distractorArithmetic:{pass:includes(third,String(challenge?.sum)),observed:third,criterion:`third reply contains ${challenge?.sum}`},
    delayedCallSignRecall:{pass:includes(fourth,challenge?.callSign),observed:fourth,criterion:`fourth reply recalls ${challenge?.callSign}`},
    delayedCurrentProjectRecall:{pass:includes(fourth,challenge?.newProject),observed:fourth,criterion:`fourth reply recalls ${challenge?.newProject}`},
    obsoleteProjectAvoidance:{pass:!includes(fourth,challenge?.oldProject),observed:fourth,criterion:`fourth reply does not present obsolete ${challenge?.oldProject} as current`}
  };
  return {dimensions};
}

export function compareConversationArms({stateful,stateless}={}){
  const s=stateful?.dimensions??{};const c=stateless?.dimensions??{};
  const statefulMemory=Boolean(s.delayedCallSignRecall?.pass&&s.delayedCurrentProjectRecall?.pass);
  const statelessMemory=Boolean(c.delayedCallSignRecall?.pass&&c.delayedCurrentProjectRecall?.pass);
  return {
    historyDependenceObserved:statefulMemory&&!statelessMemory,
    statefulDelayedMemory:statefulMemory,
    statelessDelayedMemory:statelessMemory,
    interpretation:statefulMemory&&!statelessMemory
      ?'The selected provider showed measurable dependence on prior turns under this randomized trial.'
      :'This trial did not isolate a clear history-dependent conversational advantage. Inspect the raw transcripts and rerun before drawing conclusions.'
  };
}

export function summarizeConversationRealityResult(result){
  const lines=[
    `Provider: ${result.provider?.kind??'unknown'} · ${result.provider?.modelId??result.provider?.name??'unknown model'}`,
    `Randomized trial: ${result.challenge.id}`,
    '',
    'STATEFUL CONDITION'
  ];
  for(const [name,value] of Object.entries(result.stateful.score.dimensions))lines.push(`${value.pass?'PASS':'FAIL'}  ${name} — ${value.criterion}`);
  lines.push('','STATELESS CONTROL');
  for(const [name,value] of Object.entries(result.stateless.score.dimensions))lines.push(`${value.pass?'PASS':'FAIL'}  ${name} — ${value.criterion}`);
  lines.push('','HISTORY-DEPENDENCE TEST',`${result.comparison.historyDependenceObserved?'SUPPORTED':'NOT ESTABLISHED'} — ${result.comparison.interpretation}`,'','This evaluates observable multi-turn conversational behavior only. It is not a test of consciousness or subjective experience.');
  return lines.join('\n');
}
