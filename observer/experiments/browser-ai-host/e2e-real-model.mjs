import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import { chromium } from 'playwright';

const baseURL=(process.env.CONSCIOS_BASE_URL||'http://127.0.0.1:8000').replace(/\/$/,'');
const modelId='smollm2-360m-instruct';
const modelRepository='SmolLM2-360M-Instruct-ONNX';
const modelRequests=[];
const browser=await chromium.launch({headless:true});

function exactToken(text){
  const normalized=String(text??'').trim().toUpperCase().replace(/^["'`“”‘’]+|["'`“”‘’]+$/g,'').replace(/[.!]+$/,'').trim();
  return /^[A-Z]+$/.test(normalized)?normalized:null;
}

try{
  const context=await browser.newContext();
  const page=await context.newPage();
  page.setDefaultTimeout(60_000);

  page.on('request',request=>{
    const url=request.url();
    if(url.includes(modelRepository)||url.includes('huggingface.co'))modelRequests.push(url);
  });
  page.on('console',message=>{
    if(['warning','error'].includes(message.type()))console.log(`[browser ${message.type()}] ${message.text()}`);
  });
  page.on('pageerror',error=>console.log(`[browser pageerror] ${error.message}`));

  await page.goto(`${baseURL}/local/workbench/`,{waitUntil:'domcontentloaded',timeout:60_000});
  await page.selectOption('#provider','browser-local');
  await page.selectOption('#browserBackend','wasm');
  await page.selectOption('#browserModel',modelId);
  await page.click('#loadBrowser');

  await page.waitForFunction(()=>document.querySelector('#providerStatus')?.textContent?.includes('Browser model ready'),null,{timeout:720_000});
  assert.match(await page.textContent('#providerStatus'),/Browser model ready/,'browser-local provider did not become ready');

  async function readAICell(){
    return page.evaluate(()=>{
      const notebook=JSON.parse(localStorage.getItem('conscios-cognitive-workbench-v1')||'null');
      const cell=notebook?.cells?.find(item=>item.type==='ai');
      return cell?structuredClone(cell):null;
    });
  }

  async function runOneShot(prompt){
    const aiCell=page.locator('article.cell').filter({has:page.locator('.cellType',{hasText:'AI prompt'})}).first();
    const before=await readAICell();
    await aiCell.locator('[data-source]').fill(prompt);
    const maxUnits=aiCell.locator('[data-config="maxResponseUnits"]');
    if(await maxUnits.count())await maxUnits.fill('8');
    await aiCell.locator('[data-action="run"]').click();
    await page.waitForFunction(previousUpdatedAt=>{
      try{
        const notebook=JSON.parse(localStorage.getItem('conscios-cognitive-workbench-v1')||'null');
        const cell=notebook?.cells?.find(item=>item.type==='ai');
        return cell&&cell.updatedAt!==previousUpdatedAt&&(cell.status==='ok'||cell.status==='error');
      }catch{return false}
    },before?.updatedAt??null,{timeout:360_000});
    return readAICell();
  }

  function assertRealInference(result,prompt,label){
    assert.equal(result?.status,'ok',`${label} inference failed: ${JSON.stringify(result?.output)}`);
    assert.equal(result?.source,prompt,`${label} Workbench source did not preserve the submitted prompt`);
    assert.equal(typeof result?.output,'string',`${label} inference did not return assistant text`);
    assert.ok(result.output.trim().length>0,`${label} inference returned empty assistant text`);
    assert.equal(result.provenance?.provider?.kind,'browser-transformers-local',`${label} result was not produced by browser-local neural provider`);
    assert.match(result.provenance?.provider?.modelId||'',/SmolLM2-360M-Instruct-ONNX/,`${label} has unexpected model provenance`);
    assert.ok(result.provenance?.causalSourceIds?.some(id=>String(id).endsWith(':prompt')),`${label} result is missing prompt causal-source provenance`);
  }

  // Hard integration gate: real browser-local neural inference, explicit prompt preservation, and provenance.
  // Exact instruction following by this 360M model is measured below but is not treated as a deterministic transport invariant.
  const sunPrompt='Reply only SUN.';
  const moonPrompt='Reply only MOON.';
  const sun=await runOneShot(sunPrompt);
  const moon=await runOneShot(moonPrompt);
  assertRealInference(sun,sunPrompt,'SUN probe');
  assertRealInference(moon,moonPrompt,'MOON probe');

  // Closed-loop transport: the ACTUAL neural output deterministically chooses the next browser prompt.
  // We assert the causal wiring and successful second inference, not that a small model always obeys the requested token.
  const feedbackSource=String(moon.output);
  const selectorByte=createHash('sha256').update(feedbackSource).digest()[0];
  const target=selectorByte%2===0?'DAY':'NIGHT';
  const followUpPrompt=`Output exactly one word: ${target}`;
  const reaction=await runOneShot(followUpPrompt);
  assertRealInference(reaction,followUpPrompt,'feedback probe');

  assert.ok(modelRequests.some(url=>url.includes(modelRepository)),`no network request to ${modelRepository} was observed`);

  const sunToken=exactToken(sun.output);
  const moonToken=exactToken(moon.output);
  const reactionToken=exactToken(reaction.output);
  const exactCompliance=Number(sunToken==='SUN')+Number(moonToken==='MOON')+Number(reactionToken===target);
  const distinctStimulusOutputs=String(sun.output).trim()!==String(moon.output).trim();
  const diagnostic={
    modelRepository,
    exactInstructionCompliance:{passed:exactCompliance,total:3},
    distinctStimulusOutputs,
    sun:{requested:'SUN',observed:sunToken,raw:String(sun.output)},
    moon:{requested:'MOON',observed:moonToken,raw:String(moon.output)},
    feedback:{sourceSha256:createHash('sha256').update(feedbackSource).digest('hex'),requested:target,observed:reactionToken,raw:String(reaction.output)}
  };
  console.log('Real browser behavioral diagnostic:',JSON.stringify(diagnostic));
  console.log(`Real browser integration passed with ${modelRepository}: model loaded, three non-empty local neural inferences completed, prompt provenance was preserved, and actual neural output selected the follow-up prompt.`);
} finally {
  await browser.close();
}
