/* ============================================================
   GLOBAL NAVIGATION + AUTH MENU
   Loaded on every public page.
   ============================================================ */

const RK_MENU_PAGES = [
  { slug: 'index', label: 'Home' }, { slug: 'leaderboard', label: 'Leaderboards' },
  { slug: 'hall-of-fame', label: 'Hall of Fame' }, { slug: 'titles', label: 'Titles' },
  { slug: 'players', label: 'Players' }, { slug: 'title-checker', label: 'Title Checker' },
  { slug: 'profile', label: 'Profile' }, { slug: 'about', label: 'About' }
];
(function setTheme(){document.documentElement.setAttribute('data-theme',localStorage.getItem('rk-theme')||'dark');})();
(function initGlobalMenu(){
  const pageUrl=s=>s==='index'?'index.html':`${s}.html`;
  const makeLink=(l,h)=>{const a=document.createElement('a');a.href=h;a.textContent=l;return a;};
  const loadScript=src=>new Promise((resolve,reject)=>{const e=document.querySelector(`script[src="${src}"]`);if(e)return e.dataset.loaded==='true'?resolve():(e.addEventListener('load',resolve,{once:true}),e.addEventListener('error',reject,{once:true}));const s=document.createElement('script');s.src=src;s.async=false;s.onload=()=>{s.dataset.loaded='true';resolve();};s.onerror=reject;document.head.appendChild(s);});
  function ensureLogoStyle(){if(document.getElementById('rk-logo-global-style'))return;const s=document.createElement('style');s.id='rk-logo-global-style';s.textContent='.top-bar{min-height:60px!important}.nav-left{min-width:0!important;overflow:hidden!important}.rk-brand{display:flex!important;align-items:center!important;justify-content:flex-start!important;flex:0 1 auto!important;width:190px!important;height:44px!important;max-width:190px!important;max-height:44px!important;min-width:0!important;min-height:0!important;overflow:hidden!important;text-decoration:none!important}.rk-brand img{display:block!important;width:100%!important;height:100%!important;min-width:0!important;min-height:0!important;max-width:190px!important;max-height:44px!important;object-fit:contain!important;object-position:left center!important;flex:none!important}@media(max-width:700px){.rk-brand{width:145px!important;height:38px!important;max-width:145px!important;max-height:38px!important}.rk-brand img{max-width:145px!important;max-height:38px!important}}@media(max-width:430px){.rk-brand{width:112px!important;height:34px!important;max-width:112px!important;max-height:34px!important}.rk-brand img{max-width:112px!important;max-height:34px!important}}';document.head.appendChild(s);}
  async function deps(){if(!window.supabase)await loadScript('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2');if(!window.rkSupabase||!window.rkAuth)await loadScript('js/supabase.js');}
  function logo(){ensureLogoStyle();const h=document.querySelector('header.top-bar,header,.site-header,.topbar,.navbar,.nav-bar');if(!h)return;let left=h.querySelector('.nav-left');if(!left){left=document.createElement('div');left.className='nav-left';h.prepend(left);}let a=h.querySelector('.rk-brand');if(!a){a=document.createElement('a');a.className='rk-brand';a.href='index.html';a.setAttribute('aria-label','The Racing Kings Master — Home');a.title='The Racing Kings Master — Home';a.innerHTML='<img src="Images/Home logo.png" alt="The Racing Kings Master" width="190" height="44">';}if(a.parentElement!==left)left.prepend(a);const img=a.querySelector('img');if(img){img.src='Images/Home logo.png';img.alt='The Racing Kings Master';img.width=190;img.height=44;}a.href='index.html';}

  function escapeHtml(value){const d=document.createElement('div');d.textContent=value==null?'':String(value);return d.innerHTML;}

  async function syncHomepageTitleStats(){
    if(!window.rkSupabase||!document.getElementById('statTitled'))return;
    try{
      const {data,error}=await window.rkSupabase.from('titles').select('id,user_id');
      if(error)throw error;
      const rows=Array.isArray(data)?data:[];
      const titledPlayers=new Set(rows.map(r=>r.user_id).filter(Boolean)).size;
      const awarded=rows.length;
      const titledEl=document.getElementById('statTitled');
      const awardedEl=document.getElementById('statTitlesAwarded');
      if(titledEl)titledEl.textContent=titledPlayers.toLocaleString();
      if(awardedEl)awardedEl.textContent=awarded.toLocaleString();
    }catch(e){console.warn('Could not sync homepage title statistics:',e);}
  }

  async function syncTitlesPage(){
    const grid=document.getElementById('titlesGrid');
    if(!grid||!window.rkSupabase)return;
    try{
      const [titlesResult,profilesResult]=await Promise.all([
        window.rkSupabase.from('titles').select('user_id,title,awarded_at').order('awarded_at',{ascending:true}),
        window.rkSupabase.from('profiles').select('id,username')
      ]);
      if(titlesResult.error)throw titlesResult.error;
      if(profilesResult.error)throw profilesResult.error;
      const profileMap=new Map((profilesResult.data||[]).map(p=>[p.id,p.username]));
      const holderMap=new Map();
      (titlesResult.data||[]).forEach(record=>{
        const username=profileMap.get(record.user_id);
        if(!username)return;
        const code=String(record.title||'').trim().toUpperCase();
        if(!code)return;
        if(!holderMap.has(code))holderMap.set(code,[]);
        holderMap.get(code).push(username);
      });

      grid.querySelectorAll('.title-card').forEach(card=>{
        const badge=card.querySelector('.title-badge-large');
        if(!badge)return;
        const code=badge.textContent.trim().toUpperCase();
        const holders=[...new Set(holderMap.get(code)||[])];
        const countEl=card.querySelector('.title-holder-count strong');
        const list=card.querySelector('.holders-list');
        if(countEl)countEl.textContent=holders.length;
        if(list){
          list.replaceChildren();
          if(!holders.length){const empty=document.createElement('span');empty.className='no-holders';empty.textContent='No current holders';list.appendChild(empty);}
          else holders.forEach(username=>{const a=document.createElement('a');a.className='holder-chip';a.href=`profile.html?u=${encodeURIComponent(username)}`;a.textContent=username;list.appendChild(a);});
        }
      });

      const blitzItem=[...document.querySelectorAll('.common-list li')].find(li=>li.textContent.toLowerCase().includes('blitz norms'));
      if(blitzItem)blitzItem.innerHTML='<strong>Blitz norms</strong> = tournaments using 3+0, 3+2, or 5+0 time controls';
    }catch(e){console.warn('Could not sync title holders from Supabase:',e);}
  }

  function fixLegacyCheckerLinks(){
    document.querySelectorAll('a[href="search.html"]').forEach(a=>{a.href='title-checker.html';});
  }

  async function auth(){const panel=document.getElementById('menuPanel'),right=document.querySelector('.nav-right'),menuBtn=document.getElementById('menuBtn');if(!panel)return;panel.querySelector('[data-rk-auth]')?.remove();const area=document.createElement('div');area.dataset.rkAuth='true';panel.appendChild(area);let user=null;try{await deps();const s=await window.rkAuth.session();if(s)user=await window.rkAuth.user();}catch(e){console.warn(e);}let b=document.getElementById('navAuthBtn');if(!b&&right){b=document.createElement('button');b.className='icon-btn';b.id='navAuthBtn';b.type='button';right.insertBefore(b,menuBtn||null);}if(b){b.textContent=user?`👤 ${user.username}`:'Login';b.onclick=()=>location.href=user?'settings.html':'auth.html';}if(!user){area.appendChild(makeLink('Login / Register','auth.html'));return;}const info=document.createElement('div');info.style.cssText='padding:.45rem .9rem;font-size:.78rem;color:var(--text-muted)';info.textContent=`Signed in as ${user.username}`;area.appendChild(info);area.appendChild(makeLink('💬 Chat','chat.html'));area.appendChild(makeLink('⚙ Settings','settings.html'));if(user.is_admin){area.appendChild(makeLink('🛡 Admin Panel','admin.html'));area.appendChild(makeLink('🎯 Player Specific Training','player-specific-training.html?route=player-stats'));}const out=document.createElement('button');out.className='icon-btn';out.style.cssText='margin:.4rem;width:calc(100% - .8rem);justify-content:flex-start';out.textContent='Logout';out.onclick=async()=>{await window.rkSupabase.auth.signOut();location.href='index.html';};area.appendChild(out);}

  async function init(){
    logo();
    const panel=document.getElementById('menuPanel'),btn=document.getElementById('menuBtn');
    if(!panel||!btn)return;
    panel.innerHTML='';
    RK_MENU_PAGES.forEach(p=>panel.appendChild(makeLink(p.label,pageUrl(p.slug))));
    await auth();
    fixLegacyCheckerLinks();
    await syncHomepageTitleStats();
    await syncTitlesPage();
    btn.onclick=e=>{e.stopPropagation();panel.classList.toggle('open');};
    document.addEventListener('click',e=>{if(!panel.contains(e.target)&&!btn.contains(e.target))panel.classList.remove('open');});
    if(!window.rkSupabase)await deps();
    await loadScript('js/notifications.js');
    if(window.rkSupabase)window.rkSupabase.auth.onAuthStateChange(()=>setTimeout(auth,0));
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();
