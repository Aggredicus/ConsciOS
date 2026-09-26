import { edgeIsDeclared, resolveRole, resolveTargetDomain, stableStringify } from './phenotype-compiler.mjs';

const textEncoder=new TextEncoder();
const PHASES=new Set(['online','consolidation','maintenance','recovery']);
const EPISTEMIC=new Set(['observation','inference','prediction','memory','counterfactual','action','expression','governance']);

function fail(message){throw new Error(`Rejected CognitiveEnvelopeV1: ${message}`);}
function deepFreeze(value){
  if(value&&typeof value==='object'&&!Object.isFrozen(value)){
    Object.freeze(value);
    for(const item of Object.values(value))deepFreeze(item);
  }
  return value;
}

export function shadowEnvelopeFromEvent(event,{program,phenotype,cycleId=1,phase='online',capabilityContextId='current-deterministic-v0',ttlCycles=1,providerProvenance=null}={}){
  if(!event||typeof event!=='object')fail('source event is required');
  const source=resolveRole(program,event.source);
  const targetDomain=resolveTargetDomain(program,event.target,{globallyAvailable:event.globallyAvailable===true});
  if(!edgeIsDeclared(program,source.role,targetDomain))fail(`undeclared edge ${source.role}->${targetDomain}`);
  const envelope={
    schemaVersion:'1.0.0',
    messageId:event.id,
    cycleId,
    logicalTime:event.timestamp,
    phase,
    sourceDomain:source.domain,
    sourceRole:source.role,
    targetDomain,
    type:event.type,
    payloadSchema:'https://conscios.dev/schemas/cognitive-event.schema.json#content',
    payload:structuredClone(event.content),
    epistemicStatus:event.epistemicStatus,
    confidence:Number.isFinite(event.confidence)?event.confidence:null,
    causalParents:[...(event.causalParents??[])],
    capabilityContextId,
    phenotypeHash:phenotype.phenotypeHash,
    providerProvenance:providerProvenance?structuredClone(providerProvenance):null,
    ttlCycles
  };
  return deepFreeze(envelope);
}

export function createShadowEnvelopeValidator({program,phenotype,knownParentIds=[]}={}){
  const knownParents=new Set(knownParentIds);
  let previousLogicalTime=-1;
  const seenMessageIds=new Set();

  return Object.freeze({
    validate(envelope){
      if(!envelope||typeof envelope!=='object'||Array.isArray(envelope))fail('envelope must be an object');
      const exactFields=['schemaVersion','messageId','cycleId','logicalTime','phase','sourceDomain','sourceRole','targetDomain','type','payloadSchema','payload','epistemicStatus','confidence','causalParents','capabilityContextId','phenotypeHash','providerProvenance','ttlCycles'];
      const keys=Object.keys(envelope);
      for(const field of exactFields)if(!keys.includes(field))fail(`missing field ${field}`);
      for(const field of keys)if(!exactFields.includes(field))fail(`undeclared field ${field}`);
      if(envelope.schemaVersion!=='1.0.0')fail('unsupported schemaVersion');
      if(typeof envelope.messageId!=='string'||!envelope.messageId.length)fail('messageId is required');
      if(seenMessageIds.has(envelope.messageId))fail(`duplicate messageId ${envelope.messageId}`);
      if(!Number.isInteger(envelope.cycleId)||envelope.cycleId<0)fail('cycleId must be a non-negative integer');
      if(!Number.isInteger(envelope.logicalTime)||envelope.logicalTime<0)fail('logicalTime must be a non-negative integer');
      if(envelope.logicalTime<previousLogicalTime)fail(`non-monotonic logicalTime ${envelope.logicalTime} < ${previousLogicalTime}`);
      if(!PHASES.has(envelope.phase)||!program.phases.includes(envelope.phase))fail(`undeclared phase ${envelope.phase}`);
      if(envelope.phenotypeHash!==phenotype.phenotypeHash)fail('phenotype hash mismatch');

      const source=program.roles.find(role=>role.role===envelope.sourceRole);
      if(!source)fail(`unknown source role ${envelope.sourceRole}`);
      if(source.domain!==envelope.sourceDomain)fail(`source domain mismatch for ${envelope.sourceRole}`);
      if(!edgeIsDeclared(program,envelope.sourceRole,envelope.targetDomain))fail(`undeclared edge ${envelope.sourceRole}->${envelope.targetDomain}`);
      if(!program.payloadSchemas.includes(envelope.payloadSchema))fail(`undeclared payload schema ${envelope.payloadSchema}`);
      if(!program.capabilityContexts.includes(envelope.capabilityContextId))fail(`undeclared capability context ${envelope.capabilityContextId}`);
      if(!EPISTEMIC.has(envelope.epistemicStatus)||!source.allowedEpistemicStatuses.includes(envelope.epistemicStatus))fail(`${envelope.sourceRole} cannot author epistemic status ${envelope.epistemicStatus}`);
      if(envelope.confidence!==null&&(!Number.isFinite(envelope.confidence)||envelope.confidence<0||envelope.confidence>1))fail('confidence must be null or [0,1]');
      if(!Array.isArray(envelope.causalParents)||new Set(envelope.causalParents).size!==envelope.causalParents.length)fail('causalParents must be a unique array');
      for(const parent of envelope.causalParents){
        if(typeof parent!=='string'||!parent.length)fail('causal parent IDs must be non-empty strings');
        if(!knownParents.has(parent)&&!seenMessageIds.has(parent))fail(`missing causal parent ${parent}`);
      }
      if(!Number.isInteger(envelope.ttlCycles)||envelope.ttlCycles<1||envelope.ttlCycles>program.budgets.maxEnvelopeTtlCycles)fail('ttlCycles exceeds regulatory budget');
      const envelopeBytes=textEncoder.encode(stableStringify(envelope)).byteLength;
      if(envelopeBytes>program.budgets.maxEnvelopeBytes)fail(`envelope exceeds byte budget: ${envelopeBytes}`);

      if(envelope.providerProvenance!==null){
        if(!envelope.providerProvenance||typeof envelope.providerProvenance!=='object')fail('providerProvenance must be null or an object');
        const providerId=envelope.providerProvenance.providerId;
        if(typeof providerId!=='string'||!program.providerPermissions.includes(providerId))fail(`provider ${providerId??'<missing>'} is not permitted by this phenotype`);
        if(['observation','governance','action','expression'].includes(envelope.epistemicStatus))fail(`provider output cannot masquerade as ${envelope.epistemicStatus}`);
      }

      seenMessageIds.add(envelope.messageId);
      knownParents.add(envelope.messageId);
      previousLogicalTime=envelope.logicalTime;
      return Object.freeze({accepted:true,messageId:envelope.messageId,envelopeBytes});
    },
    snapshot(){return Object.freeze({previousLogicalTime,seenMessageIds:Object.freeze([...seenMessageIds]),knownParentIds:Object.freeze([...knownParents])});}
  });
}
