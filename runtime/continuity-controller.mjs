import {
  RECONSTRUCTION_STATEMENT,appendAutobiographicalEpisode,appendRestartBoundary,
  createAutobiographicalJournal,verifyAutobiographicalJournal
} from '../cognition/memory/autobiographical.mjs';
import { createIndexedDBAutobiographicalStore } from './storage/indexeddb-autobiographical.mjs';

const SIGNIFICANT_TYPES=new Set([
  'workspace.broadcast','model.update','counterfactual.candidates','confidence.assessment',
  'homeostasis.assessment','governance.decision','action.selection','expression.report'
]);

function nextLogicalTime(journal){return (journal.records.at(-1)?.timestamp??-1)+1}
function nextEpochId(journal){
  const restartCount=journal.records.filter(record=>record.kind==='restart-boundary').length;
  return `epoch-${String(restartCount+2).padStart(4,'0')}`;
}
function selectedEvents(state){return state.events.filter(event=>SIGNIFICANT_TYPES.has(event.type))}

export class ContinuityController {
  constructor({store=null,architectureVersion='0.6.0'}={}){
    this.store=store;
    this.architectureVersion=architectureVersion;
    this.journal=null;
    this.status='inactive';
    this.error=null;
  }

  ensureStore(){
    if(!this.store)this.store=createIndexedDBAutobiographicalStore();
    return this.store;
  }

  async view(){
    if(!this.journal)return {
      status:this.status,recallAuthority:'none',recordCount:0,currentEpoch:null,
      continuityMode:null,lastVerifiedHash:null,restartBoundaries:[],reconstructionStatement:null,error:this.error
    };
    const verification=await verifyAutobiographicalJournal(this.journal);
    return {
      status:this.status,
      recallAuthority:'none',
      recordCount:this.journal.records.length,
      currentEpoch:this.journal.currentEpochId,
      continuityMode:this.journal.continuityMode,
      lastVerifiedHash:verification.valid?verification.lastVerifiedHash:null,
      restartBoundaries:this.journal.records.filter(record=>record.kind==='restart-boundary').map(record=>({
        sequence:record.sequence,previousEpochId:record.content.previousEpochId,newEpochId:record.content.newEpochId
      })),
      reconstructionStatement:this.journal.continuityMode==='reconstructed-continuity'?RECONSTRUCTION_STATEMENT:null,
      error:this.error
    };
  }

  async activate(){
    if(this.status==='active')return this.view();
    try{
      const store=this.ensureStore();
      const loaded=await store.load('primary');
      if(loaded===null){
        this.journal=createAutobiographicalJournal({architectureVersion:this.architectureVersion,epochId:'epoch-0001'});
        await store.save(this.journal,'primary');
      }else{
        this.journal=loaded;
        const boundary=await appendRestartBoundary(this.journal,{newEpochId:nextEpochId(this.journal),timestamp:nextLogicalTime(this.journal)});
        this.journal=boundary.journal;
        await store.save(this.journal,'primary');
      }
      this.status='active';
      this.error=null;
    }catch(error){
      this.journal=null;
      this.status=String(error?.message??error).includes('IndexedDB is unavailable')?'unavailable':'invalid-history';
      this.error=String(error?.message??error);
    }
    return this.view();
  }

  async recordRun(state){
    if(this.status!=='active'||!this.journal)return this.view();
    let journal=this.journal;
    for(const event of selectedEvents(state)){
      const logicalTime=nextLogicalTime(journal);
      const result=await appendAutobiographicalEpisode(journal,{
        eventId:`${journal.currentEpochId}:record-${String(logicalTime).padStart(6,'0')}:${event.id}`,
        timestamp:logicalTime,
        epistemicStatus:event.epistemicStatus,
        content:{source:event.source,type:event.type,content:event.content,causalParents:[...event.causalParents]}
      });
      journal=result.journal;
    }
    this.journal=journal;
    await this.ensureStore().save(this.journal,'primary');
    return this.view();
  }
}

export function createContinuityController(options){return new ContinuityController(options)}
