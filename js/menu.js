/* ============================================================
   GLOBAL NAVIGATION + AUTH MENU
   Loaded on every public page.
   ============================================================ */

const RK_MENU_PAGES = [
  { slug: 'index', label: 'Home' },
  { slug: 'leaderboard', label: 'Leaderboards' },
  { slug: 'hall-of-fame', label: 'Hall of Fame' },
  { slug: 'titles', label: 'Titles' },
  { slug: 'players', label: 'Players' },
  { slug: 'search', label: 'Title Checker' },
  { slug: 'profile', label: 'Profile' },
  { slug: 'about', label: 'About' }
];

(function setTheme() {
  document.documentElement.setAttribute('data-theme', localStorage.getItem('rk-theme') || 'dark');
})();

(function initGlobalMenu() {
  function pageUrl(slug) {
    return slug === 'index' ? 'index.html' : `${slug}.html`;
  }

  function makeLink(label, href) {
    const a = document.createElement('a');
    a.href = href;
    a.textContent = label;
    return a;
  }

  function addSeparator(panel) {
    const sep = document.createElement('div');
    sep.setAttribute('aria-hidden', 'true');
    sep.style.cssText = 'height:1px;background:var(--border);margin:.3rem .5rem';
    panel.appendChild(sep);
  }

  function addAuthLink(panel, label, href, accent = false) {
    const a = makeLink(label, href);
    if (accent) a.style.color = 'var(--accent)';
    panel.appendChild(a);
  }

  function loadScript(src) {
    return new Promise((resolve, reject) => {
      const existing = document.querySelector(`script[src="${src}"]`);
      if (existing) {
        if (existing.dataset.loaded === 'true') return resolve();
        existing.addEventListener('load', () => resolve(), { once: true });
        existing.addEventListener('error', reject, { once: true });
        return;
      }
      const script = document.createElement('script');
      script.src = src;
      script.async = false;
      script.onload = () => { script.dataset.loaded = 'true'; resolve(); };
      script.onerror = reject;
      document.head.appendChild(script);
    });
  }

  async function ensureAuthDependencies() {
    if (!window.supabase) {
      await loadScript('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2');
    }
    if (!window.rkSupabase || !window.rkAuth) {
      await loadScript('js/supabase.js');
    }
  }

  async function renderAuth() {
    const panel = document.getElementById('menuPanel');
    const right = document.querySelector('.nav-right');
    const menuBtn = document.getElementById('menuBtn');
    if (!panel) return;

    panel.querySelector('[data-rk-auth]')?.remove();
    const authArea = document.createElement('div');
    authArea.dataset.rkAuth = 'true';
    panel.appendChild(authArea);

    let user = null;
    try {
      await ensureAuthDependencies();
      const session = await window.rkAuth.session();
      if (session) user = await window.rkAuth.user();
    } catch (error) {
      console.warn('Global auth menu could not load profile:', error);
    }

    let authButton = document.getElementById('navAuthBtn');
    if (!authButton && right) {
      authButton = document.createElement('button');
      authButton.className = 'icon-btn';
      authButton.id = 'navAuthBtn';
      authButton.type = 'button';
      right.insertBefore(authButton, menuBtn || null);
    }

    if (authButton) {
      authButton.style.display = '';
      authButton.textContent = user ? `👤 ${user.username}` : 'Login';
      authButton.setAttribute('aria-label', user ? `Account: ${user.username}` : 'Login');
      authButton.onclick = () => { window.location.href = user ? 'settings.html' : 'auth.html'; };
    }

    addSeparator(authArea);

    if (!user) {
      addAuthLink(authArea, 'Login / Register', 'auth.html');
      return;
    }

    const signedIn = document.createElement('div');
    signedIn.style.cssText = 'padding:.45rem .9rem;font-size:.78rem;color:var(--text-muted);white-space:nowrap;overflow:hidden;text-overflow:ellipsis';
    signedIn.textContent = `Signed in as ${user.username}`;
    authArea.appendChild(signedIn);

    if (user.is_admin) addAuthLink(authArea, 'Admin Panel', 'admin.html', true);
    addAuthLink(authArea, '💬 Chat', 'chat.html');
    addAuthLink(authArea, '⚙ Settings', 'settings.html');

    const logout = document.createElement('button');
    logout.type = 'button';
    logout.textContent = 'Logout';
    logout.style.cssText = 'display:block;width:calc(100% - .8rem);margin:.15rem .4rem .2rem;padding:.5rem .6rem;border-radius:8px;border:1px solid var(--border);background:transparent;color:var(--text-muted);font:inherit;text-align:left;cursor:pointer';
    logout.onclick = async () => {
      logout.disabled = true;
      logout.textContent = 'Logging out…';
      try {
        await window.rkSupabase.auth.signOut();
      } finally {
        window.location.href = 'index.html';
      }
    };
    authArea.appendChild(logout);
  }

  async function init() {
    const panel = document.getElementById('menuPanel');
    const btn = document.getElementById('menuBtn');
    if (!panel || !btn) return;

    panel.innerHTML = '';
    RK_MENU_PAGES.forEach(page => panel.appendChild(makeLink(page.label, pageUrl(page.slug))));
    await renderAuth();

    btn.onclick = event => {
      event.stopPropagation();
      panel.classList.toggle('open');
      btn.setAttribute('aria-expanded', panel.classList.contains('open') ? 'true' : 'false');
    };

    document.addEventListener('click', event => {
      if (!panel.contains(event.target) && !btn.contains(event.target)) {
        panel.classList.remove('open');
        btn.setAttribute('aria-expanded', 'false');
      }
    });

    if (window.rkSupabase) {
      window.rkSupabase.auth.onAuthStateChange(() => setTimeout(renderAuth, 0));
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }
})();