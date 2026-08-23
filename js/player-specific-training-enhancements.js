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

function applyLichessBoardStyling(){
  for(const board of [document.getElementById('board'),document.getElementById('viewerBoard')]){
    if(!board)continue;
    board.classList.add('lichess-style-board');
    board.querySelectorAll('.rk-piece').forEach(piece=>{
      const t=piece.textContent||'';
      const white='♔♕♖♗♘♙'.includes(t);
      piece.classList.toggle('rk-piece-white',white);
      piece.classList.toggle('rk-piece-black',!white);
    });
  }
}
const boardObserver=new MutationObserver(applyLichessBoardStyling);
const startBoardObserver=()=>{
  for(const id of ['board','viewerBoard']){
    const el=document.getElementById(id);
    if(el)boardObserver.observe(el,{childList:true,subtree:true});
  }
  applyLichessBoardStyling();
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
  if(!installUploadPlayerSelector())setTimeout(boot,50);
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>setTimeout(boot,0),{once:true});else setTimeout(boot,0);
})();