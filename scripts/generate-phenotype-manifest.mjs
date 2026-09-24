import fs from 'node:fs';import path from 'node:path';import crypto from 'node:crypto';import { execFileSync } from 'node:child_process';
const root=process.cwd();const config=JSON.parse(fs.readFileSync('phenotype/manifest.config.json','utf8'));const output=process.argv.find(x=>x.startsWith('--output='))?.slice(9);
function norm(p){return p.split(path.sep).join('/').replace(/^\.\//,'')}
function excluded(p){const n=norm(p);return config.excludePrefixes.some(x=>n.startsWith(x))}
function walk(rel){if(excluded(rel))return[];const full=path.join(root,rel);if(!fs.existsSync(full))return[];const s=fs.statSync(full);if(s.isFile())return[norm(rel)];return fs.readdirSync(full).flatMap(n=>walk(path.join(rel,n)))}
const paths=[...new Set(config.include.flatMap(walk))].sort();const files=paths.map(p=>{const data=fs.readFileSync(path.join(root,p));return{path:p,sha256:crypto.createHash('sha256').update(data).digest('hex'),bytes:data.length}});
const rootHash=crypto.createHash('sha256').update(files.map(x=>`${x.path}\0${x.sha256}\0${x.bytes}\n`).join('')).digest('hex');
let sourceCommit=process.env.GITHUB_SHA;try{sourceCommit=sourceCommit||execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim()}catch{sourceCommit=sourceCommit||'unknown'}
const manifest={version:1,sourceCommit,rootHash,files};const text=JSON.stringify(manifest,null,2)+'\n';if(output){fs.mkdirSync(path.dirname(path.resolve(output)),{recursive:true});fs.writeFileSync(output,text)}else process.stdout.write(text);
