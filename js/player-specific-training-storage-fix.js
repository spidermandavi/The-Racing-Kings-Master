(()=>{
'use strict';

// Keep saved player-training reports small enough for browser IndexedDB quotas.
// The live report remains untouched; only the persisted copy is compacted.
const DB_NAME='rkPlayerReportsV3';
const STORE='reports';
const INDEX_KEY='rkPlayerReportIndexV3';
const MAX_SAVED_POSITIONS=1000;
const MAX_POSITION_MOVES=8;
const MAX_POSITION_EVALS=4;

const originalPut=IDBObjectStore.prototype.put;
IDBObjectStore.prototype.put=function(value,...args){
  try{
    const dbName=this.transaction?.db?.name;
    if(dbName===DB_NAME && this.name===STORE && value && typeof value==='object' && value.stats){
      const meta={...(value.meta||{})};
      delete meta.sourceGames;

      const stats={...(value.stats||{})};
      // These are derived from the games and are not needed by the saved-report UI.
      // Keeping them was the largest source of quota growth.
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
              .map(m=>({
                ...m,
                evals:Array.isArray(m.evals)?m.evals.slice(-MAX_POSITION_EVALS):[]
              }))
              :[]
          }));
      }

      // Store only one copy of the game sample. sourceGames is redundant in a saved snapshot;
      // the live report still keeps it in memory for filtering.
      const compact={...value,sourceGames:undefined,meta,stats};
      delete compact.sourceGames;
      return originalPut.call(this,compact,...args);
    }
  }catch(error){
    // Never let the quota guard itself break report creation. The original operation remains
    // available when the object is not one of our player-report records.
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
          if(item?.meta && typeof item.meta==='object')delete item.meta.sourceGames;
        }
        value=JSON.stringify(parsed);
      }
    }catch(error){
      console.warn('Could not compact saved player-report index.',error);
    }
  }
  return originalSetItem.call(this,key,value);
};
})();
