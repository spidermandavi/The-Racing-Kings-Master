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
  async function deps(){if(!window.supabase)await loadScript('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2');if(!window.rkSupabase||!window.rkAuth)await loadScript('js/supabase.js');}
  function logo(){if(document.querySelector('.rk-brand'))return;const h=document.querySelector('header,.site-header,.topbar,.navbar,.nav-bar');if(!h)return;const a=document.createElement('a');a.className='rk-brand';a.href='index.html';a.innerHTML='<img src="Images/Home logo.png" alt="The Racing Kings Master">';h.prepend(a);}
  async function auth(){const panel=document.getElementById('menuPanel'),right=document.querySelector('.nav-right'),menuBtn=document.getElementById('menuBtn');if(!panel)return;panel.querySelector('[data-rk-auth]')?.remove();const area=document.createElement('div');area.dataset.rkAuth='true';panel.appendChild(area);let user=null;try{await deps();const s=await window.rkAuth.session();if(s)user=await window.rkAuth.user();}catch(e){console.warn(e);}let b=document.getElementById('navAuthBtn');if(!b&&right){b=document.createElement('button');b.className='icon-btn';b.id='navAuthBtn';b.type='button';right.insertBefore(b,menuBtn||null);}if(b){b.textContent=user?`👤 ${user.username}`:'Login';b.onclick=()=>location.href=user?'settings.html':'auth.html';}if(!user){area.appendChild(makeLink('Login / Register','auth.html'));return;}const info=document.createElement('div');info.style.cssText='padding:.45rem .9rem;font-size:.78rem;color:var(--text-muted)';info.textContent=`Signed in as ${user.username}`;area.appendChild(info);area.appendChild(makeLink('💬 Chat','chat.html'));area.appendChild(makeLink('⚙ Settings','settings.html'));const out=document.createElement('button');out.className='icon-btn';out.style.cssText='margin:.4rem;width:calc(100% - .8rem);justify-content:flex-start';out.textContent='Logout';out.onclick=async()=>{await window.rkSupabase.auth.signOut();location.href='index.html';};area.appendChild(out);}
  async function init(){logo();const panel=document.getElementById('menuPanel'),btn=document.getElementById('menuBtn');if(!panel||!btn)return;panel.innerHTML='';RK_MENU_PAGES.forEach(p=>panel.appendChild(makeLink(p.label,pageUrl(p.slug))));await auth();btn.onclick=e=>{e.stopPropagation();panel.classList.toggle('open');};document.addEventListener('click',e=>{if(!panel.contains(e.target)&&!btn.contains(e.target))panel.classList.remove('open');});if(!window.rkSupabase)await deps();await loadScript('js/notifications.js');if(window.rkSupabase)window.rkSupabase.auth.onAuthStateChange(()=>setTimeout(auth,0));}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();
