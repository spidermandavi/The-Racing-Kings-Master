(()=>{
'use strict';
if(window.__rkPlayerTrainingEnhancements)return;
window.__rkPlayerTrainingEnhancements=true;

const LICHESS_GAMES=/^https:\/\/lichess\.org\/api\/games\/user\//i;
const sleep=(ms,signal)=>new Promise((resolve,reject)=>{
  if(signal?.aborted)return reject(new DOMException('Operation cancelled.','AbortError'));
  const t=setTimeout(resolve,ms);
  signal?.addEventListener('abort',()=>{clearTimeout(t);reject(new DOMException('Operation cancelled.','AbortError'));},{once:true});
});
const setLoadingMessage=text=>{
  const el=document.getElementById('loadingDetail');
  if(el)el.textContent=text;
};
const isRacingKingsPgn=block=>/\[Variant\s+"(?:Racing Kings|racingKings)"\]/i.test(block)||/\[GameType\s+"racingKings"\]/i.test(block);
const splitPgn=text=>String(text||'').replace(/\r/g,'').trim().split(/\n\s*\n(?=\[Event\s)/g).filter(Boolean);
const headerValue=(block,key)=>{const m=String(block).match(new RegExp(`^\\[${key}\\s+"(.*)"\\]$`,'mi'));return m?.[1]||'';};

// Lichess asks clients to back off after a 429. Retry one time instead of
// turning a temporary API limit into a failed player report.
const originalFetch=window.fetch.bind(window);
window.fetch=async(input,init)=>{
  const url=typeof input==='string'?input:(input?.url||'');
  if(!LICHESS_GAMES.test(url))return originalFetch(input,init);
  const signal=init?.signal||input?.signal;
  let attempt=0;
  while(true){
    const response=await originalFetch(input,init);
    if(response.status!==429||attempt>=1)return response;
    attempt++;
    let seconds=60;
    const retryAfter=response.headers.get('Retry-After');
    if(retryAfter){
      const numeric=Number(retryAfter);
      if(Number.isFinite(numeric))seconds=Math.max(1,Math.min(60,numeric));
      else{
        const when=Date.parse(retryAfter);
        if(Number.isFinite(when))seconds=Math.max(1,Math.min(60,Math.ceil((when-Date.now())/1000)));
      }
    }
    setLoadingMessage(`Lichess rate limit reached. Retrying in ${seconds}s…`);
    for(let left=seconds;left>0;left--){
      if(left<seconds)setLoadingMessage(`Lichess rate limit reached. Retrying in ${left}s…`);
      await sleep(1000,signal);
    }
  }
};

// Defensive API-side validation. The API is requested with perfType=racingKings,
// but a second check prevents unrelated PGNs from entering the analysis engine.
const postFilterFetch=window.fetch;
window.fetch=async(input,init)=>{
  const url=typeof input==='string'?input:(input?.url||'');
  const response=await postFilterFetch(input,init);
  if(!LICHESS_GAMES.test(url)||!response.ok||!response.body)return response;
  try{
    const text=await response.text();
    const blocks=splitPgn(text);
    const filtered=blocks.filter(isRacingKingsPgn).join('\n\n');
    const headers=new Headers(response.headers);
    headers.delete('content-length');
    return new Response(filtered,{status:response.status,statusText:response.statusText,headers});
  }catch(error){
    console.warn('Player-training Racing Kings validation skipped.',error);
    return response;
  }
};

const PIECE_MAP={'♔':'K','♕':'Q','♖':'R','♗':'B','♘':'N','♙':'P','♚':'k','♛':'q','♜':'r','♝':'b','♞':'n','♟':'p'};
const boardToFen=board=>{
  const squares=[...board.querySelectorAll('.rk-square')];
  if(squares.length!==64||squares.some(s=>s.querySelector('img')))return null;
  const ranks=[];
  for(let rank=0;rank<8;rank++){
    let row='',empty=0;
    for(let file=0;file<8;file++){
      const square=squares[rank*8+file];
      const piece=square?.querySelector('.rk-piece')?.textContent?.trim()||'';
      const symbol=PIECE_MAP[piece];
      if(symbol){if(empty){row+=empty;empty=0;}row+=symbol;}else empty++;
    }
    if(empty)row+=empty;
    ranks.push(row);
  }
  return `${ranks.join('/')} w - - 0 1`;
};
const renderLichessBoard=board=>{
  if(!board||board.querySelector('img[data-lichess-board]'))return;
  const fen=boardToFen(board);
  if(!fen)return;
  const img=document.createElement('img');
  img.dataset.lichessBoard='1';
  img.alt='Racing Kings position rendered by Lichess';
  img.decoding='async';
  img.loading='eager';
  img.src=`https://lichess1.org/export/fen.gif?fen=${encodeURIComponent(fen)}&color=white&theme=brown&piece=cburnett`;
  img.style.display='block';
  img.style.width='100%';
  img.style.height='100%';
  img.style.aspectRatio='1 / 1';
  img.style.objectFit='contain';
  img.style.background='#b58863';
  board.replaceChildren(img);
};
const boardObserver=new MutationObserver(mutations=>{
  const boards=new Set();
  for(const m of mutations){const b=m.target.closest?.('.rk-board');if(b)boards.add(b);}
  requestAnimationFrame(()=>boards.forEach(renderLichessBoard));
});
const startBoardObserver=()=>{
  for(const id of ['board','viewerBoard']){
    const el=document.getElementById(id);
    if(el)boardObserver.observe(el,{childList:true,subtree:true});
  }
  for(const id of ['board','viewerBoard']){
    const el=document.getElementById(id);
    if(el)requestAnimationFrame(()=>renderLichessBoard(el));
  }
};

function installUploadPlayerSelector(){
  const fileInput=document.getElementById('pgnFile');
  const fileButton=document.getElementById('fileBtn');
  if(!fileInput||!fileButton||typeof fileButton.onclick!=='function')return false;
  if(fileButton.dataset.playerSelectorInstalled==='1')return true;
  const originalHandler=fileButton.onclick;
  const cache=new WeakMap();

  let selector=document.getElementById('uploadPlayerSelect');
  if(!selector){
    const label=document.createElement('label');
    label.id='uploadPlayerSelectWrap';
    label.className='upload-player-selector';
    label.innerHTML='<strong>Report player</strong><span>Choose which player from this PGN should be analysed.</span>';
    selector=document.createElement('select');
    selector.id='uploadPlayerSelect';
    selector.disabled=true;
    label.appendChild(selector);
    fileButton.before(label);
  }

  fileInput.addEventListener('change',async()=>{
    const file=fileInput.files?.[0];
    selector.innerHTML='';
    selector.disabled=true;
    if(!file)return;
    try{
      const text=await file.text();
      cache.set(file,text);
      const players=new Map();
      for(const block of splitPgn(text)){
        const white=headerValue(block,'White'),black=headerValue(block,'Black');
        for(const name of [white,black].filter(Boolean)){
          const key=name.toLowerCase();
          if(!players.has(key))players.set(key,name);
        }
      }
      [...players.values()].sort((a,b)=>a.localeCompare(b)).forEach(name=>{
        const option=document.createElement('option');
        option.value=name;
        option.textContent=name;
        selector.appendChild(option);
      });
      selector.disabled=selector.options.length<1;
    }catch(error){
      console.warn('Could not prepare the PGN player selector.',error);
    }
  });

  fileButton.onclick=async()=>{
    const file=fileInput.files?.[0];
    const selected=selector.value.trim();
    const originalText=file?cache.get(file):null;
    if(file&&selected&&originalText!=null){
      const filtered=splitPgn(originalText).filter(block=>{
        const white=headerValue(block,'White'),black=headerValue(block,'Black');
        return white.toLowerCase()===selected.toLowerCase()||black.toLowerCase()===selected.toLowerCase();
      }).filter(isRacingKingsPgn).join('\n\n');
      const nativeText=file.text.bind(file);
      try{file.text=async()=>filtered;}catch{}
      try{await originalHandler();}
      finally{try{file.text=nativeText;}catch{}}
      return;
    }
    await originalHandler();
  };
  fileButton.dataset.playerSelectorInstalled='1';
  return true;
}

function installClearReportsWrapper(){
  const button=document.getElementById('clearReportsBtn');
  if(!button||typeof button.onclick!=='function')return false;
  if(button.dataset.sourceCleanupInstalled==='1')return true;
  const original=button.onclick;
  button.onclick=async()=>{
    await original();
    try{
      await new Promise((resolve,reject)=>{
        const req=indexedDB.deleteDatabase('rkPlayerReportSourceV1');
        req.onsuccess=resolve;
        req.onerror=()=>reject(req.error);
        req.onblocked=()=>resolve();
      });
    }catch(error){console.warn('Could not clear full player-report source cache.',error);}
  };
  button.dataset.sourceCleanupInstalled='1';
  return true;
}

function installPerformancePolish(){
  document.querySelectorAll('.weekday-grid,.game-list,.table-scroll').forEach(el=>{el.style.contentVisibility='auto';el.style.containIntrinsicSize='500px';});
  const tz=document.getElementById('timezoneSelect');
  if(tz&&typeof tz.onchange==='function'&&!tz.dataset.debounced){
    const original=tz.onchange;
    let timer=0;
    tz.onchange=event=>{clearTimeout(timer);timer=setTimeout(()=>original.call(tz,event),100);};
    tz.dataset.debounced='1';
  }
}

function boot(){
  startBoardObserver();
  installPerformancePolish();
  if(!installUploadPlayerSelector()||!installClearReportsWrapper())setTimeout(boot,50);
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>setTimeout(boot,0),{once:true});else setTimeout(boot,0);
})();