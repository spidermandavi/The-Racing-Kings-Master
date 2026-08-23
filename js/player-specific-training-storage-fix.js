(()=>{
'use strict';

// Keep player-training persistence compact and non-fatal. A browser storage quota
// failure must never make a successfully analysed report fail.
const DB_NAME='rkPlayerReportsV3';
const STORE='reports';
const INDEX_KEY='rkPlayerReportIndexV3';
const CLEANUP_KEY='rkPlayerReportStorageCompactedV3';
const MAX_SAVED_POSITIONS=500;
const MAX_POSITION_MOVES=6;
const MAX_POSITION_EVALS=3;
const MAX_SAVED_GAMES=50;
const MAX_SAVED_MOVES_PER_GAME=200;

const compactGame=(game)=>{
  if(!game||typeof game!=='object')return game;
  const copy={
    id:game.id,
    headers:game.headers?{...game.headers}:undefined,
    date:game.date,
    color:game.color,
    outcome:game.outcome,
    opponent:game.opponent,
    opponentRating:game.opponentRating,
    timeControlBucket:game.timeControlBucket,
    isTournament:game.isTournament
  };
  // Keep a small playable sample so opening a saved report still has useful games,
  // while preventing thousands of complete move trees from occupying IndexedDB.
  if(Array.isArray(game.moves))copy.moves=game.moves.slice(0,MAX_SAVED_MOVES_PER_GAME);
  else copy.moves=[];
  return copy;
};

const compactReport=(value)=>{
  const meta={...(value.meta||{})};
  delete meta.sourceGames;

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
  compact.storageMode='frozen';
  compact.games=Array.isArray(value.games)?value.games.slice(0,MAX_SAVED_GAMES).map(compactGame):[];
  return compact;
};

const originalPut=IDBObjectStore.prototype.put;
IDBObjectStore.prototype.put=function(value,...args){
  try{
    const dbName=this.transaction?.db?.name;
    if(dbName===DB_NAME&&this.name===STORE&&value&&typeof value==='object'&&value.stats){
      return originalPut.call(this,compactReport(value),...args);
    }
  }catch(error){
    console.warn('Player report storage compaction failed; using original value.',error);
  }
  return originalPut.call(this,value,...args);
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
    }catch(error){
      console.warn('Could not compact saved player-report index.',error);
    }
  }
  return originalSetItem.call(this,key,value);
};

// Clear oversized legacy caches once so the compact format can start cleanly.
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
      tx.onerror=()=>reject(tx.error);
      tx.onabort=()=>reject(tx.error||new Error('IndexedDB cleanup aborted'));
    });
    db.close();
    localStorage.removeItem(INDEX_KEY);
    localStorage.setItem(CLEANUP_KEY,'1');
  }catch(error){
    console.warn('Could not perform one-time player-report cache cleanup.',error);
  }
})();
})();
