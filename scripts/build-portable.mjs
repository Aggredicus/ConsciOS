import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';

const manifestText=readFileSync('runtime/portable-build-manifest.json','utf8');
const manifest=JSON.parse(manifestText);
if(!Array.isArray(manifest.modules)||!manifest.entry||!manifest.labBadge||!manifest.portableBadge)throw new Error('portable build manifest is invalid');

function transform(source,replacements={}){
  let out=source;
  for(const [from,to] of Object.entries(replacements))out=out.replaceAll(`'${from}'`,`'${to}'`).replaceAll(`"${from}"`,`"${to}"`);
  return out;
}

const imports={};
const digest=createHash('sha256').update(manifestText).update('\0');
for(const module of manifest.modules){
  const {id,path,rewrite={}}=module;
  const original=readFileSync(path,'utf8');
  digest.update(id).update('\0').update(original).update('\0');
  const transformed=transform(original,rewrite);
  if(/from\s+['"]\.\.?\//.test(transformed))throw new Error(`relative import remains in ${path}`);
  imports[id]=`data:text/javascript;base64,${Buffer.from(transformed,'utf8').toString('base64')}`;
}
if(!imports[manifest.entry])throw new Error(`entry module ${manifest.entry} is not present`);
const sourceDigest=digest.digest('hex');

let html=readFileSync('runtime/modular-demo.html','utf8');
const externalTag='<script type="module" src="./modular-ui.mjs"></script>';
if(!html.includes(externalTag))throw new Error('modular demo bootstrap tag not found');
if(!html.includes(manifest.labBadge))throw new Error('modular demo badge does not match portable manifest');

const importMap=JSON.stringify({imports},null,2);
const inlineBootstrap=`<script type="importmap">\n${importMap}\n</script>\n<script type="module">import '${manifest.entry}';</script>`;
html=html.replace(externalTag,inlineBootstrap);
html=html.replace(manifest.labBadge,manifest.portableBadge);
html=html.replace('</head>',`<meta name="conscios-source-digest" content="${sourceDigest}">\n<!-- GENERATED FILE: source of truth is the modular cognition/runtime tree. -->\n</head>`);

mkdirSync('dist',{recursive:true});
writeFileSync('dist/conscios-modular.html',html,'utf8');
console.log(`Built dist/conscios-modular.html (${Buffer.byteLength(html)} bytes)`);
console.log(`Source digest: ${sourceDigest}`);
