import assert from 'node:assert/strict';
import { chromium } from 'playwright';

const baseURL=(process.env.CONSCIOS_BASE_URL||'http://127.0.0.1:8000').replace(/\/$/,'');
const modelId='smollm2-135m-instruct';
const modelRepository='SmolLM2-135M-Instruct-ONNX';
const modelRequests=[];
const browser=await chromium.launch({headless:true});

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
  const providerStatus=await page.textContent('#providerStatus');
  assert.match(providerStatus,/Browser model ready/,'browser-local provider did not become ready');

  const aiCell=page.locator('article.cell').filter({has:page.locator('.cellType',{hasText:'AI prompt'})}).first();
  await aiCell.locator('[data-source]').fill('Write one short sentence confirming that a garden can grow plants.');
  const maxUnits=aiCell.locator('[data-config="maxResponseUnits"]');
  if(await maxUnits.count())await maxUnits.fill('32');
  await aiCell.locator('[data-action="run"]').click();

  await page.waitForFunction(()=>{
    try{
      const notebook=JSON.parse(localStorage.getItem('conscios-cognitive-workbench-v1')||'null');
      const cell=notebook?.cells?.find(item=>item.type==='ai');
      return cell?.status==='ok'||cell?.status==='error';
    }catch{return false}
  },null,{timeout:360_000});
  await page.waitForTimeout(1000);

  const result=await page.evaluate(()=>{
    const notebook=JSON.parse(localStorage.getItem('conscios-cognitive-workbench-v1'));
    const cell=notebook.cells.find(item=>item.type==='ai');
    return {status:cell.status,output:cell.output,provenance:cell.provenance};
  });

  assert.equal(result.status,'ok',`real browser inference did not complete successfully: ${JSON.stringify(result.output)}`);
  assert.equal(typeof result.output,'string','real browser inference output must be text');
  assert.ok(result.output.trim().length>0,'real browser inference returned empty text');
  assert.equal(result.provenance?.provider?.kind,'browser-transformers-local','inference was not produced by the real browser-local neural provider');
  assert.match(result.provenance?.provider?.modelId||'',/SmolLM2-135M-Instruct-ONNX/,'unexpected model provenance');
  assert.ok(modelRequests.some(url=>url.includes(modelRepository)),`no network request to the declared model repository was observed; saw ${modelRequests.length} model-related request(s)`);

  console.log(`Real browser model verification passed: downloaded ${modelRepository}, loaded it in headless Chromium/WASM, and produced non-empty neural output (${result.output.trim().slice(0,120)}).`);
} finally {
  await browser.close();
}
