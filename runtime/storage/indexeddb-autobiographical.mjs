import { AUTOBIOGRAPHICAL_SCHEMA_VERSION, verifyAutobiographicalJournal } from '../../cognition/memory/autobiographical.mjs';

export const AUTOBIOGRAPHICAL_DB_NAME='conscios-autobiographical-v0.9';
export const AUTOBIOGRAPHICAL_STORE_NAME='journals';

function nonEmpty(value){return typeof value==='string'&&value.length>0}
function requestResult(request){
  return new Promise((resolve,reject)=>{
    request.onsuccess=()=>resolve(request.result);
    request.onerror=()=>reject(request.error??new Error('IndexedDB request failed'));
  });
}
function transactionComplete(transaction){
  return new Promise((resolve,reject)=>{
    transaction.oncomplete=()=>resolve();
    transaction.onerror=()=>reject(transaction.error??new Error('IndexedDB transaction failed'));
    transaction.onabort=()=>reject(transaction.error??new Error('IndexedDB transaction aborted'));
  });
}

export class IndexedDBAutobiographicalStore {
  constructor({indexedDB=globalThis.indexedDB,dbName=AUTOBIOGRAPHICAL_DB_NAME,storeName=AUTOBIOGRAPHICAL_STORE_NAME}={}){
    if(!indexedDB||typeof indexedDB.open!=='function')throw new TypeError('IndexedDB is unavailable');
    if(!nonEmpty(dbName)||!nonEmpty(storeName))throw new TypeError('dbName and storeName must be non-empty');
    this.indexedDB=indexedDB;
    this.dbName=dbName;
    this.storeName=storeName;
  }

  async open(){
    const request=this.indexedDB.open(this.dbName,1);
    request.onupgradeneeded=()=>{
      const db=request.result;
      if(!db.objectStoreNames.contains(this.storeName))db.createObjectStore(this.storeName);
    };
    return requestResult(request);
  }

  async load(key='primary'){
    if(!nonEmpty(key))throw new TypeError('journal key must be non-empty');
    const db=await this.open();
    try{
      const transaction=db.transaction(this.storeName,'readonly');
      const value=await requestResult(transaction.objectStore(this.storeName).get(key));
      if(value===undefined)return null;
      const verification=await verifyAutobiographicalJournal(value);
      if(!verification.valid)throw new Error(`Persisted autobiographical journal failed verification: ${verification.errors.join('; ')}`);
      return structuredClone(value);
    }finally{
      db.close();
    }
  }

  async save(journal,key='primary'){
    if(!nonEmpty(key))throw new TypeError('journal key must be non-empty');
    const verification=await verifyAutobiographicalJournal(journal);
    if(!verification.valid)throw new Error(`Refusing to persist invalid autobiographical journal: ${verification.errors.join('; ')}`);
    if(journal.schemaVersion!==AUTOBIOGRAPHICAL_SCHEMA_VERSION)throw new Error('Refusing to persist unsupported autobiographical schema');
    const db=await this.open();
    try{
      const transaction=db.transaction(this.storeName,'readwrite');
      transaction.objectStore(this.storeName).put(structuredClone(journal),key);
      await transactionComplete(transaction);
      return {key,recordCount:journal.records.length,lastVerifiedHash:verification.lastVerifiedHash};
    }finally{
      db.close();
    }
  }
}

export function createIndexedDBAutobiographicalStore(options){return new IndexedDBAutobiographicalStore(options)}
