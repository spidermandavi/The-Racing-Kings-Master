(()=>{
'use strict';
if(window.__rkPlayerSpecificTrainingV2)return;
window.__rkPlayerSpecificTrainingV2=true;

const DAYS=['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'];
const FILES='abcdefgh';
const DB_NAME='rkPlayerReportsV3';
const INDEX_KEY='rkPlayerReportIndexV3';
const MAX_GAMES=5000;
const MAX_SAVED_REPORTS=8;
const RK_START={a1:'q',b1:'r',c1:'b',d1:'n',e1:'N',f1:'B',g1:'R',h1:'Q',a2:'k',b2:'r',c2:'b',d2:'n',e2:'N',f2:'B',g2:'R',h2:'K'};

const $=id=>document.getElementById(id);
const cloneBoard=b=>({...b});
let report=null,charts=[],moveRows=[],moveIndex=0,viewerGame=null,viewerPly=0,activeController=null;

const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const waitFrame=()=>new Promise(r=>requestAnimationFrame(r));

function setStatus(text,type=''){
  const el=$('status');
  el.textContent=text;
  el.className='status '+type;
}
function loading(show,title='Working…',detail='',pct=0,count=0,cancellable=false){
  $('loadingBox').hidden=!show;
  $('loadingTitle').textContent=title;
  $('loadingDetail').textContent=detail;
  $('progressBar').style.width=`${Math.max(0,Math.min(100,pct))}%`;
  $('progressPercent').textContent=`${Math.round(pct)}%`;
  $('progressCount').textContent=`${count} games`;
  $('cancelFetchBtn').hidden=!cancellable;
}
function checkCancelled(signal){
  if(signal?.aborted)throw new DOMException('Operation cancelled.','AbortError');
}

function buildApiUrl(user,max,rated,from,to){
  const q=new URLSearchParams({rated:String(rated),tags:'true',clocks:'true',evals:'true',opening:'true',literate:'true',max:String(max),perfType:'racingKings'});
  if(from)q.set('since',String(Date.parse(`${from}T00:00:00.000Z`)));
  if(to)q.set('until',String(Date.parse(`${to}T23:59:59.999Z`)));
  return `https://lichess.org/api/games/user/${encodeURIComponent(user)}?${q.toString()}`;
}
function splitPgn(text){
  const t=text.replace(/\r/g,'').trim();
  return t?t.split(/\n\s*\n(?=\[Event\s)/g):[];
}
function parseHeaders(block){
  const h={};
  block.replace(/^\[([^ ]+)\s+"(.*)"\]$/gm,(_,k,v)=>(h[k]=v,''));
  const idx=block.search(/\n\s*\n/);
  return{headers:h,movesText:idx>=0?block.slice(idx).trim():''};
}
function clockSeconds(v){
  const a=String(v).split(':').map(Number);
  if(a.some(n=>!Number.isFinite(n)))return null;
  if(a.length===3)return a[0]*3600+a[1]*60+a[2];
  if(a.length===2)return a[0]*60+a[1];
  return a[0];
}
function evalValue(v){
  if(!v)return null;
  if(v[0]==='#'){
    const n=Number(v.slice(1));
    return Number.isFinite(n)?(n>0?99:-99):null;
  }
  const n=Number(v);
  return Number.isFinite(n)?n:null;
}
function parseTc(v){
  const m=String(v||'').match(/^(\d+)(?:\+(\d+))?/);
  return m?{base:Number(m[1]),inc:Number(m[2]||0)}:{base:null,inc:0};
}
function timeControlBucket(v){
  const s=String(v||'');
  if(!s||s==='-')return 'correspondence';
  const tc=parseTc(s);
  if(!Number.isFinite(tc.base))return 'unknown';
  const estimated=tc.base+40*tc.inc;
  if(estimated<180)return 'bullet';
  if(estimated<480)return 'blitz';
  if(estimated<1500)return 'rapid';
  return 'classical';
}
function isTournamentGame(g){return /lichess\.org\/(?:tournament|swiss)\//i.test(String(g.headers.Site||''))||/(arena|swiss)/i.test(String(g.headers.Event||''));}
function tokenizeMoves(text){
  const out=[],re=/(\{[^}]*\}|\([^)]*\)|\d+\.(?:\.\.)?|1-0|0-1|1\/2-1\/2|\*|[^\s{}()]+)/g;
  let m;while((m=re.exec(text)))out.push(m[0]);
  return out;
}
function parseGame(block,index,username){
  const {headers,movesText}=parseHeaders(block);
  if(!headers.White||!headers.Black||!headers.Result)return null;
  const dateText=(headers.UTCDate||headers.Date||'').replace(/\./g,'-');
  const d=new Date(`${dateText}T${headers.UTCTime||'00:00:00'}Z`);
  if(Number.isNaN(+d))return null;
  const moves=[];let last=null,ply=0,variationDepth=0;
  for(const token of tokenizeMoves(movesText)){
    if(token==='('){variationDepth++;continue}
    if(token===')'){variationDepth=Math.max(0,variationDepth-1);continue}
    if(variationDepth>0)continue;
    if(/^\d+\.(\.\.)?$/.test(token)||/^(1-0|0-1|1\/2-1\/2|\*)$/.test(token))continue;
    if(token[0]==='{'){
      const clk=token.match(/\[%clk\s+([^\]]+)\]/i),ev=token.match(/\[%eval\s+([^\]]+)\]/i);
      if(last){if(clk)last.clock=clockSeconds(clk[1]);if(ev)last.eval=evalValue(ev[1]);}
      continue;
    }
    if(token[0]==='[')continue;
    const san=token.replace(/[!?]+$/,'');
    if(!san||/^[=$]/.test(san))continue;
    last={ply,number:Math.floor(ply/2)+1,side:ply%2===0?'white':'black',san,clock:null,eval:null};
    moves.push(last);ply++;
  }
  const me=String(username).toLowerCase();
  const white=String(headers.White).toLowerCase(),black=String(headers.Black).toLowerCase();
  const color=white===me?'white':black===me?'black':null;
  if(!color)return null;
  const outcome=headers.Result==='1/2-1/2'?'draw':((color==='white'&&headers.Result==='1-0')||(color==='black'&&headers.Result==='0-1'))?'win':'loss';
  const id=(headers.Site||'').match(/([A-Za-z0-9_-]{8,20})$/)?.[1]||`game-${index}`;
  const opponent=color==='white'?headers.Black:headers.White;
  const opponentRating=Number(color==='white'?headers.BlackElo:headers.WhiteElo);
  return{id,headers,date:d.toISOString(),color,outcome,moves,opponent,opponentRating:Number.isFinite(opponentRating)?opponentRating:null,timeControlBucket:timeControlBucket(headers.TimeControl),isTournament:isTournamentGame({headers})};
}

async function fetchStream(url,signal,onBytes){
  checkCancelled(signal);
  const res=await fetch(url,{headers:{Accept:'application/x-chess-pgn'},signal});
  if(!res.ok)throw new Error(`Lichess returned HTTP ${res.status}`);
  if(!res.body)return res.text();
  const reader=res.body.getReader(),dec=new TextDecoder();
  const totalBytes=Number(res.headers.get('content-length')||0);let bytes=0,text='';
  for(;;){
    checkCancelled(signal);
    const {value,done}=await reader.read();
    if(done)break;
    bytes+=value.byteLength;
    text+=dec.decode(value,{stream:true});
    onBytes?.(bytes,totalBytes);
  }
  return text+dec.decode();
}
function dateToMs(v,end=false){return Date.parse(`${v}T${end?'23:59:59.999':'00:00:00.000'}Z`);}
function splitDateRange(from,to){
  if(!from||!to)return null;
  const a=dateToMs(from),b=dateToMs(to);
  if(!Number.isFinite(a)||!Number.isFinite(b)||a>=b)return null;
  const mid=a+Math.floor((b-a)/2);
  const d=new Date(mid).toISOString().slice(0,10);
  if(d===from||d===to)return null;
  const prev=new Date(mid-86400000).toISOString().slice(0,10);
  return [{from,to:prev},{from:d,to}];
}

function scorePct(x){return x.games?+(100*(x.wins+x.draws*.5)/x.games).toFixed(1):null;}
function winRate(x){return x.games?+(100*x.wins/x.games).toFixed(1):null;}
function decisiveWinRate(x){const d=x.wins+x.losses;return d?+(100*x.wins/d).toFixed(1):null;}
function recordFor(games){
  const r={games:games.length,wins:0,losses:0,draws:0};
  for(const g of games){if(g.outcome==='win')r.wins++;else if(g.outcome==='loss')r.losses++;else r.draws++;}
  r.score=scorePct(r);r.winRate=winRate(r);r.decisiveWinRate=decisiveWinRate(r);return r;
}
function positionKey(board,side){return `${side}|${Object.keys(board).sort().map(s=>s+board[s]).join(',')}`;}
function squareCoord(s){return{x:FILES.indexOf(s[0]),y:Number(s[1])-1};}
function lineClear(board,from,to){
  const a=squareCoord(from),b=squareCoord(to),dx=Math.sign(b.x-a.x),dy=Math.sign(b.y-a.y);
  let x=a.x+dx,y=a.y+dy;
  while(x!==b.x||y!==b.y){if(board[FILES[x]+(y+1)])return false;x+=dx;y+=dy;}
  return true;
}
function movementMatches(type,from,target,side,capture,board){
  const f=squareCoord(from),t=squareCoord(target),dx=t.x-f.x,dy=t.y-f.y;
  if(type==='N')return (Math.abs(dx)===1&&Math.abs(dy)===2)||(Math.abs(dx)===2&&Math.abs(dy)===1);
  if(type==='K')return Math.max(Math.abs(dx),Math.abs(dy))===1;
  if(type==='B')return Math.abs(dx)===Math.abs(dy)&&lineClear(board,from,target);
  if(type==='R')return (dx===0||dy===0)&&lineClear(board,from,target);
  if(type==='Q')return (Math.abs(dx)===Math.abs(dy)||(dx===0||dy===0))&&lineClear(board,from,target);
  return false;
}
function applySan(board,san,side){
  let s=String(san).replace(/[+#?!]+$/,'');
  if(/^O-O/i.test(s))return board; // Castling does not exist in Racing Kings.
  const target=(s.match(/([a-h][1-8])$/)||[])[1];
  if(!target)return board;
  const type='KQRBN'.includes(s[0])?s[0]:'P';
  if(type==='P')return board; // Racing Kings has no pawns.
  const want=side==='white'?type:type.toLowerCase();
  const capture=s.includes('x');
  const prefix=s.slice(0,target.length?-(target.length):undefined).replace(/x/g,'');
  const dis=type==='P'?'':prefix.slice(type.length).replace(/[^a-h1-8]/g,'');
  const candidates=[];
  for(const from of Object.keys(board)){
    if(board[from]!==want)continue;
    if(dis&&!(from.includes(dis)))continue;
    if(!movementMatches(type,from,target,side,capture,board))continue;
    if(!capture&&board[target])continue;
    if(capture&&board[target]&&board[target].toLowerCase()===want.toLowerCase())continue;
    candidates.push(from);
  }
  const from=candidates[0];if(!from)return board;
  delete board[from];
  if(board[target])delete board[target];
  board[target]=want;
  return board;
}
function boardAt(game,ply){
  const b=cloneBoard(RK_START);
  for(let i=0;i<=ply&&i<game.moves.length;i++)applySan(b,game.moves[i].san,game.moves[i].side);
  return b;
}
function kingSquare(board,side){const k=side==='white'?'K':'k';return Object.keys(board).find(s=>board[s]===k)||null;}

function analyseGames(games,username,meta={}){
  const sorted=games.slice().sort((a,b)=>new Date(b.date)-new Date(a.date));
  const record=recordFor(sorted);
  const color={white:recordFor(sorted.filter(g=>g.color==='white')),black:recordFor(sorted.filter(g=>g.color==='black'))};
  const openingMap=new Map(),positionMap=new Map(),moveMap=new Map();
  const phases={Opening:{moves:0,time:0,evals:[],games:0},Middlegame:{moves:0,time:0,evals:[],games:0},Endgame:{moves:0,time:0,evals:[],games:0}};
  let totalPlies=0,evals=[],clockSamples=0,thinkTotal=0;
  for(const g of sorted){
    totalPlies+=g.moves.length;
    const opening=g.headers.Opening||g.headers.Variation||g.headers.ECO||'Unknown opening';
    const o=openingMap.get(opening)||{name:opening,games:0,wins:0,losses:0,draws:0};
    o.games++;o[g.outcome==='win'?'wins':g.outcome==='loss'?'losses':'draws']++;openingMap.set(opening,o);
    const b=cloneBoard(RK_START);const tc=parseTc(g.headers.TimeControl);let ownClock=tc.base;
    const seenPhases=new Set();
    for(const m of g.moves){
      if(m.eval!=null){const pe=g.color==='white'?m.eval:-m.eval;evals.push(pe);}
      if(m.side!==g.color){applySan(b,m.san,m.side);continue;}
      const phase=m.ply<16?'Opening':m.ply<40?'Middlegame':'Endgame';
      if(!seenPhases.has(phase)){phases[phase].games++;seenPhases.add(phase);}
      const key=positionKey(b,g.color), moveKey=`${key}|${m.san}`;
      const x=moveMap.get(moveKey)||{key:moveKey,positionKey:key,ply:m.ply,san:m.san,games:0,wins:0,losses:0,draws:0,evals:[],examples:[]};
      x.games++;x[g.outcome==='win'?'wins':g.outcome==='loss'?'losses':'draws']++;
      if(m.eval!=null)x.evals.push(g.color==='white'?m.eval:-m.eval);
      if(x.examples.length<5)x.examples.push({gameId:g.id,ply:m.ply});
      moveMap.set(moveKey,x);
      const pos=positionMap.get(key)||{key,ply:m.ply,games:0,wins:0,losses:0,draws:0,moves:new Map(),examples:[]};
      pos.games++;pos[g.outcome==='win'?'wins':g.outcome==='loss'?'losses':'draws']++;
      const pm=pos.moves.get(m.san)||{san:m.san,games:0,wins:0,losses:0,draws:0};
      pm.games++;pm[g.outcome==='win'?'wins':g.outcome==='loss'?'losses':'draws']++;
      pos.moves.set(m.san,pm);if(pos.examples.length<3)pos.examples.push({gameId:g.id,ply:m.ply});positionMap.set(key,pos);
      if(m.eval!=null)phases[phase].evals.push(g.color==='white'?m.eval:-m.eval);
      phases[phase].moves++;
      if(m.clock!=null&&ownClock!=null){
        let spent=ownClock-m.clock+tc.inc;if(spent<0)spent=0;
        if(spent<1800){phases[phase].time+=spent;thinkTotal+=spent;clockSamples++;}ownClock=m.clock;
      }else if(m.clock!=null)ownClock=m.clock;
      applySan(b,m.san,m.side);
    }
  }
  const openings=[...openingMap.values()].map(x=>({...x,score:scorePct(x),winRate:winRate(x),decisiveWinRate:decisiveWinRate(x)}));
  const moves=[...moveMap.values()].map(x=>({...x,score:scorePct(x),winRate:winRate(x),decisiveWinRate:decisiveWinRate(x),avgEval:x.evals.length?+(x.evals.reduce((a,b)=>a+b,0)/x.evals.length).toFixed(2):null}));
  const positions=[...positionMap.values()].map(x=>{const arr=[...x.moves.values()].map(m=>({...m,score:scorePct(m),winRate:winRate(m),decisiveWinRate:decisiveWinRate(m)})).sort((a,b)=>b.games-a.games);return{...x,moves:arr,score:scorePct(x),winRate:winRate(x)};});
  const phasesOut=Object.entries(phases).map(([name,x])=>({name,moves:x.moves,time:x.time,avgTime:x.moves?+(x.time/x.moves).toFixed(1):0,avgEval:x.evals.length?+(x.evals.reduce((a,b)=>a+b,0)/x.evals.length).toFixed(2):null,games:x.games}));
  const recent=recordFor(sorted.slice(0,50)),previous=recordFor(sorted.slice(50,100));
  const colorTrend={white:color.white,black:color.black};
  return{version:3,id:null,username,createdAt:new Date().toISOString(),games:sorted,meta,stats:{...record,whiteGames:color.white.games,blackGames:color.black.games,averagePlies:sorted.length?+(totalPlies/sorted.length).toFixed(1):0,averageMoves:sorted.length?+(totalPlies/2/sorted.length).toFixed(1):0,avgEval:evals.length?+(evals.reduce((a,b)=>a+b,0)/evals.length).toFixed(2):null,avgThinkingTime:clockSamples?+(thinkTotal/clockSamples).toFixed(1):null,openingData:openings,moves,positions,phases:phasesOut,color:colorTrend,recent,previous,clockSamples,totalPlies}};
}

function openDB(){
  return new Promise((resolve,reject)=>{
    const req=indexedDB.open(DB_NAME,1);
    req.onupgradeneeded=()=>req.result.createObjectStore('reports',{keyPath:'id'});
    req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error);
  });
}
async function saveReport(r){
  r.id=`${r.username.toLowerCase()}-${Date.now()}`;
  const db=await openDB();
  let list=[];try{list=JSON.parse(localStorage.getItem(INDEX_KEY)||'[]')}catch{}
  const oldForUser=list.filter(x=>x.username.toLowerCase()===r.username.toLowerCase()).map(x=>x.id);
  const trimmed=list.filter(x=>x.username.toLowerCase()!==r.username.toLowerCase());
  const next=[{id:r.id,username:r.username,games:r.games.length,createdAt:r.createdAt,meta:r.meta},...trimmed].slice(0,MAX_SAVED_REPORTS);
  const stale=[...new Set([...oldForUser,...list.filter(x=>!next.some(n=>n.id===x.id)).map(x=>x.id)])].filter(id=>id!==r.id);
  const tx=db.transaction('reports','readwrite');
  tx.objectStore('reports').put(r);
  for(const id of stale)tx.objectStore('reports').delete(id);
  await new Promise((res,rej)=>{tx.oncomplete=res;tx.onerror=()=>rej(tx.error)});
  localStorage.setItem(INDEX_KEY,JSON.stringify(next));
  await renderSavedReports();
}
async function getReport(id){
  const db=await openDB(),tx=db.transaction('reports','readonly');
  return new Promise(resolve=>{const req=tx.objectStore('reports').get(id);req.onsuccess=()=>resolve(req.result||null);req.onerror=()=>resolve(null);});
}
async function renderSavedReports(){
  let list=[];try{list=JSON.parse(localStorage.getItem(INDEX_KEY)||'[]')}catch{}
  const el=$('savedReports');
  if(!list.length){el.innerHTML='<span class="muted">No saved reports yet.</span>';return;}
  el.innerHTML=list.map(x=>`<div class="saved-report"><div class="saved-report-main"><strong>${esc(x.username)}</strong><span>${x.games} games • ${new Date(x.createdAt).toLocaleString()}</span></div><button class="secondary-btn" data-id="${esc(x.id)}">Open</button></div>`).join('');
  el.querySelectorAll('[data-id]').forEach(b=>b.onclick=async()=>{const r=await getReport(b.dataset.id);if(r)renderReport(r);else setStatus('Saved report could not be opened.','error');});
}
function destroyCharts(){while(charts.length)charts.pop().destroy();}
function makeChart(canvas,title,data,labels){
  const c=new Chart(canvas,{data:{labels:labels||Array.from({length:24},(_,i)=>`${String(i).padStart(2,'0')}:00`),datasets:[{type:'bar',label:'Games',data:data.map(x=>x.games),yAxisID:'games'},{type:'line',label:'Win rate',data:data.map(x=>winRate(x)),yAxisID:'rate',spanGaps:true,tension:.25,pointRadius:2}]},options:{responsive:true,maintainAspectRatio:false,plugins:{title:{display:!!title,text:title}},scales:{games:{beginAtZero:true,position:'left',ticks:{precision:0}},rate:{beginAtZero:true,max:100,position:'right',grid:{drawOnChartArea:false}}}}});charts.push(c);
}
function populateTimezones(){
  const s=$('timezoneSelect'),browser=Intl.DateTimeFormat().resolvedOptions().timeZone||'UTC';let zones=[];try{zones=Intl.supportedValuesOf?.('timeZone')||[]}catch{}
  const all=['UTC',browser,...zones.filter(z=>z!==browser&&z!=='UTC')];
  s.innerHTML=all.map(z=>`<option value="${esc(z)}">${esc(z)}${z===browser?' (browser timezone)':''}</option>`).join('');s.value='UTC';
}
function timezoneParts(date,tz){
  const parts=new Intl.DateTimeFormat('en-US',{timeZone:tz,weekday:'short',hour:'2-digit',hourCycle:'h23'}).formatToParts(new Date(date));
  const get=t=>parts.find(x=>x.type===t)?.value;
  return{hour:Number(get('hour')),weekday:get('weekday')||''};
}
function renderTimeCharts(tz){
  destroyCharts();
  $('overallTimezone').textContent=`Timezone: ${tz}`;$('weekdayTimezone').textContent=`Timezone: ${tz}`;
  const hourly=Array.from({length:24},()=>({games:0,wins:0,losses:0,draws:0}));
  const weekday=Array.from({length:7},()=>({games:0,wins:0,losses:0,draws:0}));
  for(const g of report.games){const p=timezoneParts(g.date,tz),wi=DAYS.indexOf(p.weekday);if(wi<0)continue;hourly[p.hour].games++;weekday[wi].games++;hourly[p.hour][g.outcome==='win'?'wins':g.outcome==='loss'?'losses':'draws']++;weekday[wi][g.outcome==='win'?'wins':g.outcome==='loss'?'losses':'draws']++;}
  makeChart($('overallChart'),`All selected games — ${tz}`,hourly);
  const wrap=$('weekdayCharts');wrap.innerHTML='';
  DAYS.forEach((day,index)=>{const card=document.createElement('div');card.className='chart-card day-card';card.innerHTML=`<h3>${day}</h3><p>${weekday[index].games} games • ${esc(tz)}</p><div style="height:280px"><canvas></canvas></div>`;wrap.appendChild(card);const arr=Array.from({length:24},()=>({games:0,wins:0,losses:0,draws:0}));report.games.forEach(g=>{const p=timezoneParts(g.date,tz);if(DAYS.indexOf(p.weekday)!==index)return;arr[p.hour].games++;arr[p.hour][g.outcome==='win'?'wins':g.outcome==='loss'?'losses':'draws']++;});makeChart(card.querySelector('canvas'),' ',arr);});
}

function applyFilters(games){
  const color=$('colorFilter').value,time=$('timeControlFilter').value,tournament=$('tournamentFilter').value,min=Number($('opponentMin').value)||0,max=Number($('opponentMax').value)||9999;
  return games.filter(g=>{
    if(color!=='all'&&g.color!==color)return false;
    if(time!=='all'&&g.timeControlBucket!==time)return false;
    if(tournament==='tournament'&&!g.isTournament)return false;
    if(tournament==='non-tournament'&&g.isTournament)return false;
    if(g.opponentRating!=null&&(g.opponentRating<min||g.opponentRating>max))return false;
    if(g.opponentRating==null&&(min>0||max<9999))return false;
    return true;
  });
}
function filterLabel(){
  const c=$('colorFilter').selectedOptions[0].textContent,t=$('timeControlFilter').selectedOptions[0].textContent,tr=$('tournamentFilter').selectedOptions[0].textContent;
  return `${c} • ${t} • ${tr}`;
}
function renderTrainingPriorities(){
  const s=report.stats;
  const cards=[];
  const colors=[s.color.white,s.color.black].filter(x=>x.games>=5).sort((a,b)=>(a.score??101)-(b.score??101));
  if(colors[0]){const side=s.color.white===colors[0]?'White':'Black';cards.push(['Color weakness',`${side} score ${colors[0].score}%`,`Based on ${colors[0].games} games.`]);}
  const weakOpen=s.openingData.filter(x=>x.games>=5&&x.score!=null).sort((a,b)=>a.score-b.score)[0];
  if(weakOpen)cards.push(['Opening priority',esc(weakOpen.name),`${weakOpen.score}% score across ${weakOpen.games} games.`]);
  const weakPhase=s.phases.filter(x=>x.moves>=10).slice().sort((a,b)=>(a.avgEval??0)-(b.avgEval??0))[0];
  if(weakPhase)cards.push(['Phase priority',weakPhase.name,`Average player-perspective evaluation ${weakPhase.avgEval==null?'—':weakPhase.avgEval}.`]);
  const slow=s.phases.filter(x=>x.moves>=10).slice().sort((a,b)=>b.avgTime-a.avgTime)[0];
  if(slow)cards.push(['Time management',slow.name,`Highest average thinking time: ${slow.avgTime}s per player move.`]);
  const weakMove=s.positions.filter(x=>x.games>=4&&x.moves.length).map(p=>{const best=p.moves.slice().sort((a,b)=>(a.score??101)-(b.score??101))[0];return best?{p,best}:null}).filter(Boolean).sort((a,b)=>(a.best.score??101)-(b.best.score??101))[0];
  if(weakMove)cards.push(['Recurring position',weakMove.best.san,`${weakMove.best.score}% score in a position seen ${weakMove.p.games} times.`]);
  $('trainingPriorityGrid').innerHTML=cards.map(([a,b,c])=>`<div class="priority-card"><span>${a}</span><strong>${b}</strong><small>${c}</small></div>`).join('')||'<div class="muted">Not enough data for automatic training priorities.</div>';
}
function renderTrend(){
  const s=report.stats,r=s.recent,p=s.previous;
  const diff=(r.score!=null&&p.score!=null)?+(r.score-p.score).toFixed(1):null;
  const formCards=[['Last 10',recordFor(report.games.slice(0,10))],['Last 25',recordFor(report.games.slice(0,25))],['Last 50',r]];
  $('recentFormGrid').innerHTML=formCards.map(([name,x])=>`<div class="trend-card"><span>${name}</span><strong>${x.score==null?'—':x.score+'%'}</strong><small>${x.wins}-${x.losses}-${x.draws}</small></div>`).join('');
  $('trendSummary').innerHTML=diff==null?'Not enough recent history for a 50-game comparison.':`Last 50 score: <strong>${r.score}%</strong> vs previous 50: <strong>${p.score}%</strong> — ${diff>0?'improved':diff<0?'declined':'unchanged'} by <strong>${Math.abs(diff)} percentage points</strong>.`;
}
function renderReportWarnings(){
  const m=report.meta||{};const warnings=[];
  if(m.apiFetched>=m.requestedMax&&!m.autoSplitCompleted)warnings.push(`The fetch reached the ${m.requestedMax}-game request limit. This report may not include every matching game.`);
  if(m.apiFetched>=m.requestedMax&&m.autoSplitCompleted)warnings.push(`The selected date range required automatic date-range splitting to avoid the ${m.requestedMax}-game per-request cap.`);
  if(m.sourceTotal!==m.filteredTotal)warnings.push(`${m.sourceTotal} games were fetched; ${m.filteredTotal} remain after the current training filters.`);
  $('reportWarnings').innerHTML=warnings.map(w=>`<div class="warning-card">${esc(w)}</div>`).join('');
}
function renderColorStats(){
  const c=report.stats.color;
  $('colorStats').innerHTML=['white','black'].map(side=>{const x=c[side];return `<div class="data-row"><div><strong>${side==='white'?'White':'Black'}</strong><small>${x.games} games • ${x.wins}-${x.losses}-${x.draws}</small></div><strong>${x.score==null?'—':x.score+'% score'}</strong></div>`}).join('');
}
function renderOpenings(){
  const common=report.stats.openingData.slice().sort((a,b)=>b.games-a.games),danger=report.stats.openingData.filter(x=>x.games>=3&&x.score!=null).sort((a,b)=>a.score-b.score);
  const row=x=>`<div class="data-row"><div><strong>${esc(x.name)}</strong><small>${x.games} games • ${x.wins}-${x.losses}-${x.draws}</small></div><strong>${x.score==null?'—':x.score+'%'}</strong></div>`;
  $('commonOpenings').innerHTML=common.slice(0,8).map(row).join('')||'<span class="muted">Not enough data.</span>';
  $('dangerousOpenings').innerHTML=danger.slice(0,8).map(row).join('')||'<span class="muted">No opening with at least 3 games.</span>';
}
function renderPhases(){
  $('phaseGrid').innerHTML=report.stats.phases.map(p=>`<div class="phase-card"><h3>${p.name}</h3><p>${p.moves} player moves across ${p.games} games</p><div class="phase-metric"><span>Average thinking</span><strong>${p.avgTime}s</strong></div><div class="phase-metric"><span>Average eval</span><strong>${p.avgEval==null?'—':p.avgEval}</strong></div><div class="phase-metric"><span>Total inferred time</span><strong>${Math.round(p.time/60)}m</strong></div></div>`).join('');
}
function renderMoveTable(){
  if(!report)return;
  const min=Math.max(1,Number($('moveMinGames').value)||1),sort=$('moveSort').value;
  moveRows=report.stats.positions.flatMap(p=>p.moves.map(m=>({...m,positionKey:p.key,positionGames:p.games,positionPly:p.ply,examples:p.examples}))).filter(x=>x.games>=min);
  moveRows.sort((a,b)=>sort==='frequency'?b.games-a.games:sort==='winrate'?(b.score??-1)-(a.score??-1):sort==='worstrate'?(a.score??101)-(b.score??101):sort==='eval'?0:a.positionPly-b.positionPly);
  moveIndex=Math.min(moveIndex,Math.max(0,moveRows.length-1));
  $('moveTable').innerHTML=`<table class="move-table"><thead><tr><th>Move</th><th>Position games</th><th>Move games</th><th>Score</th><th>Eval</th></tr></thead><tbody>${moveRows.map((x,i)=>`<tr class="move-row ${i===moveIndex?'selected':''}" data-i="${i}"><td>${esc(x.san)}</td><td>${x.positionGames}</td><td>${x.games}</td><td>${x.score==null?'—':x.score+'%'}</td><td>—</td></tr>`).join('')}</tbody></table>`;
  $('moveTable').querySelectorAll('[data-i]').forEach(el=>el.onclick=()=>{moveIndex=Number(el.dataset.i);showSelectedMove();});
  if(moveRows.length)showSelectedMove();else clearBoard();
}
function showSelectedMove(){
  const x=moveRows[moveIndex];if(!x)return;
  document.querySelectorAll('.move-row').forEach(r=>r.classList.toggle('selected',Number(r.dataset.i)===moveIndex));
  const ex=x.examples?.[0],game=report.games.find(g=>g.id===ex?.gameId);if(!game)return;
  drawBoard($('board'),boardAt(game,x.positionPly-1),(game.moves[x.positionPly-1]?.san.match(/([a-h][1-8])$/)||[])[1]||null);
  $('selectedMoveTitle').textContent=`${x.san} — move ${Math.floor(x.positionPly/2)+1}${x.positionPly%2?'...':'.'}`;
  $('selectedMoveMeta').textContent=`Position seen ${x.positionGames} times • move played ${x.games} times • ${x.score==null?'—':x.score+'% score'}`;
  $('boardMoveList').innerHTML=game.moves.filter(m=>m.side===game.color).map(m=>`<button class="ply-chip ${m.ply===x.positionPly?'active':''}" data-ply="${m.ply}">${m.number}${m.side==='white'?'.':'...'} ${esc(m.san)}</button>`).join('');
  $('boardMoveList').querySelectorAll('[data-ply]').forEach(b=>b.onclick=()=>openGame(Number(report.games.indexOf(game)),Number(b.dataset.ply)));
  const king=kingSquare(boardAt(game,x.positionPly-1),game.color);$('boardRuleNote').textContent=king&&king[1]==='8'?`${game.color==='white'?'White':'Black'} king has reached the 8th rank in this position.`:'Racing Kings position • no pawns • no castling • checks are forbidden.';
}
function clearBoard(el=$('board')){el.innerHTML='<div style="grid-column:1/-1;display:flex;align-items:center;justify-content:center;color:var(--text-muted)">Select a move to display the position.</div>';}
function drawBoard(el,b,last){
  el.innerHTML='';
  for(let r=7;r>=0;r--)for(let c=0;c<8;c++){
    const sq=FILES[c]+(r+1),d=document.createElement('div');d.className=`rk-square ${(r+c)%2?'dark':'light'} ${sq===last?'last-move':''}`;
    const p=b[sq];
    if(p){const glyph={K:'♔',Q:'♕',R:'♖',B:'♗',N:'♘',k:'♚',q:'♛',r:'♜',b:'♝',n:'♞'}[p];d.innerHTML=`<span class="rk-piece">${glyph||''}</span>`;}
    el.appendChild(d);
  }
}
function renderGames(){
  const items=report.games.slice(0,80);
  $('gameList').innerHTML=items.map((g,i)=>`<div class="game-item"><div class="game-item-main"><strong>${esc(g.headers.White)} vs ${esc(g.headers.Black)}</strong><span>${new Date(g.date).toLocaleString()} • ${esc(g.headers.Opening||g.headers.ECO||'Racing Kings')} • <span class="game-result-${g.outcome}">${g.outcome}</span></span></div><button class="secondary-btn" data-game="${i}">Open</button></div>`).join('')||'<span class="muted">No games match the current filters.</span>';
  $('gameList').querySelectorAll('[data-game]').forEach(b=>b.onclick=()=>openGame(Number(b.dataset.game),0));
}
function openGame(i,ply=0){viewerGame=report.games[i];if(!viewerGame)return;viewerPly=Math.max(0,Math.min(viewerGame.moves.length-1,ply));$('gameViewer').hidden=false;renderGameViewer();}
function renderGameViewer(){
  if(!viewerGame)return;
  $('viewerTitle').textContent=`${viewerGame.headers.White} vs ${viewerGame.headers.Black}`;
  $('viewerMeta').textContent=`${new Date(viewerGame.date).toLocaleString()} • ${viewerGame.outcome} • ${viewerGame.moves.length} plies • ${viewerGame.timeControlBucket}`;
  const b=boardAt(viewerGame,viewerPly),last=(viewerGame.moves[viewerPly]?.san.match(/([a-h][1-8])$/)||[])[1]||null;
  drawBoard($('viewerBoard'),b,last);$('viewerRuleNote').textContent=kingSquare(b,viewerGame.color)?.[1]==='8'?`${viewerGame.color==='white'?'White':'Black'} king has reached rank 8.`:'Racing Kings: no checks, no castling, no pawns.';
  $('viewerMoves').innerHTML=viewerGame.moves.map(m=>`<button class="viewer-move ${m.ply===viewerPly?'active':''}" data-ply="${m.ply}">${m.number}${m.side==='white'?'.':'...'} ${esc(m.san)}</button>`).join('');
  $('viewerMoves').querySelectorAll('[data-ply]').forEach(b=>b.onclick=()=>{viewerPly=Number(b.dataset.ply);renderGameViewer();});
}

function renderReport(r){
  report=r;
  $('username').value=r.username;
  $('summary').innerHTML=`<div class="summary-card">Games<strong>${r.stats.total}</strong><small>after filters</small></div><div class="summary-card">Win rate<strong>${r.stats.winRate??0}%</strong><small>all games</small></div><div class="summary-card">Score<strong>${r.stats.score??0}%</strong><small>wins + half draws</small></div><div class="summary-card">Record<strong>${r.stats.wins}-${r.stats.losses}-${r.stats.draws}</strong><small>W-L-D</small></div>`;
  $('summary').hidden=false;$('results').hidden=false;$('overviewText').textContent=`${r.username} • ${r.stats.total} Racing Kings games • ${filterLabel()} • saved ${new Date(r.createdAt).toLocaleString()}`;
  $('statGrid').innerHTML=[['White games',r.stats.whiteGames],['Black games',r.stats.blackGames],['Average eval',r.stats.avgEval==null?'—':r.stats.avgEval],['Average moves',r.stats.averageMoves],['Average thinking / player move',r.stats.avgThinkingTime==null?'—':`${r.stats.avgThinkingTime}s`],['Unique positions',r.stats.positions.length],['Tracked openings',r.stats.openingData.length],['Games fetched',r.meta?.sourceTotal??r.stats.total]].map(([a,b])=>`<div class="stat-card"><span class="label">${esc(a)}</span><strong>${esc(b)}</strong></div>`).join('');
  renderReportWarnings();renderTrainingPriorities();renderTrend();renderColorStats();renderOpenings();renderPhases();renderMoveTable();renderGames();renderTimeCharts($('timezoneSelect').value||'UTC');
}

function parseFetchedGames(text,username){
  const blocks=splitPgn(text),games=[];
  for(let i=0;i<blocks.length;i++){const g=parseGame(blocks[i],i,username);if(g)games.push(g);}
  return games;
}
async function fetchChunk(username,max,rated,from,to,signal,progress){
  const url=buildApiUrl(username,max,rated,from,to);
  const text=await fetchStream(url,signal,(bytes,total)=>progress?.(bytes,total));
  checkCancelled(signal);
  return parseFetchedGames(text,username);
}
async function fetchCompleteRange(username,max,rated,from,to,signal){
  let autoSplitCompleted=false,totalRequests=0,all=[];
  const queue=[{from,to}];
  while(queue.length){
    checkCancelled(signal);
    const part=queue.shift();totalRequests++;
    loading(true,'Fetching games…',part.from&&part.to?`${part.from} → ${part.to}`:'Streaming matching games',Math.min(74,8+(totalRequests-1)*5),all.length,true);
    const chunk=await fetchChunk(username,max,rated,part.from,part.to,signal,(bytes,totalBytes)=>{const detail=totalBytes?`Downloaded ${(bytes/1048576).toFixed(1)} MB`:'Receiving game stream';loading(true,'Fetching games…',detail,Math.min(72,8+(bytes/(totalBytes||Math.max(bytes,1))*60)),all.length,true);});
    all.push(...chunk);
    if(chunk.length>=max){
      const split=splitDateRange(part.from,part.to);
      if(split){queue.unshift(...split);autoSplitCompleted=true;continue;}
    }
    await waitFrame();
  }
  const byId=new Map();for(const g of all)byId.set(g.id,g);
  return{games:[...byId.values()],autoSplitCompleted,requests:totalRequests,apiFetched:all.length};
}
async function processText(text,username,meta={}){
  checkCancelled(activeController?.signal);
  const blocks=splitPgn(text),games=[];
  for(let i=0;i<blocks.length;i++){
    checkCancelled(activeController?.signal);
    const g=parseGame(blocks[i],i,username);if(g)games.push(g);
    if(i%15===0){loading(true,'Analysing games…',`${i+1} of ${blocks.length} game records`,76+(i/Math.max(1,blocks.length))*20,games.length,true);await waitFrame();}
  }
  if(!games.length)throw new Error('No usable Racing Kings games were found.');
  const filtered=applyFilters(games);
  if(!filtered.length)throw new Error('No games match the current training filters.');
  const r=analyseGames(filtered,username,{...meta,sourceTotal:games.length,filteredTotal:filtered.length,requestedMax:meta.requestedMax||MAX_GAMES});
  loading(true,'Finalising report…','Calculating training priorities, positions, openings, clocks and time patterns',99,filtered.length,true);
  await saveReport(r);
  return r;
}

async function fetchGames(){
  const username=$('username').value.trim();
  if(!username)return setStatus('Enter a Lichess username.','error');
  const max=Math.min(MAX_GAMES,Math.max(1,Number($('maxGames').value)||MAX_GAMES));
  const from=$('fromDate').value,to=$('toDate').value;
  if(from&&to&&from>to)return setStatus('The from date must not be after the to date.','error');
  $('fetchBtn').disabled=true;$('fileBtn').disabled=true;$('cancelFetchBtn').hidden=false;activeController=new AbortController();
  loading(true,'Starting Lichess fetch…','Preparing cancellable game stream',0,0,true);setStatus('');
  try{
    const result=await fetchCompleteRange(username,max,$('ratedOnly').checked,from,to,activeController.signal);
    loading(true,'Processing fetched games…','Applying training filters and building the report',74,result.apiFetched,true);
    const r=await processText(result.games.map(g=>g._raw||'').filter(Boolean).join('\n\n'),username);
    r.meta={sourceTotal:result.games.length,filteredTotal:r.games.length,requestedMax:max,autoSplitCompleted:result.autoSplitCompleted,requests:result.requests,apiFetched:result.apiFetched};
    await saveReport(r);renderReport(r);setStatus(`Analysed and saved ${r.games.length} games for ${r.username}.`,'success');
  }catch(e){
    if(e.name==='AbortError')setStatus('Report fetch cancelled. No partial report was saved.','error');
    else setStatus(`Could not build the report: ${e.message}`,'error');
  }finally{loading(false);$('fetchBtn').disabled=false;$('fileBtn').disabled=false;activeController=null;}
}

async function fetchGamesCorrected(){
  const username=$('username').value.trim();if(!username)return setStatus('Enter a Lichess username.','error');
  const max=Math.min(MAX_GAMES,Math.max(1,Number($('maxGames').value)||MAX_GAMES));const from=$('fromDate').value,to=$('toDate').value;
  if(from&&to&&from>to)return setStatus('The from date must not be after the to date.','error');
  $('fetchBtn').disabled=true;$('fileBtn').disabled=true;activeController=new AbortController();loading(true,'Fetching games…','The request can be cancelled at any time.',0,0,true);setStatus('');
  try{
    const result=await fetchCompleteRange(username,max,$('ratedOnly').checked,from,to,activeController.signal);
    checkCancelled(activeController.signal);
    const meta={sourceTotal:result.apiFetched,filteredTotal:0,requestedMax:max,autoSplitCompleted:result.autoSplitCompleted,requests:result.requests,apiFetched:result.apiFetched};
    const records=[];
    for(let i=0;i<result.games.length;i++){
      checkCancelled(activeController.signal);records.push(result.games[i]);if(i%20===0){loading(true,'Preparing report…',`${i+1} of ${result.games.length} games`,76+(i/Math.max(1,result.games.length))*18,i,true);await waitFrame();}
    }
    const filtered=applyFilters(records);if(!filtered.length)throw new Error('No games match the current training filters.');
    meta.filteredTotal=filtered.length;
    const r=analyseGames(filtered,username,meta);await saveReport(r);renderReport(r);
    setStatus(`Analysed and saved ${r.games.length} games for ${r.username}.`,'success');
  }catch(e){
    if(e.name==='AbortError')setStatus('Report fetch cancelled. No partial report was saved.','error');
    else setStatus(`Could not build the report: ${e.message}`,'error');
  }finally{loading(false);$('fetchBtn').disabled=false;$('fileBtn').disabled=false;activeController=null;}
}
async function uploadPgn(){
  const file=$('pgnFile').files[0];if(!file)return setStatus('Choose a PGN file first.','error');
  $('fileBtn').disabled=true;$('fetchBtn').disabled=true;activeController=new AbortController();loading(true,'Reading PGN…','Loading local file',5,0,true);
  try{
    const text=await file.text();checkCancelled(activeController.signal);const blocks=splitPgn(text);if(!blocks.length)throw new Error('No games found in the PGN.');
    const counts=new Map();for(const block of blocks){const {headers}=parseHeaders(block);[headers.White,headers.Black].filter(Boolean).forEach(n=>counts.set(n,(counts.get(n)||0)+1));}
    const username=[...counts.entries()].sort((a,b)=>b[1]-a[1])[0]?.[0]||'PGN Player';
    const games=parseFetchedGames(text,username);const filtered=applyFilters(games);if(!filtered.length)throw new Error('No games in the uploaded PGN match the current filters.');
    const r=analyseGames(filtered,username,{sourceTotal:games.length,filteredTotal:filtered.length,uploaded:true});await saveReport(r);renderReport(r);setStatus(`Analysed and saved ${r.games.length} local games.`,'success');
  }catch(e){if(e.name==='AbortError')setStatus('PGN analysis cancelled. No partial report was saved.','error');else setStatus(`Could not analyse the PGN: ${e.message}`,'error');}
  finally{loading(false);$('fileBtn').disabled=false;$('fetchBtn').disabled=false;activeController=null;}
}
function sourceMode(mode){document.querySelectorAll('.source-btn').forEach(b=>b.classList.toggle('active',b.dataset.source===mode));$('apiSource').hidden=mode!=='api';$('fileSource').hidden=mode!=='file';setStatus('');}
function resetFilters(){['colorFilter','timeControlFilter','tournamentFilter'].forEach(id=>$(id).value='all');$('opponentMin').value='';$('opponentMax').value='';}
async function deleteAllReports(){
  if(!confirm('Delete all saved player reports from this browser?'))return;
  const db=await openDB(),tx=db.transaction('reports','readwrite');tx.objectStore('reports').clear();await new Promise(r=>tx.oncomplete=r);localStorage.removeItem(INDEX_KEY);report=null;$('results').hidden=true;$('summary').hidden=true;await renderSavedReports();setStatus('All saved reports were deleted.','success');
}

document.querySelectorAll('.source-btn').forEach(b=>b.onclick=()=>sourceMode(b.dataset.source));
$('fetchBtn').onclick=fetchGamesCorrected;$('fileBtn').onclick=uploadPgn;$('cancelFetchBtn').onclick=()=>{if(activeController){activeController.abort();$('cancelFetchBtn').disabled=true;$('loadingDetail').textContent='Cancelling…';}};
$('moveSort').onchange=()=>{moveIndex=0;renderMoveTable();};$('moveMinGames').oninput=()=>{moveIndex=0;renderMoveTable();};
$('prevMoveBtn').onclick=()=>{if(moveRows.length){moveIndex=(moveIndex-1+moveRows.length)%moveRows.length;showSelectedMove();}};$('nextMoveBtn').onclick=()=>{if(moveRows.length){moveIndex=(moveIndex+1)%moveRows.length;showSelectedMove();}};
$('viewerPrev').onclick=()=>{if(viewerGame){viewerPly=Math.max(0,viewerPly-1);renderGameViewer();}};$('viewerNext').onclick=()=>{if(viewerGame){viewerPly=Math.min(viewerGame.moves.length-1,viewerPly+1);renderGameViewer();}};
$('timezoneSelect').onchange=()=>{if(report)renderTimeCharts($('timezoneSelect').value);};$('clearReportsBtn').onclick=deleteAllReports;

async function init(){
  try{
    const me=await rkAuth.user();
    if(!me?.is_admin){$('accessState').textContent='Access denied. This page is only available to administrators.';return;}
    $('accessState').hidden=true;$('app').hidden=false;populateTimezones();
    const now=new Date();$('toDate').value=now.toISOString().slice(0,10);$('fromDate').value=new Date(now.getTime()-30*86400000).toISOString().slice(0,10);await renderSavedReports();
  }catch(e){$('accessState').textContent='Could not verify administrator permissions.';}
}
init();
})();