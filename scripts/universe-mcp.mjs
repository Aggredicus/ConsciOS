#!/usr/bin/env node
import fs from 'node:fs';
import readline from 'node:readline';
import { createUniverseModel } from '../src/universe.mjs';

const file=process.env.CONSCIOS_UNIVERSE_FILE;
const universe=createUniverseModel(file?JSON.parse(fs.readFileSync(file,'utf8')):null);
const result=data=>({content:[{type:'text',text:JSON.stringify(data)}],structuredContent:data});

const tools=[
  {name:'universe_summary',description:'Return bounded metadata for the loaded ConsciOS repository universe.',inputSchema:{type:'object',properties:{}}},
  {name:'universe_search',description:'Search repository-universe nodes without injecting the complete graph.',inputSchema:{type:'object',properties:{query:{type:'string'},limit:{type:'integer',minimum:1,maximum:24}},required:['query']}},
  {name:'universe_neighborhood',description:'Return a bounded graph neighborhood around one node.',inputSchema:{type:'object',properties:{nodeId:{type:'string'},depth:{type:'integer',minimum:0,maximum:3},limit:{type:'integer',minimum:1,maximum:24}},required:['nodeId']}}
];
const handlers={
  universe_summary:()=>result(universe.summary()),
  universe_search:args=>result(universe.search(args.query,args.limit??8)),
  universe_neighborhood:args=>result(universe.neighborhood(args.nodeId,args.depth??1,args.limit??16))
};
function reply(id,payload,error=null){
  const msg=error?{jsonrpc:'2.0',id,error:{code:-32000,message:error.message||String(error)}}:{jsonrpc:'2.0',id,result:payload};
  process.stdout.write(JSON.stringify(msg)+'\n');
}
function handle(message){
  if(message.method==='initialize')return reply(message.id,{protocolVersion:message.params?.protocolVersion||'2025-06-18',capabilities:{tools:{listChanged:false}},serverInfo:{name:'conscios-universe',version:'1.0.0'}});
  if(message.method==='ping')return reply(message.id,{});
  if(message.method==='tools/list')return reply(message.id,{tools});
  if(message.method==='tools/call'){
    const handler=handlers[message.params?.name];
    if(!handler)return reply(message.id,null,new Error('unknown tool'));
    try{return reply(message.id,handler(message.params?.arguments??{}))}catch(error){return reply(message.id,null,error)}
  }
  if(message.id!==undefined)return reply(message.id,null,new Error('unsupported method'));
}
if(process.argv.includes('--self-test')){
  console.log(JSON.stringify({ok:true,loaded:universe.status().loaded,tools:tools.map(tool=>tool.name),networkListeners:0}));
  process.exit(0);
}
const rl=readline.createInterface({input:process.stdin,crlfDelay:Infinity});
rl.on('line',line=>{try{handle(JSON.parse(line))}catch(error){console.error(error.message)}});
