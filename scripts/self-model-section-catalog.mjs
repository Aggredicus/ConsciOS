import fs from 'node:fs';
import path from 'node:path';

const targets=process.argv.slice(2).filter(Boolean);
if(!targets.length)targets.push('artifacts/self-model/current');
const CHUNK=120;

for(const targetArg of targets){
  const target=path.resolve(targetArg);
  const source=path.join(target,'index','sections.jsonl');
  if(!fs.existsSync(source))throw new Error(`Missing section index: ${source}`);
  const rows=fs.readFileSync(source,'utf8').split(/\r?\n/).filter(Boolean).map(line=>JSON.parse(line));
  const out=path.join(target,'index','catalog');
  fs.rmSync(out,{recursive:true,force:true});
  fs.mkdirSync(out,{recursive:true});
  const header='section_id\tstart\town_end\tsubtree_end\town_sha12\n';
  for(let i=0;i<rows.length;i+=CHUNK){
    const body=rows.slice(i,i+CHUNK).map(s=>[
      String(s.id).replace(/^section:/,''),
      s.startLine,
      s.ownEndLine,
      s.subtreeEndLine,
      String(s.ownSha256).slice(0,12)
    ].join('\t')).join('\n');
    fs.writeFileSync(path.join(out,`sections-${String(i/CHUNK).padStart(3,'0')}.tsv`),header+body+(body?'\n':''));
  }
  fs.writeFileSync(path.join(out,'catalog.json'),JSON.stringify({version:1,rows:rows.length,chunkSize:CHUNK,shards:Math.ceil(rows.length/CHUNK)},null,2)+'\n');
  console.log(`section catalog: ${rows.length} rows in ${Math.ceil(rows.length/CHUNK)} shards -> ${out}`);
}
