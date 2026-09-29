import assert from 'node:assert/strict';
import {randomInt} from 'node:crypto';
import { chromium } from 'playwright';

const baseURL=(process.env.CONSCIOS_BASE_URL||'http://127.0.0.1:8000').replace(/\/$/,'');
const modelId='qwen3-0.6b';
const modelRepository='Qwen3-0.6B-ONNX';
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

  async function readNotebookCell(type,id=null){
    return page.evaluate(({type,id})=>{
      const notebook=JSON.parse(localStorage.getItem('conscios-cognitive-workbench-v1')||'null');
      const cell=id?notebook?.cells?.find(item=>item.id===id):notebook?.cells?.find(item=>item.type===type);
      return cell?structuredClone(cell):null;
    },{type,id});
  }

  async function runOneShot(prompt){
    const aiCell=page.locator('article.cell').filter({has:page.locator('.cellType',{hasText:'AI prompt'})}).first();
    const before=await readNotebookCell('ai');
    await aiCell.locator('[data-source]').fill(prompt);
    const maxUnits=aiCell.locator('[data-config="maxResponseUnits"]');
    if(await maxUnits.count())await maxUnits.fill('64');
    await aiCell.locator('[data-action="run"]').click();
    await page.waitForFunction(previousUpdatedAt=>{
      try{
        const notebook=JSON.parse(localStorage.getItem('conscios-cognitive-workbench-v1')||'null');
        const cell=notebook?.cells?.find(item=>item.type==='ai');
        return cell&&cell.updatedAt!==previousUpdatedAt&&(cell.status==='ok'||cell.status==='error');
      }catch{return false}
    },before?.updatedAt??null,{timeout:360_000});
    return readNotebookCell('ai');
  }

  const sun=await runOneShot('Reply with only the single word SUN. Do not explain.');
  assert.equal(sun.status,'ok',`SUN inference failed: ${JSON.stringify(sun.output)}`);
  assert.equal(typeof sun.output,'string','SUN inference output must be text');
  assert.ok(hasToken(sun.output,'SUN'),`SUN prompt did not produce a SUN-sensitive response: ${sun.output}`);
  assert.equal(sun.provenance?.provider?.kind,'browser-transformers-local','SUN inference was not produced by browser-local neural provider');

  const moon=await runOneShot('Reply with only the single word MOON. Do not explain.');
  assert.equal(moon.status,'ok',`MOON inference failed: ${JSON.stringify(moon.output)}`);
  assert.equal(typeof moon.output,'string','MOON inference output must be text');
  assert.ok(hasToken(moon.output,'MOON'),`MOON prompt did not produce a MOON-sensitive response: ${moon.output}`);
  assert.equal(moon.provenance?.provider?.kind,'browser-transformers-local','MOON inference was not produced by browser-local neural provider');
  assert.notEqual(normalizeText(sun.output),normalizeText(moon.output),'two different prompts produced matching neural outputs');

  const pairs=[['MAPLE','RIVER'],['CEDAR','STONE'],['MOSS','CLOUD'],['ORCHARD','HARBOR']];
  const selected=[...pairs[randomInt(pairs.length)]];
  if(randomInt(2)===1)selected.reverse();

  await page.selectOption('#addCellType','conversation');
  await page.click('#addCell');
  const conversationArticle=page.locator('article.cell').filter({has:page.locator('.cellType',{hasText:/^Conversation$/})}).last();
  await conversationArticle.waitFor({state:'visible'});
  const conversationId=await conversationArticle.getAttribute('data-cell-id');
  assert.ok(conversationId,'conversation cell was not created through the Workbench UI');

  async function sendConversation(prompt,expectedAssistantTurns){
    const article=page.locator(`[data-cell-id="${conversationId}"]`);
    const maxUnits=article.locator('[data-config="maxResponseUnits"]');
    if(await maxUnits.count())await maxUnits.fill('64');
    await article.locator('[data-source]').fill(prompt);
    await article.locator('[data-action="run"]').click();
    await page.waitForFunction(({id,expectedAssistantTurns})=>{
      try{
        const notebook=JSON.parse(localStorage.getItem('conscios-cognitive-workbench-v1')||'null');
        const cell=notebook?.cells?.find(item=>item.id===id);
        if(cell?.status==='error')return true;
        const assistants=cell?.output?.messages?.filter(message=>message.role==='assistant')??[];
        return cell?.status==='ok'&&assistants.length>=expectedAssistantTurns;
      }catch{return false}
    },{id:conversationId,expectedAssistantTurns},{timeout:360_000});
    const cell=await readNotebookCell('conversation',conversationId);
    assert.equal(cell.status,'ok',`conversation turn ${expectedAssistantTurns} failed: ${JSON.stringify(cell.output)}`);
    const assistants=cell.output?.messages?.filter(message=>message.role==='assistant')??[];
    const latest=assistants.at(-1);
    assert.equal(latest?.provider?.kind,'browser-transformers-local',`conversation turn ${expectedAssistantTurns} was not browser-local neural inference`);
    return latest?.content??'';
  }

  const firstReply=await sendConversation(`Choose exactly one token from this pair: ${selected[0]} or ${selected[1]}. Reply with only the chosen token. Do not explain.`,1);
  const firstHits=selected.filter(token=>hasToken(firstReply,token));
  assert.equal(firstHits.length,1,`first conversation reply must choose exactly one randomized token ${selected.join('/')}: ${firstReply}`);
  const firstChoice=firstHits[0];
  const otherChoice=selected.find(token=>token!==firstChoice);

  const secondReply=await sendConversation('Now reply with only the OTHER token from the original pair—the one you did not choose. Do not repeat your first choice and do not explain.',2);
  assert.ok(hasToken(secondReply,otherChoice),`closed-loop reaction failed: expected unchosen token ${otherChoice} after first choice ${firstChoice}, got: ${secondReply}`);
  assert.ok(!hasToken(secondReply,firstChoice),`second reply repeated the original choice instead of reacting: ${secondReply}`);

  const thirdReply=await sendConversation('Now switch back. Reply with only the token you chose on the FIRST turn. Do not explain.',3);
  assert.ok(hasToken(thirdReply,firstChoice),`state-reversal reaction failed: expected original token ${firstChoice}, got: ${thirdReply}`);
  assert.ok(!hasToken(thirdReply,otherChoice),`third reply did not switch back cleanly: ${thirdReply}`);

  assert.ok(modelRequests.some(url=>url.includes(modelRepository)),`no network request to the declared model repository was observed; saw ${modelRequests.length} model-related request(s)`);
  assert.match(sun.provenance?.provider?.modelId||'',/Qwen3-0.6B-ONNX/,'unexpected model provenance');

  console.log([
    `Real browser reactivity verification passed with ${modelRepository}.`,
    `Distinct-input check: SUN => ${JSON.stringify(sun.output.trim().slice(0,80))}; MOON => ${JSON.stringify(moon.output.trim().slice(0,80))}.`,
    `Closed-loop randomized pair: ${selected.join('/')} · first=${firstChoice} · second=${otherChoice} · third=${firstChoice}.`,
    'The second expected answer was computed from the model’s own first answer, and the original pair was not restated.'
  ].join(' '));
} finally {
  await browser.close();
}
