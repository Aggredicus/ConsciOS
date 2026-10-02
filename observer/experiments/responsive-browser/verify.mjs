import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {chromium} from 'playwright';

const here=path.dirname(fileURLToPath(import.meta.url));
const root=path.resolve(here,'../../..');
const artifactDir=path.join(root,'artifacts','responsive');
fs.mkdirSync(artifactDir,{recursive:true});

function mime(file){
  return ({'.html':'text/html; charset=utf-8','.mjs':'text/javascript; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json; charset=utf-8','.svg':'image/svg+xml','.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.webp':'image/webp','.wasm':'application/wasm'}[path.extname(file).toLowerCase()]||'application/octet-stream');
}
function startStaticServer(){
  const server=http.createServer((req,res)=>{
    try{
      const url=new URL(req.url||'/',`http://${req.headers.host||'127.0.0.1'}`);
      let pathname=decodeURIComponent(url.pathname);
      if(pathname.endsWith('/'))pathname+='index.html';
      const file=path.resolve(root,`.${pathname}`);
      if(file!==root&&!file.startsWith(root+path.sep)){res.writeHead(403);res.end('Forbidden');return}
      if(!fs.existsSync(file)||!fs.statSync(file).isFile()){res.writeHead(404,{'Content-Type':'text/plain'});res.end('Not found');return}
      res.writeHead(200,{'Content-Type':mime(file),'Cache-Control':'no-store'});
      fs.createReadStream(file).pipe(res);
    }catch(error){res.writeHead(500,{'Content-Type':'text/plain'});res.end(String(error?.message||error))}
  });
  return new Promise(resolve=>server.listen(0,'127.0.0.1',()=>resolve(server)));
}

function startFakeExo(){
  let placed=false;
  const modelId='mlx-community/Qwen3-browser-sim';
  const json=(res,status,payload)=>{
    res.writeHead(status,{'Content-Type':'application/json','Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'Content-Type','Access-Control-Allow-Methods':'GET,POST,OPTIONS'});
    res.end(JSON.stringify(payload));
  };
  const state=()=>({
    topology:{nodes:['node-browser-sim'],connections:{}},
    instances:placed?{'instance-browser-sim':{MlxRingInstance:{shardAssignments:{modelId,runnerToShard:{},nodeToRunner:{'node-browser-sim':'runner'}}}}}:{},
    tasks:{},
    nodeIdentities:{'node-browser-sim':{friendlyName:'Browser simulated desktop',modelId:'Sim workstation',chipId:'SimGPU',osVersion:'simOS'}},
    nodeMemory:{'node-browser-sim':{ramTotal:{inBytes:64*1024**3},ramAvailable:{inBytes:48*1024**3}}},
    nodeSystem:{'node-browser-sim':{gpuUsage:0.38,temp:51,sysPower:92}},
    nodeDisk:{'node-browser-sim':{total:{inBytes:1024**4},available:{inBytes:700*1024**3}}},
    lastEventAppliedIdx:9
  });
  const server=http.createServer(async(req,res)=>{
    const url=new URL(req.url||'/',`http://${req.headers.host||'127.0.0.1'}`);
    if(req.method==='OPTIONS'){res.writeHead(204,{'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'Content-Type','Access-Control-Allow-Methods':'GET,POST,OPTIONS'});res.end();return}
    if(url.pathname==='/'){res.writeHead(200,{'Content-Type':'text/html; charset=utf-8','Access-Control-Allow-Origin':'*'});res.end('<!doctype html><meta name="viewport" content="width=device-width"><body style="margin:0;background:#07110f;color:#dff7ed;font-family:system-ui"><main style="padding:24px"><h1>Simulated exo dashboard</h1><p>CI-only native-dashboard stand-in.</p></main></body>');return}
    if(url.pathname==='/node_id')return json(res,200,{node_id:'node-browser-sim'});
    if(url.pathname==='/state')return json(res,200,state());
    if(url.pathname==='/v1/feature-flags')return json(res,200,{disaggregation:false});
    if(url.pathname==='/v1/models')return json(res,200,{object:'list',data:[{id:modelId,object:'model'}]});
    if(url.pathname==='/place_instance'&&req.method==='POST'){placed=true;return json(res,200,{message:'Command received.',command_id:'browser-sim-command',model_card:{model_id:modelId}})}
    if(url.pathname==='/instance/await'){res.writeHead(200,{'Content-Type':'text/event-stream','Access-Control-Allow-Origin':'*'});res.end(placed?`data: {"type":"ready","instance":{"MlxRingInstance":{"shardAssignments":{"modelId":"${modelId}"}}}}\n\n`:`data: {"type":"timeout","message":"No instance"}\n\n`);return}
    if(url.pathname==='/v1/chat/completions'&&req.method==='POST'){return json(res,200,{id:'browser-sim-chat',choices:[{index:0,message:{role:'assistant',content:'EXO_OK'},finish_reason:'stop'}]})}
    json(res,404,{detail:'not found'});
  });
  return new Promise(resolve=>server.listen(0,'127.0.0.1',()=>resolve({server,modelId})));
}

function serverPort(server){const address=server.address();assert.ok(address&&typeof address==='object');return address.port}
async function closeServer(server){await new Promise(resolve=>server.close(resolve))}

const surfaces=[
  ['local-lab','/local/'],
  ['workbench','/local/workbench/'],
  ['swarm','/local/swarm/'],
  ['exo-runtime','/local/exo-dashboard/?tab=runtime'],
  ['exo-setup','/local/exo-dashboard/?tab=setup'],
  ['encounter','/local/encounter/'],
  ['live-theater','/live/']
];
const viewports=[
  {width:320,height:720},
  {width:360,height:800},
  {width:390,height:844},
  {width:768,height:1024},
  {width:1024,height:768},
  {width:1440,height:900}
];

const staticServer=await startStaticServer();
const {server:exoServer}=await startFakeExo();
const base=`http://127.0.0.1:${serverPort(staticServer)}`;
const exoEndpoint=`http://127.0.0.1:${serverPort(exoServer)}`;
const browser=await chromium.launch({headless:true});
const report={generatedAt:new Date().toISOString(),viewports,surfaces:[],exoSimulation:null};

try{
  for(const viewport of viewports){
    const context=await browser.newContext({viewport});
    for(const [name,url] of surfaces){
      const page=await context.newPage();
      const pageErrors=[];page.on('pageerror',error=>pageErrors.push(String(error.message||error)));
      await page.goto(base+url,{waitUntil:'domcontentloaded',timeout:30000});
      await page.waitForTimeout(250);
      const audit=await page.evaluate(()=>{
        const viewportWidth=document.documentElement.clientWidth;
        const docOverflow=document.documentElement.scrollWidth-viewportWidth;
        const semantic=[...document.querySelectorAll('button,a,input,select,textarea,[role="button"],.panel,.card,.cell,.layout,.workspace,.controls,.cs-appbar')];
        const visible=element=>{const style=getComputedStyle(element);const rect=element.getBoundingClientRect();const intentionallyOffscreen=(element.matches('.skip,.skip-link,[class*="skip-link"]')||element.getAttribute('href')==='#main')&&document.activeElement!==element;return !intentionallyOffscreen&&style.display!=='none'&&style.visibility!=='hidden'&&style.opacity!=='0'&&rect.width>0&&rect.height>0};
        const inHorizontalScroller=element=>{for(let node=element.parentElement;node;node=node.parentElement){const style=getComputedStyle(node);if(['auto','scroll'].includes(style.overflowX))return true}return false};
        const offenders=[];
        for(const element of semantic){
          if(!visible(element)||inHorizontalScroller(element))continue;
          const rect=element.getBoundingClientRect();
          if(rect.width>viewportWidth+1||rect.left<-1||rect.right>viewportWidth+1)offenders.push({tag:element.tagName,id:element.id||null,className:String(element.className||'').slice(0,100),left:Math.round(rect.left),right:Math.round(rect.right),width:Math.round(rect.width)});
        }
        const smallTargets=[...document.querySelectorAll('button,input,select')].filter(visible).filter(element=>element.getBoundingClientRect().height<40).map(element=>({tag:element.tagName,id:element.id||null,height:Math.round(element.getBoundingClientRect().height)}));
        return {viewportWidth,scrollWidth:document.documentElement.scrollWidth,docOverflow,offenders,smallTargets};
      });
      const result={name,url,viewport,audit,pageErrors};
      report.surfaces.push(result);
      if(audit.docOverflow>1||audit.offenders.length||(viewport.width<=760&&audit.smallTargets.length)){
        const filename=`${name}-${viewport.width}x${viewport.height}.png`;
        await page.screenshot({path:path.join(artifactDir,filename),fullPage:true});
        throw new Error(`${name} failed responsive audit at ${viewport.width}px: overflow=${audit.docOverflow}, offenders=${JSON.stringify(audit.offenders)}, smallTargets=${JSON.stringify(audit.smallTargets)}`);
      }
      await page.close();
    }
    await context.close();
  }

  const context=await browser.newContext({viewport:{width:390,height:844}});
  const page=await context.newPage();
  await page.goto(`${base}/local/exo-dashboard/?endpoint=${encodeURIComponent(exoEndpoint)}&tab=test`,{waitUntil:'domcontentloaded'});
  await page.locator('#runTest').click();
  await page.locator('#resultBanner.pass').waitFor({timeout:15000});
  assert.match(await page.locator('#resultBanner').innerText(),/PASS/);
  assert.equal((await page.locator('#testOutput').innerText()).trim(),'EXO_OK');

  const runtimeTab=page.locator('.appTab[data-view="runtime"]');
  await runtimeTab.click();
  await page.locator('#runtimeGrid').getByText('1',{exact:true}).first().waitFor({timeout:5000});
  assert.match(await page.locator('#runtimeNodes').innerText(),/Browser simulated desktop/);

  const workbench=await context.newPage();
  const workbenchErrors=[];const workbenchConsole=[];
  workbench.on('pageerror',error=>workbenchErrors.push(String(error?.stack||error)));
  workbench.on('console',message=>{if(['error','warning'].includes(message.type()))workbenchConsole.push(`${message.type()}: ${message.text()}`)});
  await workbench.goto(`${base}/local/workbench/?provider=exo&endpoint=${encodeURIComponent(exoEndpoint)}`,{waitUntil:'domcontentloaded'});
  try{
    await workbench.locator('#exoStatus.ok').waitFor({timeout:10000});
  }catch(error){
    const exoStatus=await workbench.locator('#exoStatus').innerText().catch(()=>'<missing>');
    throw new Error(`Compact app exo auto-connect timed out. exoStatus=${exoStatus}; pageErrors=${JSON.stringify(workbenchErrors)}; console=${JSON.stringify(workbenchConsole)}; cause=${error.message}`);
  }
  assert.match(await workbench.locator('#exoStatus').innerText(),/1 node\(s\)/);
  assert.match(await workbench.locator('#exoMetrics').innerText(),/1\s*nodes/);
  await workbench.locator('.tab[data-tab="chat"]').click();
  await workbench.locator('#prompt').fill('Return the compact integration token.');
  await workbench.locator('#composer').evaluate(form=>form.requestSubmit());
  await workbench.getByText('EXO_OK',{exact:true}).waitFor({timeout:10000});
  report.exoSimulation={status:'pass',endpoint:'simulated',acceptanceText:await page.locator('#resultBanner').innerText(),workbenchStatus:await workbench.locator('#exoStatus').innerText(),compactChat:'EXO_OK'};
  await context.close();

  fs.writeFileSync(path.join(artifactDir,'report.json'),JSON.stringify(report,null,2));
  console.log(`Responsive browser verification passed: ${surfaces.length} surfaces × ${viewports.length} viewport sizes, plus simulated exo acceptance and compact Chat/Runtime inference.`);
}catch(error){
  report.failure=String(error?.stack||error);
  fs.writeFileSync(path.join(artifactDir,'report.json'),JSON.stringify(report,null,2));
  throw error;
}finally{
  await browser.close();
  await closeServer(exoServer);
  await closeServer(staticServer);
}
