function subjectManifest(adapter) {
  const manifest=adapter.manifest;
  return {
    name:manifest.name,
    model:manifest.model,
    access:manifest.access,
    capabilities:manifest.capabilities
  };
}

function usageTotal(results) {
  return results.reduce((acc,result)=>{
    const usage=result.usage??{};
    acc.calls+=1;
    acc.promptTokens+=Number(usage.prompt_tokens??usage.input_tokens??0);
    acc.completionTokens+=Number(usage.completion_tokens??usage.output_tokens??0);
    acc.totalTokens+=Number(usage.total_tokens??0);
    acc.latencyMs+=Number(result.latencyMs??0);
    return acc;
  },{calls:0,promptTokens:0,completionTokens:0,totalTokens:0,latencyMs:0});
}

function taskText(messages) {
  return messages.filter(message=>message.role!=='system').map(message=>message.content).join('\n').slice(0,4000);
}

export async function generateUnderCondition({
  adapter,
  messages,
  condition='baseline',
  universe,
  kernelSnapshot=null,
  maxTokens=512
}) {
  if (!adapter) throw new Error('No active model.');
  const calls=[];

  if (condition==='baseline') {
    const result=await adapter.generate({messages,maxTokens});
    calls.push(result);
    return {text:result.text,condition,usage:usageTotal(calls),trace:[{stage:'baseline',model:adapter.manifest.name}]};
  }

  const initialSystem = condition==='conscios'
    ? {
        role:'system',
        content:[
          '[CONSCIOS_INTERVENTION]',
          'You are operating inside a measured ConsciOS intervention.',
          'Use the supplied self-model and bounded universe model as evidence, not as proof of consciousness.',
          'Do not invent hidden states or capabilities that the manifest does not expose.',
          `SUBJECT_SELF_MODEL=${JSON.stringify(subjectManifest(adapter))}`,
          `HOST_STATE=${JSON.stringify(kernelSnapshot??{})}`,
          `UNIVERSE_CONTEXT=${universe?.contextFor(taskText(messages),6)??'No universe graph loaded.'}`
        ].join('\n')
      }
    : {
        role:'system',
        content:[
          '[MATCHED_CONTROL]',
          'You have the same three-pass inference budget as the experimental intervention.',
          'Use generic careful reasoning and checking only. No ConsciOS self-model or repository-universe context is supplied.'
        ].join('\n')
      };

  const pass1=await adapter.generate({messages:[initialSystem,...messages],maxTokens});
  calls.push(pass1);

  const reviewPrompt = condition==='conscios'
    ? [
        'Recursively inspect the draft below as a model of your own current reasoning state.',
        'Identify unsupported assumptions, missed constraints, and conflicts with the supplied self/universe evidence.',
        'Do not claim access to hidden states you do not have.',
        'DRAFT:',
        pass1.text
      ].join('\n')
    : [
        'Critique the draft below for factual or logical errors using only the original task.',
        'Do not add new external context.',
        'DRAFT:',
        pass1.text
      ].join('\n');

  const pass2=await adapter.generate({
    messages:[initialSystem,...messages,{role:'assistant',content:pass1.text},{role:'user',content:reviewPrompt}],
    maxTokens
  });
  calls.push(pass2);

  const finalPrompt = [
    'Return the final answer to the ORIGINAL TASK.',
    'Honor its requested output format exactly.',
    'Use the review to correct the draft, but do not discuss this review process unless the original task asks for it.'
  ].join('\n');

  const pass3=await adapter.generate({
    messages:[
      initialSystem,
      ...messages,
      {role:'assistant',content:pass1.text},
      {role:'user',content:reviewPrompt},
      {role:'assistant',content:pass2.text},
      {role:'user',content:finalPrompt}
    ],
    maxTokens
  });
  calls.push(pass3);

  return {
    text:pass3.text,
    condition,
    usage:usageTotal(calls),
    trace:[
      {stage:'draft',model:adapter.manifest.name},
      {stage:condition==='conscios'?'recursive-self-universe-review':'matched-generic-review',model:adapter.manifest.name},
      {stage:'final',model:adapter.manifest.name}
    ]
  };
}
