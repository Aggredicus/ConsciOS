#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {execFileSync} from 'node:child_process';

const ROOT=path.resolve(new URL('../../..',import.meta.url).pathname);
const run=(file,args=[])=>execFileSync(process.execPath,[file,...args],{cwd:ROOT,encoding:'utf8',stdio:['ignore','pipe','pipe']}).trim();
const landscape=JSON.parse(run('scripts/development-landscape.mjs',['--self-test']));
assert.equal(landscape.ok,true);
assert.equal(landscape.repositories,2);
assert.equal(landscape.includedCommits,4);
assert.equal(landscape.truncated,true);
assert.equal(landscape.authorization,true);
assert.equal(landscape.projection,true);
assert.equal(landscape.import4d,true);

const mcp=JSON.parse(run('scripts/development-landscape-mcp.mjs',['--self-test']));
assert.equal(mcp.ok,true);
assert.equal(mcp.networkListeners,0);
assert.equal(mcp.tools,4);

for(const file of ['scripts/development-landscape.mjs','scripts/development-landscape-mcp.mjs']){
  const source=fs.readFileSync(path.join(ROOT,file),'utf8');
  assert(!/node:(http|https|net)|createServer\(|\.listen\(/.test(source),`${file} unexpectedly contains a network listener primitive`);
}
console.log(JSON.stringify({ok:true,landscape,mcp}));
