#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const argv=process.argv.slice(2);
const arg=(n,d=null)=>{const i=argv.indexOf(n);return i>=0?argv[i+1]:d};
const template=arg('--template','tools/self-model-studio/index.html');
const data=arg('--data');
const history=arg('--history');
const tooltip=arg('--tooltip','tools/self-model-studio/tooltip.js');
const out=arg('--out','artifacts/self-model/studio/index.html');
if(!data)throw new Error('--data is required');

const safePayload=value=>JSON.stringify(value).replace(/</g,'\\u003c').replace(/>/g,'\\u003e').replace(/&/g,'\\u0026').replace(/\u2028/g,'\\u2028').replace(/\u2029/g,'\\u2029');
const html=fs.readFileSync(template,'utf8');
const graph=JSON.parse(fs.readFileSync(data,'utf8'));
const graphMarker='<script id="graph-data" type="application/json">{"embedded":false}</script>';
if(!html.includes(graphMarker))throw new Error('graph-data marker missing from template');
let bundled=html.replace(graphMarker,`<script id="graph-data" type="application/json">${safePayload(graph)}</script>`);

let temporal=null;
if(history){
  temporal=JSON.parse(fs.readFileSync(history,'utf8'));
  const historyMarker='<script id="history-data" type="application/json">{"embedded":false}</script>';
  if(!bundled.includes(historyMarker))throw new Error('history-data marker missing from template');
  bundled=bundled.replace(historyMarker,`<script id="history-data" type="application/json">${safePayload(temporal)}</script>`);
}

if(fs.existsSync(tooltip)){
  const enhancement=fs.readFileSync(tooltip,'utf8').replace(/<\/script/gi,'<\\/script');
  const close='</body>';
  if(!bundled.includes(close))throw new Error('body closing tag missing from template');
  bundled=bundled.replace(close,`<script>${enhancement}</script>\n${close}`);
}
fs.mkdirSync(path.dirname(out),{recursive:true});
fs.writeFileSync(out,bundled);
console.log(JSON.stringify({out,bytes:Buffer.byteLength(bundled),nodes:graph.nodes?.length||0,edges:graph.edges?.length||0,historyFrames:temporal?.frames?.length||0,tooltipEmbedded:fs.existsSync(tooltip)}));
