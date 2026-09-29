import assert from 'node:assert/strict';
import {chromium} from 'playwright';

const base=process.env.CONSCIOS_BASE_URL??'http://127.0.0.1:8000';
const browser=await chromium.launch({headless:true});
const context=await browser.newContext();
try{
  const host=await context.newPage();
  await host.goto(`${base}/local/swarm/`,{waitUntil:'networkidle'});
  await host.fill('#nickname','Host phone');
  await host.fill('#exoEndpoint','http://192.168.50.10:52415');
  await host.click('#createButton');
  await host.waitForFunction(()=>document.querySelector('#offerLink')?.value?.includes('#offer='));
  const offerUrl=await host.inputValue('#offerLink');
  assert.match(offerUrl,/#offer=/);
  await host.waitForFunction(()=>document.querySelector('#offerQr svg'));

  const guest=await context.newPage();
  await guest.goto(offerUrl,{waitUntil:'networkidle'});
  await guest.waitForSelector('#joinCard:not(.hidden)');
  assert.equal(await guest.textContent('#joinHost'),'Host phone');
  assert.equal(await guest.textContent('#joinExo'),'http://192.168.50.10:52415');
  await guest.fill('#joinNickname','Guest phone');
  await guest.click('#joinButton');
  await guest.waitForFunction(()=>document.querySelector('#answerLink')?.value?.includes('#answer='));
  const answerUrl=await guest.inputValue('#answerLink');
  await guest.waitForFunction(()=>document.querySelector('#answerQr svg'));

  // Simulate Phone A scanning Phone B's answer QR. The camera opens a new
  // same-origin tab; that tab relays the answer to the original host tab.
  const scannerTab=await context.newPage();
  await scannerTab.goto(answerUrl,{waitUntil:'domcontentloaded'});
  await scannerTab.waitForFunction(()=>document.querySelector('#globalStatus')?.textContent?.includes('Answer delivered'));

  await host.waitForFunction(()=>document.querySelector('#connectionPill')?.textContent==='connected',{timeout:15000});
  await guest.waitForFunction(()=>document.querySelector('#connectionPill')?.textContent==='connected',{timeout:15000});
  await host.waitForFunction(()=>document.querySelector('#peerName')?.textContent==='Guest phone',{timeout:5000});
  await guest.waitForFunction(()=>document.querySelector('#peerName')?.textContent==='Host phone',{timeout:5000});
  assert.match(await host.textContent('#peerCapability'),/"wasm": true/);
  assert.equal(await guest.textContent('#connectedExo'),'http://192.168.50.10:52415');

  await host.click('#pingButton');
  await host.waitForFunction(()=>document.querySelector('#rtt')?.textContent?.startsWith('Round-trip:'),{timeout:5000});
  const rtt=await host.textContent('#rtt');
  assert.match(rtt,/Round-trip: [0-9.]+ ms/);

  console.log(`Serverless QR swarm E2E passed: two Chromium pages paired directly with no signaling server; ${rtt}; exo endpoint shared.`);
}finally{
  await context.close();await browser.close();
}
