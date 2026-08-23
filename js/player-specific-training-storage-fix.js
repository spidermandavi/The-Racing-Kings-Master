(()=>{
'use strict';

// Player-report persistence is deliberately separated into two layers:
// 1. a compact report used for the saved-report list and fast opening;
// 2. the complete source game set in a separate IndexedDB database.
// This keeps browser storage small without silently turning a 5,000-game report
// into a 50-game report after reopening it.
const DB_NAME='rkPlayerReportsV3';
const STORE='reports';
const INDEX_KEY='rkPlayerReportIndexV3';
const SOURCE_DB='rkPlayerReportSourceV1';
const SOURCE_STORE='sources';
const CLEANUP_KEY='rkPlayerReportStorageCompactedV4';
const MAX_SAVED_POSITIONS=300;
const MAX_POSITION_MOVES=6;
const MAX_POSITION_EVALS=3;
const MAX_SAVED_GAMES=12;
const MAX_SAVED_MOVES_PER_GAME=80;

const compactGame=(game)=>{
  if(!game||typeof game!=='object')return game;
  return {
    id:game.id,
    headers:game.headers?{...game.headers}:undefined,
    date:game.date,
    color:game.color,
    outcome:game.outcome,
    opponent:game.opponent,
    opponentRating:game.opponentRating,
    timeControlBucket:game.timeControlBucket,
    isTournament:game.isTournament,
    moves:Array.isArray(game.moves)?game.moves.slice(0,MAX_SAVED_MOVES_PER_GAME):[]
  };
};

const compactReport=(value)=>{
  const meta={...(value.meta||{})};
  delete meta.sourceGames;
  meta.sourcePersistence='full-source-store';

  const stats={...(value.stats||{})};
  stats.moves=[];
  if(Array.isArray(stats.positions)){
    stats.positions=stats.positions
      .slice()
      .sort((a,b)=>(b.games||0)-(a.games||0))
      .slice(0,MAX_SAVED_POSITIONS)
      .map(p=>({
        ...p,
        evals:Array.isArray(p.evals)?p.evals.slice(-MAX_POSITION_EVALS):[],
        examples:Array.isArray(p.examples)?p.examples.slice(0,1):[],
        moves:Array.isArray(p.moves)?p.moves
          .slice()
          .sort((a,b)=>(b.games||0)-(a.games||0))
          .slice(0,MAX_POSITION_MOVES)
          .map(m=>({...m,evals:Array.isArray(m.evals)?m.evals.slice(-MAX_POSITION_EVALS):[]}))
          :[]
      }));
  }

  const compact={...value,meta,stats};
  delete compact.sourceGames;
  compact.storageMode='compact-with-full-source';
  compact.games=Array.isArray(value.games)?value.games.slice(0,MAX_SAVED_GAMES).map(compactGame):[];
  return compact;
};

const openSourceDb=()=>new Promise((resolve,reject)=>{
  const req=indexedDB.open(SOURCE_DB,1);
  req.onupgradeneeded=()=>{
    if(!req.result.objectStoreNames.contains(SOURCE_STORE))
      req.result.createObjectStore(SOURCE_STORE,{keyPath:'id'});
  };
  req.onsuccess=()=>resolve(req.result);
  req.onerror=()=>reject(req.error);
});

const saveSourceGames=async(id,games)=>{
  if(!id||!Array.isArray(games))return;
  const db=await openSourceDb();
  try{
    const tx=db.transaction(SOURCE_STORE,'readwrite');
    tx.objectStore(SOURCE_STORE).put({id,sourceGames:games});
    await new Promise((resolve,reject)=>{
      tx.oncomplete=resolve;
      tx.onerror=()=>reject(tx.error||new Error('Source-game storage failed'));
      tx.onabort=()=>reject(tx.error||new Error('Source-game storage aborted'));
    });
  }finally{db.close();}
};

const loadSourceGames=async(id)=>{
  const db=await openSourceDb();
  try{
    const tx=db.transaction(SOURCE_STORE,'readonly'),req=tx.objectStore(SOURCE_STORE).get(id);
    return await new Promise(resolve=>{
      req.onsuccess=()=>resolve(req.result||null);
      req.onerror=()=>resolve(null);
    });
  }finally{db.close();}
};

const originalPut=IDBObjectStore.prototype.put;
IDBObjectStore.prototype.put=function(value,...args){
  try{
    const dbName=this.transaction?.db?.name;
    if(dbName===DB_NAME&&this.name===STORE&&value&&typeof value==='object'&&value.stats){
      const id=value.id;
      const sourceGames=Array.isArray(value.sourceGames)?value.sourceGames:null;
      if(id&&sourceGames){
        // Best-effort: a source-cache failure must never prevent the compact report
        // itself from being saved or displayed.
        saveSourceGames(id,sourceGames).catch(error=>console.warn('Full player-report source cache unavailable.',error));
      }
      return originalPut.call(this,compactReport(value),...args);
    }
  }catch(error){
    console.warn('Player report storage compaction failed; using original value.',error);
  }
  return originalPut.call(this,value,...args);
};

// getReport() in the report engine only relies on the IDB request's onsuccess/onerror
// callbacks. Returning a small compatible request object lets us transparently
// rehydrate the complete source game set before the engine sees the result.
const originalGet=IDBObjectStore.prototype.get;
IDBObjectStore.prototype.get=function(key){
  const dbName=this.transaction?.db?.name;
  if(dbName!==DB_NAME||this.name!==STORE)return originalGet.call(this,key);

  const nativeReq=originalGet.call(this,key);
  const proxy={result:undefined,error:null,onsuccess:null,onerror:null};
  nativeReq.onsuccess=async()=>{
    const compact=nativeReq.result||null;
    if(!compact){proxy.result=null;proxy.onsuccess?.call(proxy,{target:proxy});return;}
    try{
      const source=await loadSourceGames(key);
      if(source?.sourceGames){
        compact.sourceGames=source.sourceGames;
        compact.meta={...(compact.meta||{}),sourcePersistence:'full-source-store'};
      }else{
        compact.meta={...(compact.meta||{}),sourcePersistence:'compact-only'};
      }
    }catch(error){
      console.warn('Could not rehydrate full player-report source games.',error);
      compact.meta={...(compact.meta||{}),sourcePersistence:'compact-only'};
    }
    proxy.result=compact;
    proxy.onsuccess?.call(proxy,{target:proxy});
  };
  nativeReq.onerror=()=>{proxy.error=nativeReq.error;proxy.onerror?.call(proxy,{target:proxy});};
  return proxy;
};

const originalSetItem=Storage.prototype.setItem;
Storage.prototype.setItem=function(key,value){
  if(key===INDEX_KEY){
    try{
      const parsed=JSON.parse(value);
      if(Array.isArray(parsed)){
        for(const item of parsed){
          if(item?.meta&&typeof item.meta==='object')delete item.meta.sourceGames;
        }
        value=JSON.stringify(parsed);
      }
    }catch(error){console.warn('Could not compact saved player-report index.',error);}
  }
  return originalSetItem.call(this,key,value);
};

// Clean the old oversized report cache once. The complete source data is now moved
// to its own store, so this does not remove the new source cache.
(async()=>{
  try{
    if(localStorage.getItem(CLEANUP_KEY)==='1')return;
    const req=indexedDB.open(DB_NAME,1);
    const db=await new Promise((resolve,reject)=>{
      req.onsuccess=()=>resolve(req.result);
      req.onerror=()=>reject(req.error);
      req.onupgradeneeded=()=>{
        if(!req.result.objectStoreNames.contains(STORE))req.result.createObjectStore(STORE,{keyPath:'id'});
      };
    });
    const tx=db.transaction(STORE,'readwrite');
    tx.objectStore(STORE).clear();
    await new Promise((resolve,reject)=>{
      tx.oncomplete=resolve;
      tx.onerror=()=>reject(tx.error||new Error('Legacy cleanup failed'));
      tx.onabort=()=>reject(tx.error||new Error('Legacy cleanup aborted'));
    });
    db.close();
    localStorage.removeItem(INDEX_KEY);
    localStorage.setItem(CLEANUP_KEY,'1');
  }catch(error){
    console.warn('Could not perform one-time player-report cache cleanup.',error);
  }
})();
})();