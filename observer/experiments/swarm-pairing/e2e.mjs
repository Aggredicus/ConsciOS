import assert from 'node:assert/strict';
import dgram from 'node:dgram';
import {chromium} from 'playwright';

const STUN_COOKIE=0x2112A442;
function ipv4Bytes(address){
  const parts=String(address).replace(/^::ffff:/,'').split('.').map(Number);
  if(parts.length!==4||parts.some(value=>!Number.isInteger(value)||value<0||value>255))return [127,0,0,1];
  return parts;
}
async function startLocalStun(){
  const socket=dgram.createSocket('udp4');let bindings=0;
  socket.on('message',(message,rinfo)=>{
    if(message.length<20||message.readUInt16BE(0)!==0x0001||message.readUInt32BE(4)!==STUN_COOKIE)return;
    bindings++;
    const response=Buffer.alloc(32);response.writeUInt16BE(0x0101,0);response.writeUInt16BE(12,2);response.writeUInt32BE(STUN_COOKIE,4);message.copy(response,8,8,20);
    response.writeUInt16BE(0x0020,20);response.writeUInt16BE(8,22);response[24]=0;response[25]=0x01;response.writeUInt16BE(rinfo.port^(STUN_COOKIE>>>16),26);
    const cookie=[0x21,0x12,0xA4,0x42];const ip=ipv4Bytes(rinfo.address);for(let i=0;i<4;i++)response[28+i]=ip[i]^cookie[i];socket.send(response,rinfo.port,rinfo.address);
  });
  await new Promise((resolve,reject)=>{socket.once('error',reject);socket.bind(0,'127.0.0.1',resolve)});
  const port=socket.address().port;return {url:`stun:127.0.0.1:${port}`,get bindings(){return bindings},close:()=>new Promise(resolve=>socket.close(resolve))};
}

const base=process.env.CONSCIOS_BASE_URL??'http://127.0.0.1:8000';const stun=await startLocalStun();const browser=await chromium.launch({headless:true});const context=await browser.newContext();
try{
  const host=await context.newPage();await host.goto(`${base}/local/swarm/`,{waitUntil:'networkidle'});await host.fill('#nickname','Host phone');await host.selectOption('#connectionMode','internet-direct');await host.fill('#stunUrls',stun.url);await host.fill('#exoEndpoint','http://192.168.50.10:52415');await host.click('#createButton');
  await host.waitForFunction(()=>document.querySelector('#offerLink')?.value?.includes('#offer='),{timeout:20000});const offerUrl=await host.inputValue('#offerLink');assert.match(offerUrl,/#offer=/);await host.waitForFunction(()=>document.querySelector('#offerQr svg'));assert.ok(stun.bindings>0,'Chromium must perform a real STUN binding exchange');

  const guest=await context.newPage();await guest.goto(offerUrl,{waitUntil:'networkidle'});await guest.waitForSelector('#joinCard:not(.hidden)');assert.equal(await guest.textContent('#joinHost'),'Host phone');assert.match(await guest.textContent('#joinMode'),/Internet/);assert.equal(await guest.textContent('#joinExo'),'http://192.168.50.10:52415');await guest.fill('#joinNickname','Guest phone');await guest.click('#joinButton');
  await guest.waitForFunction(()=>document.querySelector('#answerLink')?.value?.includes('#answer='),{timeout:20000});const answerUrl=await guest.inputValue('#answerLink');await guest.waitForFunction(()=>document.querySelector('#answerQr svg'));assert.ok(stun.bindings>=2,'both browser peers must use the configured STUN service');

  const scannerTab=await context.newPage();await scannerTab.goto(answerUrl,{waitUntil:'domcontentloaded'});await scannerTab.waitForFunction(()=>document.querySelector('#globalStatus')?.textContent?.includes('Answer delivered'));
  await host.waitForFunction(()=>document.querySelector('#connectionPill')?.textContent==='connected',{timeout:20000});await guest.waitForFunction(()=>document.querySelector('#connectionPill')?.textContent==='connected',{timeout:20000});
  await host.waitForFunction(()=>document.querySelector('#safetyCard')&&!document.querySelector('#safetyCard').classList.contains('hidden'),{timeout:5000});await guest.waitForFunction(()=>document.querySelector('#safetyCard')&&!document.querySelector('#safetyCard').classList.contains('hidden'),{timeout:5000});
  const hostCode=(await host.textContent('#safetyCode')).trim();const guestCode=(await guest.textContent('#safetyCode')).trim();assert.match(hostCode,/^[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{4}$/);assert.equal(hostCode,guestCode,'both peers must derive the same safety code');
  await host.click('#confirmSafety');await guest.click('#confirmSafety');
  await host.waitForFunction(()=>document.querySelector('#peerName')?.textContent==='Guest phone',{timeout:5000});await guest.waitForFunction(()=>document.querySelector('#peerName')?.textContent==='Host phone',{timeout:5000});await host.waitForFunction(()=>document.querySelector('#verificationState')?.textContent?.includes('Verified end-to-end'),{timeout:5000});await guest.waitForFunction(()=>document.querySelector('#verificationState')?.textContent?.includes('Verified end-to-end'),{timeout:5000});
  assert.match(await host.textContent('#peerCapability'),/"wasm": true/);assert.equal(await guest.textContent('#connectedExo'),'http://192.168.50.10:52415');
  await host.click('#pingButton');await host.waitForFunction(()=>document.querySelector('#rtt')?.textContent?.startsWith('Encrypted round-trip:'),{timeout:5000});const rtt=await host.textContent('#rtt');assert.match(rtt,/Encrypted round-trip: [0-9.]+ ms/);

  await guest.selectOption('#computeModel','smollm2-135m-instruct');await guest.click('#computeToggle');
  await guest.waitForFunction(()=>document.querySelector('#computeStatus')?.classList.contains('ok')&&document.querySelector('#computeStatus')?.textContent?.includes('shared'),null,{timeout:360000});
  const bridgeStatus=await host.evaluate(async()=>new Promise((resolve,reject)=>{
    const channel=new BroadcastChannel('conscios-browser-compute-v1'),requestId=crypto.randomUUID(),timer=setTimeout(()=>{channel.close();reject(new Error('bridge discovery timed out'))},10000);
    channel.onmessage=event=>{const m=event.data;if(m?.type==='bridge-status'&&m.requestId===requestId&&m.available){clearTimeout(timer);channel.close();resolve(m)}};
    channel.postMessage({type:'bridge-discover',bridgeProtocol:'conscios-swarm-bridge/v1',requestId});
  }));
  assert.equal(bridgeStatus.capability.enabled,true);assert.match(bridgeStatus.capability.modelId,/SmolLM2/i);
  const remoteResult=await host.evaluate(async({bridgeId})=>new Promise((resolve,reject)=>{
    const channel=new BroadcastChannel('conscios-browser-compute-v1'),id=crypto.randomUUID(),chunks=[],timer=setTimeout(()=>{channel.close();reject(new Error('remote browser inference timed out'))},360000);
    channel.onmessage=event=>{const m=event.data;if(m?.bridgeId!==bridgeId||m?.id!==id)return;if(m.type==='bridge-compute-chunk')chunks.push(m.chunk);if(m.type==='bridge-compute-error'){clearTimeout(timer);channel.close();reject(new Error(m.error))}if(m.type==='bridge-compute-result'){clearTimeout(timer);channel.close();resolve({chunks,result:m.result})}};
    channel.postMessage({type:'bridge-compute-request',bridgeProtocol:'conscios-swarm-bridge/v1',bridgeId,id,input:{requestId:id,requestingModule:'ObserverScientist',inferenceType:'pool-verification',contextManifest:[],causalSourceIds:[],conversationMessages:[{role:'user',content:'Reply with one short word: READY'}],maxResponseUnits:32,expectedEpistemicStatus:'inference',hiddenContextPolicy:'none'}});
  }),{bridgeId:bridgeStatus.bridgeId});
  assert.equal(remoteResult.result.status,'ok');assert.ok(remoteResult.result.content.text.trim().length>0,'real remote browser worker returned empty text');assert.ok(remoteResult.chunks.join('').length>0,'real remote browser worker did not stream text');

  const provenance=await host.textContent('#provenance');assert.match(provenance,/AES-256-GCM/);assert.match(provenance,/internet-direct/);assert.match(provenance,/"safetyConfirmed": true/);
  console.log(`Secure swarm E2E passed: ${stun.bindings} STUN bindings, safety code ${hostCode}, ${rtt}, and real remote browser-model inference over the encrypted DataChannel.`);
}finally{await context.close();await browser.close();await stun.close()}
