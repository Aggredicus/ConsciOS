#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {execFileSync} from 'node:child_process';

const ROOT=path.resolve(new URL('../../..',import.meta.url).pathname);
const run=(file,args=[],options={})=>execFileSync(process.execPath,[file,...args],{cwd:ROOT,encoding:'utf8',stdio:['ignore','pipe','pipe'],env:{...process.env,...(options.env||{})}}).trim();
const git=(cwd,args)=>execFileSync('git',args,{cwd,encoding:'utf8',stdio:['ignore','pipe','pipe']}).trim();

for(const file of [
  'scripts/development-landscape.mjs',
  'scripts/development-landscape-mcp.mjs',
  'scripts/development-landscape-github.mjs',
  'scripts/development-landscape-quality.mjs',
  'scripts/development-landscape-git.mjs',
  'scripts/development-landscape-git-mcp.mjs'
])execFileSync(process.execPath,['--check',file],{cwd:ROOT,stdio:'pipe'});

const landscape=JSON.parse(run('scripts/development-landscape.mjs',['--self-test']));
assert.equal(landscape.ok,true);
assert.equal(landscape.repositories,2);
assert.equal(landscape.includedCommits,4);
assert.equal(landscape.truncated,true);
assert.equal(landscape.authorization,true);
assert.equal(landscape.projection,true);
assert.equal(landscape.import4d,true);
assert.equal(landscape.workspaceContainment,true);

const quality=JSON.parse(run('scripts/development-landscape-quality.mjs',['--self-test']));
assert.equal(quality.ok,true);
assert.equal(quality.gatePass,false);
assert.equal(quality.delta.dependencyCycles,1);

const mcp=JSON.parse(run('scripts/development-landscape-mcp.mjs',['--self-test']));
assert.equal(mcp.ok,true);
assert.equal(mcp.networkListeners,0);
assert.equal(mcp.tools,4);

const gitMcp=JSON.parse(run('scripts/development-landscape-git-mcp.mjs',['--self-test']));
assert.equal(gitMcp.ok,true);
assert.equal(gitMcp.networkListeners,0);
assert.equal(gitMcp.tools,7);
assert.equal(gitMcp.mutationsEnabled,false);

for(const file of ['scripts/development-landscape-mcp.mjs','scripts/development-landscape-git-mcp.mjs']){
  const source=fs.readFileSync(path.join(ROOT,file),'utf8');
  assert(!/node:(http|https|net)|createServer\(|\.listen\(/.test(source),`${file} unexpectedly contains a network listener primitive`);
}

const studioSource=fs.readFileSync(path.join(ROOT,'tools/self-model-studio/index.html'),'utf8');
assert.match(studioSource,/id="repo"/);
assert.match(studioSource,/window\.ConsciOSStudio=/);
assert.match(studioSource,/from:e\.from\?\?e\.source/);
const studioScripts=[...studioSource.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/gi)].map(m=>m[1]).filter(x=>x.includes("(()=>{'use strict';"));
assert.equal(studioScripts.length,1,'expected one executable Self-Model Studio script');
const studioTemp=fs.mkdtempSync(path.join(os.tmpdir(),'conscios-studio-syntax-'));
try{
  const studioJs=path.join(studioTemp,'studio.mjs');fs.writeFileSync(studioJs,studioScripts[0]);execFileSync(process.execPath,['--check',studioJs],{stdio:'pipe'});
}finally{fs.rmSync(studioTemp,{recursive:true,force:true});}

const temp=fs.mkdtempSync(path.join(os.tmpdir(),'conscios-landscape-write-'));
try{
  const repo=path.join(temp,'repo');fs.mkdirSync(repo);
  git(repo,['init','-b','main']);
  git(repo,['config','user.email','landscape-test@example.invalid']);
  git(repo,['config','user.name','Landscape Test']);
  fs.writeFileSync(path.join(repo,'.gitignore'),'.runtime/\n');
  fs.writeFileSync(path.join(repo,'a.txt'),'alpha\n');
  git(repo,['add','.']);git(repo,['commit','-m','initial']);
  const first=git(repo,['rev-parse','HEAD']);
  const artifact=path.join(temp,'landscape.json');
  fs.writeFileSync(artifact,JSON.stringify({
    version:1,kind:'conscios-development-landscape',landscapeId:'test',landscapeHash:'test',
    source:{globalCommitCap:10,totalCommits:1,includedCommits:1,truncated:false,allocationPolicy:'test'},
    capabilityProfiles:{
      observer:{past:{read:true},present:{read:true}},
      developer:{past:{read:true,branchFrom:{allow:true,requireReason:true}},present:{read:true,editWorktree:{allow:true,requireReason:true},createCommit:{allow:true,requireReason:true},createBranch:true},future:{projectGraph:true,simulate:true,createWorktree:true}},
      counterfactual:{past:{read:true,branchFrom:{allow:true,requireReason:true}},present:{read:true,createBranch:{allow:true,requireReason:true}},future:{projectGraph:true,simulate:true,createWorktree:{allow:true,requireReason:true}}}
    },
    repositories:[{id:'repository:self',name:'repo',role:'self',localPath:repo,defaultBranch:'main',commitCount:1,includedCommits:1,truncated:false,historyComplete:true}],
    nodes:[{id:'repository:self',type:'Repository',label:'repo',repo:'repository:self'}],edges:[]
  },null,2));

  const base=['--landscape',artifact,'--repository','repository:self'];
  const status=JSON.parse(run('scripts/development-landscape-git.mjs',['status',...base]));
  assert.equal(status.branch,'main');assert.equal(status.writeEnabled,false);assert.equal(status.protectedBranch,true);

  const read=JSON.parse(run('scripts/development-landscape-git.mjs',['read-file',...base,'--profile','observer','--ref','HEAD','--file','a.txt']));
  assert.match(read.content,/alpha/);

  assert.throws(()=>run('scripts/development-landscape-git.mjs',['create-branch',...base,'--branch','feature/test','--reason','verification']),/writes are disabled/);

  const writeEnv={CONSCIOS_DEVELOPMENT_WRITE_ENABLE:'1'};
  const created=JSON.parse(run('scripts/development-landscape-git.mjs',['create-branch',...base,'--branch','feature/test','--reason','verification'],{env:writeEnv}));
  assert.equal(created.branch,'feature/test');
  git(repo,['checkout','feature/test']);
  const contentFile=path.join(temp,'content.txt');fs.writeFileSync(contentFile,'beta\n');
  const written=JSON.parse(run('scripts/development-landscape-git.mjs',['write-file',...base,'--file','b.txt','--content-file',contentFile,'--reason','verification'],{env:writeEnv}));
  assert.equal(written.branch,'feature/test');
  git(repo,['add','b.txt']);
  const committed=JSON.parse(run('scripts/development-landscape-git.mjs',['commit-staged',...base,'--message','add beta','--reason','verification'],{env:writeEnv}));
  assert.equal(committed.branch,'feature/test');
  assert.notEqual(committed.head,first);

  const counterfactual=JSON.parse(run('scripts/development-landscape-git.mjs',['counterfactual-worktree',...base,'--profile','counterfactual','--ref','main','--name','past-a','--reason','compare historical alternative'],{env:writeEnv}));
  assert.equal(counterfactual.branch,'counterfactual/past-a');
  assert.ok(fs.existsSync(counterfactual.worktree));
  assert.equal(git(counterfactual.worktree,['rev-parse','HEAD']),first);
}finally{fs.rmSync(temp,{recursive:true,force:true});}

console.log(JSON.stringify({ok:true,landscape,quality,mcp,gitMcp,temporalGit:true}));
