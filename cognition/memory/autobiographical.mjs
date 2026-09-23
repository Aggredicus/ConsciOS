export const AUTOBIOGRAPHICAL_SCHEMA_VERSION='0.9.0';
export const RECONSTRUCTION_STATEMENT='Stored history reconstructed after a runtime boundary; this does not establish uninterrupted subjective experience.';

function nonEmpty(value){return typeof value==='string'&&value.length>0}
function assertJsonValue(value,path='value'){
  if(value===null||typeof value==='string'||typeof value==='boolean')return;
  if(typeof value==='number'){
    if(!Number.isFinite(value))throw new TypeError(`${path} contains a non-finite number`);
    return;
  }
  if(Array.isArray(value)){
    value.forEach((item,index)=>assertJsonValue(item,`${path}[${index}]`));
    return;
  }
  if(typeof value==='object'){
    for(const [key,item] of Object.entries(value)){
      if(item===undefined||typeof item==='function'||typeof item==='symbol')throw new TypeError(`${path}.${key} is not JSON-serializable`);
      assertJsonValue(item,`${path}.${key}`);
    }
    return;
  }
  throw new TypeError(`${path} is not JSON-serializable`);
}

function canonicalize(value){
  if(value===null||typeof value!=='object')return value;
  if(Array.isArray(value))return value.map(canonicalize);
  const out={};
  for(const key of Object.keys(value).sort())out[key]=canonicalize(value[key]);
  return out;
}

export function canonicalJson(value){
  assertJsonValue(value);
  return JSON.stringify(canonicalize(value));
}

export async function sha256Hex(value){
  const subtle=globalThis.crypto?.subtle;
  if(!subtle)throw new Error('Web Crypto SHA-256 is unavailable');
  const bytes=new TextEncoder().encode(typeof value==='string'?value:canonicalJson(value));
  const digest=await subtle.digest('SHA-256',bytes);
  return [...new Uint8Array(digest)].map(byte=>byte.toString(16).padStart(2,'0')).join('');
}

export function createAutobiographicalJournal({architectureVersion='0.6.0',epochId='epoch-0001'}={}){
  if(!nonEmpty(architectureVersion))throw new TypeError('architectureVersion must be non-empty');
  if(!nonEmpty(epochId))throw new TypeError('epochId must be non-empty');
  return {
    schemaVersion:AUTOBIOGRAPHICAL_SCHEMA_VERSION,
    architectureVersion,
    initialEpochId:epochId,
    currentEpochId:epochId,
    continuityMode:'continuous-runtime',
    records:[]
  };
}

function withoutHash(record){const copy={...record};delete copy.hash;return copy}

async function makeRecord(journal,{kind,eventId,timestamp,epistemicStatus,content,epochId=journal.currentEpochId}){
  if(!nonEmpty(kind)||!nonEmpty(eventId)||!nonEmpty(epistemicStatus)||!nonEmpty(epochId))throw new TypeError('record identity fields must be non-empty');
  if(!Number.isInteger(timestamp)||timestamp<0)throw new TypeError('timestamp must be a non-negative integer logical time');
  assertJsonValue(content,'content');
  const previous=journal.records.at(-1)??null;
  const record={
    kind,
    sequence:journal.records.length+1,
    eventId,
    timestamp,
    epochId,
    epistemicStatus,
    content:structuredClone(content),
    contentDigest:await sha256Hex(content),
    previousHash:previous?.hash??null,
    architectureVersion:journal.architectureVersion
  };
  return {...record,hash:await sha256Hex(withoutHash(record))};
}

export async function verifyAutobiographicalJournal(journal){
  const errors=[];
  if(!journal||typeof journal!=='object')return {valid:false,errors:['journal must be an object'],recordCount:0,lastVerifiedHash:null,currentEpochId:null};
  if(journal.schemaVersion!==AUTOBIOGRAPHICAL_SCHEMA_VERSION)errors.push('schemaVersion mismatch');
  if(!nonEmpty(journal.architectureVersion))errors.push('architectureVersion missing');
  if(!nonEmpty(journal.initialEpochId))errors.push('initialEpochId missing');
  if(!nonEmpty(journal.currentEpochId))errors.push('currentEpochId missing');
  if(!['continuous-runtime','reconstructed-continuity'].includes(journal.continuityMode))errors.push('continuityMode invalid');
  if(!Array.isArray(journal.records))return {valid:false,errors:[...errors,'records must be an array'],recordCount:0,lastVerifiedHash:null,currentEpochId:journal.currentEpochId??null};

  let previousHash=null;
  let expectedEpoch=journal.initialEpochId;
  for(let index=0;index<journal.records.length;index++){
    const record=journal.records[index];
    const label=`record[${index}]`;
    if(!record||typeof record!=='object'){errors.push(`${label} invalid`);continue;}
    if(record.sequence!==index+1)errors.push(`${label} sequence mismatch`);
    if(record.previousHash!==previousHash)errors.push(`${label} previousHash mismatch`);
    if(record.architectureVersion!==journal.architectureVersion)errors.push(`${label} architectureVersion mismatch`);
    try{
      const contentDigest=await sha256Hex(record.content);
      if(contentDigest!==record.contentDigest)errors.push(`${label} contentDigest mismatch`);
      const hash=await sha256Hex(withoutHash(record));
      if(hash!==record.hash)errors.push(`${label} hash mismatch`);
    }catch(error){errors.push(`${label} hashing failed: ${error.message}`);}

    if(record.kind==='restart-boundary'){
      const content=record.content??{};
      if(content.previousEpochId!==expectedEpoch)errors.push(`${label} previous epoch mismatch`);
      if(content.newEpochId!==record.epochId)errors.push(`${label} new epoch mismatch`);
      if(content.continuityMode!=='reconstructed-continuity')errors.push(`${label} continuity mode mismatch`);
      if(content.continuityStatement!==RECONSTRUCTION_STATEMENT)errors.push(`${label} reconstruction statement mismatch`);
      if(content.persistedRecordCount!==index)errors.push(`${label} persistedRecordCount mismatch`);
      if(content.lastVerifiedHash!==previousHash)errors.push(`${label} lastVerifiedHash mismatch`);
      expectedEpoch=record.epochId;
    }else if(record.epochId!==expectedEpoch){
      errors.push(`${label} epoch mismatch`);
    }
    previousHash=record.hash??null;
  }
  if(journal.currentEpochId!==expectedEpoch)errors.push('journal currentEpochId does not match verified epoch');
  if(journal.continuityMode==='continuous-runtime'&&journal.records.some(r=>r?.kind==='restart-boundary'))errors.push('restart boundary requires reconstructed-continuity mode');
  return {valid:errors.length===0,errors,recordCount:journal.records.length,lastVerifiedHash:previousHash,currentEpochId:expectedEpoch};
}

async function verifiedClone(journal){
  const verification=await verifyAutobiographicalJournal(journal);
  if(!verification.valid)throw new Error(`Autobiographical journal integrity failure: ${verification.errors.join('; ')}`);
  return {journal:structuredClone(journal),verification};
}

export async function appendAutobiographicalEpisode(journal,{eventId,timestamp,epistemicStatus,content}){
  const checked=await verifiedClone(journal);
  const record=await makeRecord(checked.journal,{kind:'episode',eventId,timestamp,epistemicStatus,content});
  checked.journal.records.push(record);
  return {journal:checked.journal,record};
}

export async function appendRestartBoundary(journal,{newEpochId,timestamp}){
  if(!nonEmpty(newEpochId))throw new TypeError('newEpochId must be non-empty');
  const checked=await verifiedClone(journal);
  if(newEpochId===checked.journal.currentEpochId)throw new Error('restart boundary requires a new epoch ID');
  const content={
    previousEpochId:checked.journal.currentEpochId,
    newEpochId,
    persistedRecordCount:checked.journal.records.length,
    lastVerifiedHash:checked.verification.lastVerifiedHash,
    continuityMode:'reconstructed-continuity',
    continuityStatement:RECONSTRUCTION_STATEMENT
  };
  const record=await makeRecord(checked.journal,{kind:'restart-boundary',eventId:`restart-${newEpochId}`,timestamp,epistemicStatus:'continuity',content,epochId:newEpochId});
  checked.journal.records.push(record);
  checked.journal.currentEpochId=newEpochId;
  checked.journal.continuityMode='reconstructed-continuity';
  return {journal:checked.journal,record};
}

export function exportAutobiographicalJournal(journal){return canonicalJson(journal)}

export async function importAutobiographicalJournal(serialized){
  if(typeof serialized!=='string')throw new TypeError('serialized journal must be a string');
  const journal=JSON.parse(serialized);
  const verification=await verifyAutobiographicalJournal(journal);
  if(!verification.valid)throw new Error(`Imported autobiographical journal failed verification: ${verification.errors.join('; ')}`);
  return structuredClone(journal);
}
