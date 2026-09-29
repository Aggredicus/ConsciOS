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
  const provenance=await host.textContent('#provenance');assert.match(provenance,/AES-256-GCM/);assert.match(provenance,/internet-direct/);assert.match(provenance,/"safetyConfirmed": true/);
  console.log(`Secure internet swarm E2E passed: QR/link signaling only, ${stun.bindings} real local STUN bindings, matching safety code ${hostCode}, encrypted capability exchange, ${rtt}.`);
}finally{await context.close();await browser.close();await stun.close()}
