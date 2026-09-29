import assert from 'node:assert/strict';
import {randomInt} from 'node:crypto';
import { chromium } from 'playwright';

const baseURL=(process.env.CONSCIOS_BASE_URL||'http://127.0.0.1:8000').replace(/\/$/,'');
const modelId='smollm2-135m-instruct';
const modelRepository='SmolLM2-135M-Instruct-ONNX';
const modelRequests=[];
const browser=await chromium.launch({headless:true});

function hasToken(text,token){
  return String(text??'').toUpperCase().split(/[^A-Z]+/).includes(token.toUpperCase());
}
function normalizeText(text){return String(text??'').trim().replace(/\s+/g,' ').toLowerCase()}

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
    if(await maxUnits.count())await maxUnits.fill('24');
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

  const sun=await runOneShot('Reply with only the single word SUN.');
  assert.equal(sun.status,'ok',`SUN inference failed: ${JSON.stringify(sun.output)}`);
  assert.equal(typeof sun.output,'string','SUN inference output must be text');
  assert.ok(hasToken(sun.output,'SUN'),`SUN prompt did not produce a SUN-sensitive response: ${sun.output}`);
  assert.equal(sun.provenance?.provider?.kind,'browser-transformers-local','SUN inference was not produced by browser-local neural provider');

  const moon=await runOneShot('Reply with only the single word MOON.');
  assert.equal(moon.status,'ok',`MOON inference failed: ${JSON.stringify(moon.output)}`);
  assert.equal(typeof moon.output,'string','MOON inference output must be text');
  assert.ok(hasToken(moon.output,'MOON'),`MOON prompt did not produce a MOON-sensitive response: ${moon.output}`);
  assert.equal(moon.provenance?.provider?.kind,'browser-transformers-local','MOON inference was not produced by browser-local neural provider');
  assert.notEqual(normalizeText(sun.output),normalizeText(moon.output),'two different prompts produced matching neural outputs');

  const sourcePairs=[['MAPLE','RIVER'],['CEDAR','STONE'],['MOSS','CLOUD'],['ORCHARD','HARBOR']];
  const targetPairs=[['GREEN','BLUE'],['NORTH','SOUTH'],['ALPHA','BETA'],['DAWN','DUSK']];
  const source=[...sourcePairs[randomInt(sourcePairs.length)]];
  const target=[...targetPairs[randomInt(targetPairs.length)]];
  if(randomInt(2))source.reverse();
  if(randomInt(2))target.reverse();

  const choice=await runOneShot(`Choose exactly one token: ${source[0]} or ${source[1]}. Reply with only the chosen token.`);
  assert.equal(choice.status,'ok',`choice inference failed: ${JSON.stringify(choice.output)}`);
  const choiceHits=source.filter(token=>hasToken(choice.output,token));
  assert.equal(choiceHits.length,1,`model must choose exactly one randomized source token ${source.join('/')}: ${choice.output}`);
  const chosen=choiceHits[0];
  const chosenIndex=source.indexOf(chosen);
  const expectedMapped=target[chosenIndex];

  const mapped=await runOneShot(
    `The browser model previously chose ${chosen}. Apply this mapping: ${source[0]} maps to ${target[0]}; ${source[1]} maps to ${target[1]}. `+
    `Reply with only the mapped token for ${chosen}.`
  );
  assert.equal(mapped.status,'ok',`mapped reaction failed: ${JSON.stringify(mapped.output)}`);
  assert.ok(hasToken(mapped.output,expectedMapped),`closed-loop mapping reaction failed: ${chosen} should map to ${expectedMapped}, got: ${mapped.output}`);

  const reversedTarget=[target[1],target[0]];
  const expectedReversed=reversedTarget[chosenIndex];
  const reversed=await runOneShot(
    `Intervention: reverse the mapping. Now ${source[0]} maps to ${reversedTarget[0]}; ${source[1]} maps to ${reversedTarget[1]}. `+
    `Using the same earlier choice ${chosen}, reply with only its NEW mapped token.`
  );
  assert.equal(reversed.status,'ok',`reversed reaction failed: ${JSON.stringify(reversed.output)}`);
  assert.ok(hasToken(reversed.output,expectedReversed),`mapping intervention failed: ${chosen} should now map to ${expectedReversed}, got: ${reversed.output}`);
  assert.notEqual(expectedMapped,expectedReversed,'intervention did not change the expected target');
  assert.notEqual(normalizeText(mapped.output),normalizeText(reversed.output),'mapping intervention produced matching neural outputs');

  for(const result of [choice,mapped,reversed])assert.equal(result.provenance?.provider?.kind,'browser-transformers-local','closed-loop step was not browser-local neural inference');
  assert.ok(modelRequests.some(url=>url.includes(modelRepository)),`no network request to the declared model repository was observed; saw ${modelRequests.length} model-related request(s)`);
  assert.match(sun.provenance?.provider?.modelId||'',/SmolLM2-135M-Instruct-ONNX/,'unexpected model provenance');

  console.log([
    `Real browser reactivity verification passed with ${modelRepository}.`,
    `Distinct inputs: SUN => ${JSON.stringify(sun.output.trim().slice(0,60))}; MOON => ${JSON.stringify(moon.output.trim().slice(0,60))}.`,
    `Closed loop: model chose ${chosen}; mapping produced ${expectedMapped}; reversed intervention produced ${expectedReversed}.`,
    'The expected mapping response was computed from the model’s own randomized first choice.'
  ].join(' '));
} finally {
  await browser.close();
}
