#!/usr/bin/env node
import readline from 'node:readline';
import {execute} from './development-landscape-git.mjs';

const MAX_LINE_BYTES=2*1024*1024;
const result=data=>({content:[{type:'text',text:JSON.stringify(data)}],structuredContent:data});
const tools=[
{name:'development_git_status',description:'Read local Git status for a repository in the Development Landscape. Does not mutate Git.',inputSchema:{type:'object',properties:{repository:{type:'string'}}}},
{name:'development_git_read_file',description:'Read one bounded repository file at a historical or present Git ref, subject to the temporal capability profile.',inputSchema:{type:'object',properties:{repository:{type:'string'},ref:{type:'string'},file:{type:'string'},profile:{type:'string'},reason:{type:'string'}},required:['file']}},
{name:'development_git_authorize',description:'Evaluate a past/present/future capability without executing it.',inputSchema:{type:'object',properties:{profile:{type:'string'},temporalScope:{enum:['past','present','future']},operation:{type:'string'},reason:{type:'string'}},required:['profile','temporalScope','operation']}},
{name:'development_git_create_branch',description:'Create a non-protected local branch when writes are explicitly enabled and the selected profile authorizes present createBranch.',inputSchema:{type:'object',properties:{repository:{type:'string'},branch:{type:'string'},ref:{type:'string'},profile:{type:'string'},reason:{type:'string'}},required:['branch','reason']}},
{name:'development_git_counterfactual_worktree',description:'Create an isolated counterfactual branch/worktree rooted at a historical ref. Requires explicit write enable plus past branchFrom and future createWorktree authorization.',inputSchema:{type:'object',properties:{repository:{type:'string'},ref:{type:'string'},name:{type:'string'},profile:{type:'string'},reason:{type:'string'}},required:['ref','name','reason']}},
{name:'development_git_write_file',description:'Write one bounded UTF-8 file inside a non-protected local worktree. Requires explicit write enable and present editWorktree authorization.',inputSchema:{type:'object',properties:{repository:{type:'string'},file:{type:'string'},content:{type:'string'},profile:{type:'string'},reason:{type:'string'}},required:['file','content','reason']}},
{name:'development_git_commit_staged',description:'Commit already-staged changes on a non-protected branch. Requires explicit write enable and present createCommit authorization.',inputSchema:{type:'object',properties:{repository:{type:'string'},message:{type:'string'},profile:{type:'string'},reason:{type:'string'}},required:['message','reason']}}
];
const handlers={
development_git_status:a=>execute('status',a),
development_git_read_file:a=>execute('readFile',a),
development_git_authorize:a=>execute('authorize',a),
development_git_create_branch:a=>execute('createBranch',a),
development_git_counterfactual_worktree:a=>execute('counterfactualWorktree',a),
development_git_write_file:a=>execute('writeFile',a),
development_git_commit_staged:a=>execute('commitStaged',a)
};
function reply(id,payload,error=null){const msg=error?{jsonrpc:'2.0',id,error:{code:-32000,message:error.message||String(error)}}:{jsonrpc:'2.0',id,result:payload};process.stdout.write(JSON.stringify(msg)+'\n');}
function handle(m){
  if(m.method==='initialize')return reply(m.id,{protocolVersion:m.params?.protocolVersion||'2025-06-18',capabilities:{tools:{listChanged:false}},serverInfo:{name:'conscios-development-git',version:'0.1.0'}});
  if(m.method==='ping')return reply(m.id,{});
  if(m.method==='tools/list')return reply(m.id,{tools});
  if(m.method==='tools/call'){const h=handlers[m.params?.name];if(!h)return reply(m.id,null,new Error(`unknown tool: ${m.params?.name}`));try{return reply(m.id,result(h(m.params?.arguments||{})));}catch(e){return reply(m.id,null,e);}}
  if(m.id!==undefined)return reply(m.id,null,new Error(`unsupported method: ${m.method}`));
}
if(process.argv.includes('--self-test')){console.log(JSON.stringify({ok:true,tools:tools.length,mutationsEnabled:process.env.CONSCIOS_DEVELOPMENT_WRITE_ENABLE==='1',networkListeners:0}));process.exit(0);}
const rl=readline.createInterface({input:process.stdin,crlfDelay:Infinity});
rl.on('line',line=>{if(Buffer.byteLength(line)>MAX_LINE_BYTES){console.error('MCP input line too large');return;}try{handle(JSON.parse(line));}catch(e){console.error(e.message);}});
