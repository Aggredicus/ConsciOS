const textEncoder=new TextEncoder();

function assert(condition,message){if(!condition)throw new Error(`Invalid regulatory program: ${message}`);}
function unique(values){return new Set(values).size===values.length;}
function positiveInteger(value){return Number.isInteger(value)&&value>0;}

export function canonicalize(value){
  if(value===null||typeof value==='string'||typeof value==='boolean')return value;
  if(typeof value==='number'){
    if(!Number.isFinite(value))throw new TypeError('canonical phenotype values must be finite');
    return value;
  }
  if(Array.isArray(value))return value.map(canonicalize);
  if(typeof value==='object'){
    const out={};
    for(const key of Object.keys(value).sort()){
      if(value[key]===undefined)throw new TypeError(`canonical phenotype value ${key} is undefined`);
      out[key]=canonicalize(value[key]);
    }
    return out;
  }
  throw new TypeError(`unsupported canonical phenotype value type: ${typeof value}`);
}

export function stableStringify(value){return JSON.stringify(canonicalize(value));}

async function sha256Hex(text){
  const subtle=globalThis.crypto?.subtle;
  if(!subtle)throw new Error('Web Crypto subtle.digest is required to compile a runtime phenotype');
  const digest=await subtle.digest('SHA-256',textEncoder.encode(text));
  return [...new Uint8Array(digest)].map(byte=>byte.toString(16).padStart(2,'0')).join('');
}

export function validateRegulatoryProgram(program){
  assert(program&&typeof program==='object'&&!Array.isArray(program),'program must be an object');
  assert(program.schemaVersion==='1.0.0','schemaVersion must be 1.0.0');
  assert(typeof program.programId==='string'&&program.programId.length>0,'programId is required');
  assert(positiveInteger(program.programVersion),'programVersion must be a positive integer');
  assert(program.mode==='shadow','CEP-2 accepts shadow programs only');
  assert(Array.isArray(program.phases)&&program.phases.length>0&&unique(program.phases),'phases must be a unique non-empty array');
  assert(program.phases.includes('online'),'online phase is required');
  assert(Array.isArray(program.domains)&&program.domains.length>0&&unique(program.domains),'domains must be a unique non-empty array');
  assert(program.domains.includes('external'),'external domain is required for human-facing expression');
  assert(Array.isArray(program.roles)&&program.roles.length>0,'roles must be non-empty');

  const roleNames=program.roles.map(role=>role.role);
  assert(roleNames.every(name=>typeof name==='string'&&name.length>0)&&unique(roleNames),'role names must be unique non-empty strings');
  const aliasOwners=new Map();
  for(const role of program.roles){
    assert(program.domains.includes(role.domain),`role ${role.role} uses unknown domain ${role.domain}`);
    assert(Array.isArray(role.sourceAliases)&&role.sourceAliases.length>0&&unique(role.sourceAliases),`role ${role.role} needs unique source aliases`);
    assert(Array.isArray(role.allowedEpistemicStatuses)&&role.allowedEpistemicStatuses.length>0&&unique(role.allowedEpistemicStatuses),`role ${role.role} needs allowed epistemic statuses`);
    for(const alias of role.sourceAliases){
      assert(typeof alias==='string'&&alias.length>0,`role ${role.role} has invalid source alias`);
      assert(!aliasOwners.has(alias),`source alias ${alias} is claimed by both ${aliasOwners.get(alias)} and ${role.role}`);
      aliasOwners.set(alias,role.role);
    }
  }

  assert(Array.isArray(program.edges),'edges must be an array');
  const edgeKeys=[];
  for(const edge of program.edges){
    assert(roleNames.includes(edge.sourceRole),`edge uses unknown source role ${edge.sourceRole}`);
    assert(edge.targetDomain==='broadcast'||program.domains.includes(edge.targetDomain),`edge ${edge.sourceRole} uses unknown target domain ${edge.targetDomain}`);
    assert(typeof edge.kind==='string'&&edge.kind.length>0,`edge ${edge.sourceRole}->${edge.targetDomain} needs a kind`);
    edgeKeys.push(`${edge.sourceRole}\0${edge.targetDomain}\0${edge.kind}`);
  }
  assert(unique(edgeKeys),'duplicate regulatory edges are not allowed');

  for(const field of ['payloadSchemas','capabilityContexts']){
    assert(Array.isArray(program[field])&&program[field].length>0&&unique(program[field]),`${field} must be a unique non-empty array`);
    assert(program[field].every(value=>typeof value==='string'&&value.length>0),`${field} values must be non-empty strings`);
  }
  assert(Array.isArray(program.providerPermissions)&&unique(program.providerPermissions),'providerPermissions must be a unique array');
  assert(program.providerPermissions.every(value=>typeof value==='string'&&value.length>0),'providerPermissions must contain strings');

  const budgets=program.budgets;
  assert(budgets&&typeof budgets==='object','budgets are required');
  for(const name of ['workspaceCapacity','maxEnvelopeTtlCycles','maxEnvelopeBytes','maxRecurrentStateBytes'])assert(positiveInteger(budgets[name]),`${name} must be a positive integer`);
  return true;
}

function deepFreeze(value){
  if(value&&typeof value==='object'&&!Object.isFrozen(value)){
    Object.freeze(value);
    for(const item of Object.values(value))deepFreeze(item);
  }
  return value;
}

export async function compileRuntimePhenotype(inputProgram){
  const program=structuredClone(inputProgram);
  validateRegulatoryProgram(program);
  const phenotypeHash=await sha256Hex(stableStringify(program));
  const phenotype={
    schemaVersion:'1.0.0',
    programId:program.programId,
    programVersion:program.programVersion,
    mode:'shadow',
    phenotypeHash,
    activeRoles:program.roles.map(role=>role.role),
    domains:[...program.domains],
    edges:program.edges.map(edge=>({...edge})),
    payloadSchemas:[...program.payloadSchemas],
    capabilityContexts:[...program.capabilityContexts],
    providerPermissions:[...program.providerPermissions],
    budgets:{...program.budgets},
    causalAuthority:'none'
  };
  return deepFreeze({program:deepFreeze(program),phenotype:deepFreeze(phenotype)});
}

export function resolveRole(program,sourceAlias){
  const role=program.roles.find(candidate=>candidate.sourceAliases.includes(sourceAlias));
  if(!role)throw new Error(`Unknown source alias: ${sourceAlias}`);
  return role;
}

export function resolveTargetDomain(program,target,{globallyAvailable=false}={}){
  if(target==='*'||(!target&&globallyAvailable))return 'broadcast';
  if(target==='Human')return 'external';
  if(typeof target!=='string'||!target.length)throw new Error('Event has no routable target');
  const role=program.roles.find(candidate=>candidate.role===target||candidate.sourceAliases.includes(target));
  if(!role)throw new Error(`Unknown target role or alias: ${target}`);
  return role.domain;
}

export function edgeIsDeclared(program,sourceRole,targetDomain){
  return program.edges.some(edge=>edge.sourceRole===sourceRole&&edge.targetDomain===targetDomain);
}
