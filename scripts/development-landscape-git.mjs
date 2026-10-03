#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import {execFileSync} from 'node:child_process';

const argv=process.argv.slice(2);
const cmd=argv[0]&&!argv[0].startsWith('--')?argv.shift():'status';
const arg=(name,fallback=null)=>{const i=argv.indexOf(name);return i>=0?argv[i+1]:fallback;};
const clean=value=>String(value??'').slice(0,512);
const validRef=value=>typeof value==='string'&&value.length<=160&&!value.startsWith('-')&&!value.includes('..')&&/^[A-Za-z0-9._/@+~^-]+$/.test(value);
const validBranch=value=>validRef(value)&&!value.endsWith('/')&&!value.includes('//');
const readJson=file=>JSON.parse(fs.readFileSync(path.resolve(file),'utf8'));
const MAX_READ_BYTES=512*1024;
const MAX_WRITE_BYTES=1024*1024;

function git(root,args,{soft=false,input=null}={}){
  try{return execFileSync('git',args,{cwd:root,encoding:'utf8',input,stdio:['pipe','pipe','pipe'],maxBuffer:8*1024*1024}).trim();}
  catch(error){if(soft)return'';throw new Error((error.stderr||error.message||String(error)).toString().trim());}
}
function loadLandscape(){
  const file=arg('--landscape',process.env.CONSCIOS_DEVELOPMENT_LANDSCAPE||'artifacts/development-landscape/current.json');
  const data=readJson(file);
  if(data.kind!=='conscios-development-landscape')throw new Error('unsupported Development Landscape artifact');
  return data;
}
function repoFrom(data,selector){
  const s=clean(selector||'repository:self');
  const repo=(data.repositories||[]).find(r=>r.id===s||r.fullName===s||r.name===s);
  if(!repo)throw new Error(`unknown repository: ${s}`);
  if(!repo.localPath)throw new Error(`repository ${s} has no localPath; clone it locally and rebuild the landscape before using Git execution`);
  const root=fs.realpathSync(repo.localPath);
  if(git(root,['rev-parse','--is-inside-work-tree'],{soft:true})!=='true')throw new Error(`not a Git worktree: ${root}`);
  return {repo,root};
}
function authorization(data,profile,temporalScope,operation,reason=''){
  const value=data.capabilityProfiles?.[profile]?.[temporalScope]?.[operation];
  let allowed=value===true,requireReason=false,policyReason=null;
  if(value&&typeof value==='object'){
    allowed=value.allow===true;requireReason=value.requireReason===true;policyReason=value.reason||null;
    if(allowed&&requireReason&&!String(reason).trim()){allowed=false;policyReason='reason-required';}
  }
  return {allowed,profile,temporalScope,operation,requireReason,reason:allowed?null:(policyReason||'not-authorized')};
}
function requireAuth(data,profile,time,operation,reason){
  const decision=authorization(data,profile,time,operation,reason);
  if(!decision.allowed)throw new Error(`capability denied: ${JSON.stringify(decision)}`);
  return decision;
}
function requireWrites(){
  if(process.env.CONSCIOS_DEVELOPMENT_WRITE_ENABLE!=='1')throw new Error('development writes are disabled; set CONSCIOS_DEVELOPMENT_WRITE_ENABLE=1 explicitly');
}
function currentBranch(root){return git(root,['branch','--show-current'],{soft:true})||null;}
function protectedBranches(repo){
  return new Set([repo.defaultBranch,'main','master'].filter(Boolean));
}
function assertWritableBranch(root,repo){
  const branch=currentBranch(root);
  if(!branch)throw new Error('detached HEAD is not writable through this adapter');
  if(protectedBranches(repo).has(branch))throw new Error(`protected branch ${branch} cannot be modified through the Development Landscape adapter`);
  return branch;
}
function safePath(root,relative,{allowMissing=true}={}){
  if(!relative||path.isAbsolute(relative))throw new Error('file path must be relative to the repository');
  const normalized=path.posix.normalize(relative.replaceAll('\\','/'));
  if(normalized==='..'||normalized.startsWith('../')||normalized.includes('/../'))throw new Error('file path escapes repository');
  const target=path.resolve(root,normalized),realRoot=fs.realpathSync(root);
  const parent=path.dirname(target);let probe=parent;
  while(!fs.existsSync(probe)){const next=path.dirname(probe);if(next===probe)break;probe=next;}
  const realParent=fs.realpathSync(probe);
  if(realParent!==realRoot&&!realParent.startsWith(realRoot+path.sep))throw new Error('file parent escapes repository through symlink');
  if(fs.existsSync(target)&&fs.lstatSync(target).isSymbolicLink())throw new Error('refusing to write through a symlink');
  if(!allowMissing&&!fs.existsSync(target))throw new Error('file does not exist');
  return {target,normalized};
}
function status(data,selector){
  const {repo,root}=repoFrom(data,selector);
  const branch=currentBranch(root),head=git(root,['rev-parse','HEAD']),porcelain=git(root,['status','--porcelain=v1'],{soft:true});
  return {repository:repo.id,root,branch,head,clean:!porcelain,changes:porcelain?porcelain.split(/\r?\n/).filter(Boolean):[],writeEnabled:process.env.CONSCIOS_DEVELOPMENT_WRITE_ENABLE==='1',protectedBranch:branch?protectedBranches(repo).has(branch):true};
}
function readFileAt(data,args){
  const {repo,root}=repoFrom(data,args.repository),ref=clean(args.ref||'HEAD'),file=clean(args.file);
  if(!validRef(ref))throw new Error('invalid Git ref');
  if(!file||path.isAbsolute(file)||file.includes('..'))throw new Error('invalid repository file path');
  requireAuth(data,args.profile||'observer',ref==='HEAD'?'present':'past','read',args.reason||'');
  const out=git(root,['show',`${ref}:${file}`]);
  if(Buffer.byteLength(out)>MAX_READ_BYTES)throw new Error(`file exceeds read cap of ${MAX_READ_BYTES} bytes`);
  return {repository:repo.id,ref,file,content:out};
}
function createBranch(data,args){
  requireWrites();const {repo,root}=repoFrom(data,args.repository),profile=args.profile||'developer',reason=args.reason||'',branch=clean(args.branch),ref=clean(args.ref||'HEAD');
  requireAuth(data,profile,'present','createBranch',reason);
  if(!validBranch(branch)||protectedBranches(repo).has(branch))throw new Error('invalid or protected branch name');
  if(!validRef(ref))throw new Error('invalid ref');
  if(git(root,['show-ref','--verify',`refs/heads/${branch}`],{soft:true}))throw new Error('branch already exists');
  git(root,['branch',branch,ref]);
  return {repository:repo.id,operation:'createBranch',branch,ref,reason};
}
function counterfactualWorktree(data,args){
  requireWrites();const {repo,root}=repoFrom(data,args.repository),profile=args.profile||'counterfactual',reason=args.reason||'',ref=clean(args.ref),name=clean(args.name);
  if(!validRef(ref))throw new Error('valid historical ref required');
  if(!name||!/^[A-Za-z0-9._-]{1,80}$/.test(name))throw new Error('name must use letters, numbers, dot, underscore, or dash');
  requireAuth(data,profile,'past','branchFrom',reason);requireAuth(data,profile,'future','createWorktree',reason);
  const branch=`counterfactual/${name}`;
  if(git(root,['show-ref','--verify',`refs/heads/${branch}`],{soft:true}))throw new Error('counterfactual branch already exists');
  const base=path.join(root,'.conscios','worktrees'),target=path.join(base,name);
  fs.mkdirSync(base,{recursive:true});
  if(fs.existsSync(target))throw new Error('counterfactual worktree path already exists');
  git(root,['worktree','add','-b',branch,target,ref]);
  return {repository:repo.id,operation:'counterfactualWorktree',branch,ref,worktree:target,reason};
}
function writeFile(data,args){
  requireWrites();const {repo,root}=repoFrom(data,args.repository),profile=args.profile||'developer',reason=args.reason||'',content=String(args.content??'');
  requireAuth(data,profile,'present','editWorktree',reason);const branch=assertWritableBranch(root,repo);
  if(Buffer.byteLength(content)>MAX_WRITE_BYTES)throw new Error(`write exceeds cap of ${MAX_WRITE_BYTES} bytes`);
  const {target,normalized}=safePath(root,clean(args.file));
  fs.mkdirSync(path.dirname(target),{recursive:true});fs.writeFileSync(target,content);
  return {repository:repo.id,operation:'writeFile',branch,file:normalized,bytes:Buffer.byteLength(content),reason};
}
function commitStaged(data,args){
  requireWrites();const {repo,root}=repoFrom(data,args.repository),profile=args.profile||'developer',reason=args.reason||'',message=clean(args.message);
  requireAuth(data,profile,'present','createCommit',reason);const branch=assertWritableBranch(root,repo);
  if(!message)throw new Error('commit message required');
  const staged=git(root,['diff','--cached','--name-only'],{soft:true}).split(/\r?\n/).filter(Boolean);
  if(!staged.length)throw new Error('no staged changes');
  const full=`${message}\n\nConsciOS-Development-Reason: ${String(reason).replace(/\r?\n/g,' ').slice(0,240)}\nConsciOS-Temporal-Profile: ${profile}`;
  git(root,['commit','-m',full]);
  return {repository:repo.id,operation:'commitStaged',branch,head:git(root,['rev-parse','HEAD']),stagedFiles:staged,reason};
}

export function execute(command,args={}){
  const data=loadLandscape();
  if(command==='status')return status(data,args.repository);
  if(command==='readFile')return readFileAt(data,args);
  if(command==='authorize')return authorization(data,args.profile,args.temporalScope,args.operation,args.reason||'');
  if(command==='createBranch')return createBranch(data,args);
  if(command==='counterfactualWorktree')return counterfactualWorktree(data,args);
  if(command==='writeFile')return writeFile(data,args);
  if(command==='commitStaged')return commitStaged(data,args);
  throw new Error(`unknown command: ${command}`);
}

if(import.meta.url===`file://${process.argv[1]}`){
  const data=loadLandscape(),common={repository:arg('--repository','repository:self'),profile:arg('--profile','developer'),reason:arg('--reason','')};
  let out;
  if(cmd==='status')out=status(data,common.repository);
  else if(cmd==='read-file')out=readFileAt(data,{...common,profile:arg('--profile','observer'),ref:arg('--ref','HEAD'),file:arg('--file')});
  else if(cmd==='authorize')out=authorization(data,arg('--profile'),arg('--time'),arg('--operation'),arg('--reason',''));
  else if(cmd==='create-branch')out=createBranch(data,{...common,branch:arg('--branch'),ref:arg('--ref','HEAD')});
  else if(cmd==='counterfactual-worktree')out=counterfactualWorktree(data,{...common,profile:arg('--profile','counterfactual'),ref:arg('--ref'),name:arg('--name')});
  else if(cmd==='write-file'){
    const contentFile=arg('--content-file');if(!contentFile)throw new Error('--content-file required for CLI write-file');
    out=writeFile(data,{...common,file:arg('--file'),content:fs.readFileSync(path.resolve(contentFile),'utf8')});
  }else if(cmd==='commit-staged')out=commitStaged(data,{...common,message:arg('--message')});
  else throw new Error('status | read-file | authorize | create-branch | counterfactual-worktree | write-file | commit-staged');
  console.log(JSON.stringify(out,null,2));
}
