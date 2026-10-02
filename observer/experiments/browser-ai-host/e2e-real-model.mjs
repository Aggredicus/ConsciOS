import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {chromium} from 'playwright';

const baseURL=(process.env.CONSCIOS_BASE_URL||'http://127.0.0.1:8000').replace(/\/$/,'');
const modelId='smollm2-135m-instruct';
const modelRepository='SmolLM2-135M-Instruct-ONNX';
const modelRequests=[];
const browser=await chromium.launch({headless:true});

try{
  const context=await browser.newContext();
  const page=await context.newPage();
  page.setDefaultTimeout(90_000);
  page.on('request',request=>{const url=request.url();if(url.includes(modelRepository)||url.includes('huggingface.co'))modelRequests.push(url)});
  page.on('console',message=>{if(['warning','error'].includes(message.type()))console.log(`[browser ${message.type()}] ${message.text()}`)});
  page.on('pageerror',error=>console.log(`[browser pageerror] ${error.message}`));

  await page.goto(`${baseURL}/local/workbench/?provider=browser`,{waitUntil:'domcontentloaded',timeout:60_000});
  await page.locator('.tab[data-tab="runtime"]').click();
  await page.selectOption('#browserModel',modelId);
  await page.click('#loadBrowser');
  await page.locator('#browserStatus.ok').waitFor({timeout:720_000});
  assert.match(await page.locator('#browserStatus').innerText(),/ready on/i);

  async function send(prompt){
    await page.locator('.tab[data-tab="chat"]').click();
    const before=await page.locator('.msg.assistant').count();
    await page.locator('#prompt').fill(prompt);
    await page.locator('#composer').evaluate(form=>form.requestSubmit());
    await page.waitForFunction(count=>document.querySelectorAll('.msg.assistant').length>count,before,{timeout:360_000});
    const rows=page.locator('.msg.assistant');
    const text=(await rows.last().locator('.bubble').innerText()).trim();
    assert.ok(text.length>0,'browser-local inference returned empty assistant text');
    const provenance=await page.evaluate(()=>JSON.parse(localStorage.getItem('conscios-lite-v1')||'{}').lastProvenance||null);
    assert.equal(provenance?.provider?.kind,'browser-transformers-local','compact chat was not produced by the browser-local neural provider');
    assert.match(provenance?.provider?.modelId||'',/SmolLM2-135M-Instruct-ONNX/,'unexpected model provenance');
    assert.equal(provenance?.timing?.streamed,true,'compact browser chat must surface streamed generation');
    assert.ok((provenance?.context?.selectedMessages??99)<=9,'compact browser chat exceeded fast-context message budget');
    assert.ok((provenance?.context?.selectedBytes??999999)<=12000,'compact browser chat exceeded fast-context byte budget');
    return text;
  }

  const first=await send('Reply briefly with the word SUN.');
  const target=createHash('sha256').update(first).digest()[0]%2===0?'DAY':'NIGHT';
  const second=await send(`Reply briefly with the word ${target}.`);
  assert.ok(second.length>0);
  assert.ok(modelRequests.some(url=>url.includes(modelRepository)),`no network request to ${modelRepository} was observed`);

  console.log('Compact real-browser integration passed:',JSON.stringify({
    modelRepository,
    firstOutput:first,
    feedback:{sourceSha256:createHash('sha256').update(first).digest('hex'),requested:target,observed:second}
  }));
}finally{await browser.close()}
