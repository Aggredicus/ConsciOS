import assert from 'node:assert/strict';
import {randomInt} from 'node:crypto';
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

  const sun=await runOneShot('Reply only SUN.');
  const moon=await runOneShot('Reply only MOON.');
  assert.equal(sun.status,'ok',`SUN inference failed: ${JSON.stringify(sun.output)}`);
  assert.equal(moon.status,'ok',`MOON inference failed: ${JSON.stringify(moon.output)}`);
  assert.equal(exactToken(sun.output),'SUN',`SUN stimulus was not followed exactly: ${sun.output}`);
  assert.equal(exactToken(moon.output),'MOON',`MOON stimulus was not followed exactly: ${moon.output}`);
  assert.notEqual(exactToken(sun.output),exactToken(moon.output),'different inputs produced matching outputs');

  // Closed loop: the model's actual randomized first output determines the next prompt and expected answer.
  const requestedSource=randomInt(2)===0?'SUN':'MOON';
  const sourceReply=await runOneShot(`Reply only ${requestedSource}.`);
  const actualSource=exactToken(sourceReply.output);
  assert.equal(actualSource,requestedSource,`randomized source stimulus was not followed: expected ${requestedSource}, got ${sourceReply.output}`);

  const target=actualSource==='SUN'?'DAY':'NIGHT';
  const reaction=await runOneShot(`${actualSource} -> ${target}. Reply ${target}.`);
  assert.equal(exactToken(reaction.output),target,`closed-loop reaction failed: ${actualSource} dynamically selected ${target}, got ${reaction.output}`);

  const interventionTarget=target==='DAY'?'NIGHT':'DAY';
  const intervention=await runOneShot(`Change. Reply ${interventionTarget}.`);
  assert.equal(exactToken(intervention.output),interventionTarget,`intervention reaction failed: expected ${interventionTarget}, got ${intervention.output}`);
  assert.notEqual(exactToken(reaction.output),exactToken(intervention.output),'intervention did not change neural output');

  for(const result of [sun,moon,sourceReply,reaction,intervention]){
    assert.equal(result.provenance?.provider?.kind,'browser-transformers-local','result was not produced by browser-local neural provider');
  }
  assert.ok(modelRequests.some(url=>url.includes(modelRepository)),`no network request to ${modelRepository} was observed`);
  assert.match(sun.provenance?.provider?.modelId||'',/SmolLM2-360M-Instruct-ONNX/,'unexpected model provenance');

  console.log(`Real browser reactivity passed with ${modelRepository}: SUN/MOON differed; ${actualSource} dynamically selected ${target}; intervention changed output to ${interventionTarget}.`);
} finally {
  await browser.close();
}
