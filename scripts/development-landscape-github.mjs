#!/usr/bin/env node
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import {execFileSync} from 'node:child_process';

const KIND='conscios-development-landscape';
const argv=process.argv.slice(2);
const arg=(name,fallback=null)=>{const i=argv.indexOf(name);return i>=0?argv[i+1]:fallback;};
const num=(name,fallback)=>Math.max(0,Number(arg(name,fallback))||fallback);
const hash=value=>crypto.createHash('sha256').update(typeof value==='string'?value:JSON.stringify(value)).digest('hex');
const slug=value=>String(value).replace(/[^\w.:@/+~-]+/g,'-');
const edgeKey=e=>`${e.source}|${e.type}|${e.target}`;
const write=(file,value)=>{fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,JSON.stringify(value,null,2)+'\n');};
const now=()=>new Date().toISOString();

function inferSelfRepo(){
  try{
    const url=execFileSync('git',['remote','get-url','origin'],{encoding:'utf8',stdio:['ignore','pipe','ignore']}).trim();
    const m=url.match(/github\.com[/:]([^/]+)\/([^/]+?)(?:\.git)?$/i);
    return m?`${m[1]}/${m[2]}`:null;
  }catch{return null}
}

function profiles(){
  return {
    observer:{past:{read:true},present:{read:true},future:{projectGraph:true,simulate:true}},
    counterfactual:{
      past:{read:true,branchFrom:{allow:true,requireReason:true}},
      present:{read:true,createBranch:{allow:true,requireReason:true}},
      future:{projectGraph:true,simulate:true,createWorktree:{allow:true,requireReason:true}}
    },
    developer:{
      past:{read:true,branchFrom:{allow:true,requireReason:true}},
      present:{read:true,editWorktree:{allow:true,requireReason:true},createCommit:{allow:true,requireReason:true},createBranch:true},
      future:{projectGraph:true,simulate:true,createWorktree:true}
    }
  };
}

class GitHub {
  constructor(token){this.token=token||null;this.requests=0;}
  async get(url,{allowEmpty=false}={}){
    const headers={Accept:'application/vnd.github+json','X-GitHub-Api-Version':'2022-11-28','User-Agent':'ConsciOS-Development-Landscape'};
    if(this.token)headers.Authorization=`Bearer ${this.token}`;
    const response=await fetch(url,{headers,signal:AbortSignal.timeout(30000)});
    this.requests++;
    if(allowEmpty&&(response.status===404||response.status===409))return [];
    if(!response.ok){
      const body=(await response.text()).slice(0,500);
      throw new Error(`GitHub HTTP ${response.status} for ${url}: ${body}`);
    }
    return response.json();
  }
}

async function listOwnedRepos(gh,owner){
  const rows=[];
  for(let page=1;page<=20;page++){
    const url=gh.token
      ? `https://api.github.com/user/repos?affiliation=owner&visibility=all&sort=full_name&per_page=100&page=${page}`
      : `https://api.github.com/users/${encodeURIComponent(owner)}/repos?type=owner&sort=full_name&per_page=100&page=${page}`;
    const pageRows=await gh.get(url);
    const filtered=pageRows.filter(r=>String(r.owner?.login||'').toLowerCase()===owner.toLowerCase());
    rows.push(...filtered);
    if(pageRows.length<100)break;
  }
  return rows;
}

async function commitPage(gh,fullName,page){
  const url=`https://api.github.com/repos/${fullName}/commits?per_page=100&page=${page}`;
  return gh.get(url,{allowEmpty:true});
}

async function branchRows(gh,fullName,maxBranches){
  const out=[];
  for(let page=1;page<=Math.ceil(maxBranches/100);page++){
    const rows=await gh.get(`https://api.github.com/repos/${fullName}/branches?per_page=100&page=${page}`,{allowEmpty:true});
    out.push(...rows.slice(0,Math.max(0,maxBranches-out.length)));
    if(rows.length<100||out.length>=maxBranches)break;
  }
  return out;
}

function commitRecord(repo,row){
  const date=row.commit?.committer?.date||row.commit?.author?.date||null;
  return {
    id:`commit:${repo}:${row.sha}`,
    type:'Commit',
    label:String(row.commit?.message||row.sha).split(/\r?\n/)[0].slice(0,240),
    repo,
    timestamp:date,
    w:date?Date.parse(date):null,
    properties:{
      sha:row.sha,
      parentShas:(row.parents||[]).map(p=>p.sha),
      authorLogin:row.author?.login||null,
      committerLogin:row.committer?.login||null
    },
    provenance:[`github:${repo}`]
  };
}

async function collectHistories(gh,repos,cap,chunk){
  const states=repos.map(repo=>({repo,page:1,queue:[],loaded:[],complete:false,error:null}));
  for(const s of states){
    try{
      s.queue=await commitPage(gh,s.repo.full_name,1);
      if(s.queue.length<100)s.complete=true;
    }catch(error){s.error=String(error.message||error);s.complete=false;s.queue=[];}
  }
  let total=0;
  while(total<cap){
    let progressed=false;
    for(const s of states){
      if(total>=cap)break;
      if(!s.queue.length&&!s.complete&&!s.error){
        s.page++;
        try{
          s.queue=await commitPage(gh,s.repo.full_name,s.page);
          if(s.queue.length<100)s.complete=true;
        }catch(error){s.error=String(error.message||error);s.queue=[];}
      }
      if(!s.queue.length)continue;
      const take=Math.min(chunk,s.queue.length,cap-total);
      s.loaded.push(...s.queue.splice(0,take));
      total+=take;
      progressed=progressed||take>0;
    }
    if(!progressed)break;
  }
  for(const s of states)if(s.queue.length)s.complete=false;
  return states;
}

async function build(){
  const tokenEnv=arg('--token-env','GITHUB_TOKEN');
  const token=process.env[tokenEnv]||null;
  const selfRepo=arg('--self-repo',inferSelfRepo());
  const owner=arg('--owner',selfRepo?.split('/')[0]||null);
  if(!owner)throw new Error('--owner is required when the current Git remote cannot identify a GitHub owner');
  const cap=num('--commit-cap',10000);
  const chunk=Math.max(1,Math.min(100,num('--round-robin-chunk',25)));
  const maxBranches=Math.max(1,Math.min(1000,num('--max-branches-per-repo',300)));
  const output=path.resolve(arg('--out','artifacts/development-landscape/current.json'));
  const gh=new GitHub(token);
  const repos=await listOwnedRepos(gh,owner);
  if(!repos.length)throw new Error(`No repositories found for GitHub owner ${owner}`);

  const states=await collectHistories(gh,repos,cap,chunk);
  const landscapeId=`github:${owner}`;
  const landscapeNodeId=`landscape:${slug(landscapeId)}`;
  const nodes=[{id:landscapeNodeId,type:'DevelopmentLandscape',label:`${owner} GitHub development landscape`,provenance:['github-owner']}];
  const edges=[];
  const repoRows=[];
  const known=new Set([landscapeNodeId]);

  for(const s of states){
    const full=s.repo.full_name;
    const repoId=full===selfRepo?'repository:self':`repository:${slug(full)}`;
    known.add(repoId);
    const row={
      id:repoId,
      name:s.repo.name,
      fullName:full,
      role:full===selfRepo?'self':'neighbor',
      visibility:s.repo.private?'private':'public',
      defaultBranch:s.repo.default_branch||null,
      originUrl:s.repo.html_url||null,
      fork:Boolean(s.repo.fork),
      archived:Boolean(s.repo.archived),
      commitCount:s.loaded.length,
      includedCommits:s.loaded.length,
      totalKnown:Boolean(s.complete&&!s.error),
      truncated:!s.complete,
      historyComplete:Boolean(s.complete&&!s.error),
      historyScope:'default-branch',
      error:s.error
    };
    repoRows.push(row);
    nodes.push({id:repoId,type:'Repository',label:full,repo:repoId,properties:row,provenance:[`github:${full}`]});
    edges.push({id:`edge:${hash(`${landscapeNodeId}|LANDSCAPE_CONTAINS|${repoId}`).slice(0,24)}`,type:'LANDSCAPE_CONTAINS',source:landscapeNodeId,target:repoId,confidence:1,provenance:['github-owner']});

    const loadedShas=new Set(s.loaded.map(c=>c.sha));
    for(const raw of s.loaded){
      const n=commitRecord(repoId,raw);
      known.add(n.id);
      nodes.push(n);
      edges.push({id:`edge:${hash(`${n.id}|STATE_OF|${repoId}`).slice(0,24)}`,type:'STATE_OF',source:n.id,target:repoId,confidence:1,provenance:[`github:${full}`]});
    }
    for(const raw of s.loaded){
      for(const parent of raw.parents||[]){
        if(!loadedShas.has(parent.sha))continue;
        edges.push({id:`edge:${hash(`${parent.sha}|PARENT_OF|${raw.sha}|${repoId}`).slice(0,24)}`,type:'PARENT_OF',source:`commit:${repoId}:${parent.sha}`,target:`commit:${repoId}:${raw.sha}`,confidence:1,provenance:[`github:${full}`]});
      }
    }

    try{
      const branches=await branchRows(gh,full,maxBranches);
      row.branchesLoaded=branches.length;
      row.branchesTruncated=branches.length>=maxBranches;
      for(const b of branches){
        const branchId=`branch:${repoId}:${slug(b.name)}`;
        known.add(branchId);
        nodes.push({id:branchId,type:'Branch',label:b.name,repo:repoId,properties:{tipSha:b.commit?.sha||null},provenance:[`github:${full}`]});
        edges.push({id:`edge:${hash(`${branchId}|BRANCH_OF|${repoId}`).slice(0,24)}`,type:'BRANCH_OF',source:branchId,target:repoId,confidence:1,provenance:[`github:${full}`]});
        if(b.commit?.sha&&loadedShas.has(b.commit.sha)){
          edges.push({id:`edge:${hash(`${branchId}|HEAD_OF|${b.commit.sha}`).slice(0,24)}`,type:'HEAD_OF',source:branchId,target:`commit:${repoId}:${b.commit.sha}`,confidence:1,provenance:[`github:${full}`]});
        }
      }
    }catch(error){
      row.branchError=String(error.message||error);
    }
  }

  const uniqueEdges=[...new Map(edges.map(e=>[edgeKey(e),e])).values()];
  for(const e of uniqueEdges)if(!known.has(e.source)||!known.has(e.target))throw new Error(`dangling edge ${edgeKey(e)}`);
  nodes.sort((a,b)=>a.id.localeCompare(b.id));
  uniqueEdges.sort((a,b)=>edgeKey(a).localeCompare(edgeKey(b)));
  const included=repoRows.reduce((n,r)=>n+r.includedCommits,0);
  const complete=repoRows.every(r=>r.historyComplete);
  const artifact={
    version:1,
    kind:KIND,
    generatedAt:now(),
    landscapeId,
    source:{
      kind:'github-owner',
      owner,
      authenticated:Boolean(token),
      globalCommitCap:cap,
      includedCommits:included,
      totalCommits:included,
      totalCommitsKnown:complete,
      totalCommitsLowerBound:included,
      truncated:!complete,
      historyScope:'default-branch',
      allocationPolicy:`round-robin-${chunk}`,
      apiRequests:gh.requests
    },
    capabilityProfiles:profiles(),
    repositories:repoRows,
    nodes,
    edges:uniqueEdges
  };
  artifact.landscapeHash=hash(JSON.stringify({repos:repoRows.map(r=>[r.id,r.includedCommits,r.historyComplete]),nodes:nodes.map(n=>n.id),edges:uniqueEdges.map(edgeKey)}));
  write(output,artifact);
  console.log(JSON.stringify({out:output,owner,repositories:repoRows.length,includedCommits:included,truncated:artifact.source.truncated,apiRequests:gh.requests,landscapeHash:artifact.landscapeHash}));
}

await build();
