import { retrieveAutobiographicalRecords } from '../../cognition/memory/retrieval.mjs';

function workspaceSignals(state){
  const texts=state.workspace.map(event=>String(event.content));
  return {
    'content.activeHumanInstruction':texts.some(text=>text.includes('human supplied')),
    'content.runtimeChangeObserved':texts.some(text=>text.includes('Memory utilization')),
    'content.accessibleEventCount':state.workspace.length
  };
}

export function buildShadowRecallQuery(state){
  return {
    queryId:'shadow-autobiographical-recall-001',
    text:state.workspace.map(event=>String(event.content)).join(' '),
    preferredTypes:['workspace.broadcast','model.update'],
    preferredSources:['GlobalWorkspace','WorldModel'],
    structuredSignals:workspaceSignals(state)
  };
}

function compareHistoricalWorldModels(state,selected){
  const keys=['activeHumanInstruction','runtimeChangeObserved','accessibleEventCount'];
  const snapshots=[];
  const conflicts=[];
  for(const memory of selected){
    if(memory.content?.source!=='WorldModel'||memory.content?.type!=='model.update')continue;
    const historical=memory.content?.content;
    if(!historical||typeof historical!=='object')continue;
    const mismatchKeys=keys.filter(key=>Object.prototype.hasOwnProperty.call(historical,key)&&historical[key]!==state.world[key]);
    const matchingKeys=keys.filter(key=>Object.prototype.hasOwnProperty.call(historical,key)&&historical[key]===state.world[key]);
    const snapshot={recordId:memory.recordId,epochId:memory.epochId,mismatchKeys,matchingKeys,historical:true};
    snapshots.push(snapshot);
    if(mismatchKeys.length)conflicts.push(snapshot);
  }
  return {snapshots,conflicts,conflictCount:conflicts.length};
}

export async function runShadowAutobiographicalRecall(state,journal,options={}){
  const query=buildShadowRecallQuery(state);
  try{
    const retrieval=await retrieveAutobiographicalRecords(journal,query,options);
    const comparison=compareHistoricalWorldModels(state,retrieval.selected);
    return Object.freeze({
      id:'shadow-recall-record-001',
      owner:'ObserverScientist',
      status:'ok',
      recallAuthority:'shadow-only',
      actionAuthority:'none',
      causalAuthority:'none',
      retrieval,
      comparison,
      liveExpressionId:state.expression?.id??null,
      liveExpressionContent:state.expression?.content??null,
      failure:null
    });
  }catch(error){
    return Object.freeze({
      id:'shadow-recall-record-001',
      owner:'ObserverScientist',
      status:'blocked',
      recallAuthority:'shadow-only',
      actionAuthority:'none',
      causalAuthority:'none',
      retrieval:null,
      comparison:{snapshots:[],conflicts:[],conflictCount:0},
      liveExpressionId:state.expression?.id??null,
      liveExpressionContent:state.expression?.content??null,
      failure:String(error?.message??error)
    });
  }
}
