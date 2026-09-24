import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { loadOwnership,ownershipRoots } from './conway-lib.mjs';

const SHARED=['CONSCIOS_CHARTER.md','WELFARE_PROTOCOL.md','SCIENTIFIC_METHOD.md','agents/OWNERSHIP.yaml'];
const CONTRACT_FILES={
  Sensorium:'agents/sensorium.agent.yaml',GlobalWorkspace:'agents/workspace.agent.yaml',WorldModel:'agents/world-model.agent.yaml',
  SelfModel:'agents/self-model.agent.yaml',Memory:'agents/memory.agent.yaml',Counterfactual:'agents/counterfactual.agent.yaml',
  Metacognition:'agents/metacognition.agent.yaml',Homeostasis:'agents/homeostasis.agent.yaml',Guardian:'agents/guardian.agent.yaml',
  Executive:'agents/executive.agent.yaml',Expression:'agents/expression.agent.yaml',ObserverScientist:'agents/observer-scientist.agent.yaml',
  ScientificAuditor:'agents/scientific-auditor.agent.yaml',WelfareAuditor:'agents/welfare-auditor.agent.yaml'
};

function normalize(p){return p.split(path.sep).join('/').replace(/^\.\//,'')}
function stripGlob(glob){return glob.replace(/\/\*\*.*$/,'').replace(/\/$/,'')}
function listFiles(root,relative){
  const full=path.join(root,relative);
  if(!fs.existsSync(full)) throw new Error(`Context artifact not found: ${relative}`);
  const stat=fs.statSync(full);
  if(stat.isFile()) return [normalize(relative)];
  const out=[];
  for(const name of fs.readdirSync(full)) out.push(...listFiles(root,path.join(relative,name)));
  return out;
}
function hashFile(root,relative){return crypto.createHash('sha256').update(fs.readFileSync(path.join(root,relative))).digest('hex')}
function unique(values){return [...new Set(values.map(normalize))].sort()}
function contextId(role,task,files){return 'CTX-'+crypto.createHash('sha256').update(JSON.stringify({role,task,files})).digest('hex').slice(0,16)}

export function buildAgentContext({root=process.cwd(),role,task,incoming=[],expansions=[]}={}){
  if(!role||!task) throw new Error('role and task are required');
  const agents=loadOwnership(root);const agent=agents.get(role);
  if(!agent) throw new Error(`Unknown ConsciOS role: ${role}`);
  const contract=CONTRACT_FILES[role];if(!contract) throw new Error(`No contract file mapping for ${role}`);
  const shared=unique([...SHARED,contract].flatMap(p=>listFiles(root,p)));
  const owned=unique(agent.owns.map(stripGlob).flatMap(p=>listFiles(root,p)));
  const interfaces=unique(listFiles(root,'interfaces'));
  const incomingFiles=unique(incoming.flatMap(p=>listFiles(root,p)));
  const expansionEntries=expansions.map(item=>{
    if(!item||typeof item.artifact!=='string'||typeof item.reason!=='string'||!item.reason.trim()) throw new Error('Each context expansion requires artifact and reason');
    return {artifact:normalize(item.artifact),reason:item.reason.trim()};
  });
  const expansionFiles=unique(expansionEntries.flatMap(x=>listFiles(root,x.artifact)));
  const categories=[['shared',shared],['owned',owned],['interface',interfaces],['incoming',incomingFiles],['expansion',expansionFiles]];
  const sourceFor=new Map();
  for(const [source,files] of categories) for(const file of files) if(!sourceFor.has(file)) sourceFor.set(file,source);
  const files=unique([...sourceFor.keys()]).map(file=>({path:file,sha256:hashFile(root,file),source:sourceFor.get(file)}));
  const allowedRoots=new Set(agent.owns.map(stripGlob));
  const auditRoot=role==='ScientificAuditor'?'audits/scientific':role==='WelfareAuditor'?'audits/welfare':null;
  const forbiddenRoots=ownershipRoots(agents).map(x=>x.root).filter(r=>!allowedRoots.has(r) && r!==auditRoot);
  for(const rootName of ['runtime','live']) if(!allowedRoots.has(rootName)) forbiddenRoots.push(rootName);
  return {
    version:1,id:contextId(role,task,files),role,task,
    sharedArtifacts:shared,ownedArtifacts:owned,interfaceArtifacts:interfaces,incomingArtifacts:incomingFiles,
    contextExpansions:expansionEntries,forbiddenRoots:unique(forbiddenRoots),files
  };
}

export function materializeAgentContext(manifest,{root=process.cwd(),destination}={}){
  if(!destination) throw new Error('destination is required');
  fs.mkdirSync(destination,{recursive:true});
  for(const item of manifest.files){
    const target=path.join(destination,item.path);fs.mkdirSync(path.dirname(target),{recursive:true});fs.copyFileSync(path.join(root,item.path),target);
  }
  fs.writeFileSync(path.join(destination,'CONTEXT_MANIFEST.json'),JSON.stringify(manifest,null,2)+'\n');
}

function parseArgs(argv){
  const result={incoming:[],expansions:[]};result.role=argv.shift();
  while(argv.length){const flag=argv.shift();const value=argv.shift();
    if(flag==='--task')result.task=value;
    else if(flag==='--incoming')result.incoming.push(...value.split(',').filter(Boolean));
    else if(flag==='--expand'){const i=value.indexOf('::');if(i<1)throw new Error('--expand expects artifact::reason');result.expansions.push({artifact:value.slice(0,i),reason:value.slice(i+2)});}
    else if(flag==='--write')result.write=value;
    else if(flag==='--materialize')result.materialize=value;
    else throw new Error(`Unknown argument: ${flag}`);
  }return result;
}

if(process.argv[1]===fileURLToPath(import.meta.url)){
  const args=parseArgs(process.argv.slice(2));const manifest=buildAgentContext(args);const json=JSON.stringify(manifest,null,2)+'\n';
  if(args.write){fs.mkdirSync(path.dirname(path.resolve(args.write)),{recursive:true});fs.writeFileSync(args.write,json)}else process.stdout.write(json);
  if(args.materialize)materializeAgentContext(manifest,{destination:args.materialize});
}
