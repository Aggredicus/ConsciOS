#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
const argv=process.argv.slice(2);const arg=(n,d=null)=>{const i=argv.indexOf(n);return i>=0?argv[i+1]:d};
const template=arg('--template','tools/self-model-studio/index.html'),data=arg('--data'),out=arg('--out','artifacts/self-model/studio/index.html');if(!data)throw new Error('--data is required');
const html=fs.readFileSync(template,'utf8'),graph=JSON.parse(fs.readFileSync(data,'utf8'));let payload=JSON.stringify(graph).replace(/</g,'\\u003c').replace(/>/g,'\\u003e').replace(/&/g,'\\u0026').replace(/\u2028/g,'\\u2028').replace(/\u2029/g,'\\u2029');
const marker='<script id="graph-data" type="application/json">{"embedded":false}</script>';if(!html.includes(marker))throw new Error('graph-data marker missing from template');const bundled=html.replace(marker,`<script id="graph-data" type="application/json">${payload}</script>`);fs.mkdirSync(path.dirname(out),{recursive:true});fs.writeFileSync(out,bundled);console.log(JSON.stringify({out,bytes:Buffer.byteLength(bundled),nodes:graph.nodes?.length||0,edges:graph.edges?.length||0}));
