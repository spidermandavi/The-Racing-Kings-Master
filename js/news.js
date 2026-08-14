// Latest News management for The Racing Kings Master.
// Uses the browser-safe Supabase publishable key and relies on RLS for authorization.
(function () {
  const getClient = () => window.rkSupabase;

  function esc(value) {
    const d = document.createElement('div');
    d.textContent = String(value ?? '');
    return d.innerHTML;
  }

  function formatDate(value) {
    if (!value) return '—';
    return new Date(value).toLocaleDateString('en-GB', {
      day: 'numeric', month: 'short', year: 'numeric'
    });
  }

  function tagClass(category) {
    const c = String(category || '').toLowerCase();
    if (c.includes('title')) return 'gold-tag';
    if (c.includes('system')) return 'cyan-tag';
    return '';
  }

  async function loadNews() {
    const supabase = getClient();
    if (!supabase) return [];
    const { data, error } = await supabase
      .from('news')
      .select('id,title,content,category,published_at,created_at')
      .order('published_at', { ascending: false });
    if (error) throw error;
    return data || [];
  }

  function renderHomeNews(items) {
    const list = document.querySelector('.news-list');
    if (!list) return;
    if (!items.length) {
      list.innerHTML = '<div class="news-placeholder-banner">📰 No news published yet.</div>';
      return;
    }
    list.innerHTML = items.slice(0, 6).map(item => `
      <div class="news-card">
        <div class="news-card-meta">
          <span class="news-tag ${tagClass(item.category)}">${esc(item.category)}</span>
          <span class="news-date">${esc(formatDate(item.published_at))}</span>
        </div>
        <h4>${esc(item.title)}</h4>
        <p>${esc(item.content)}</p>
      </div>
    `).join('');
  }

  function addAdminStyles() {
    if (document.getElementById('rk-news-admin-styles')) return;
    const style = document.createElement('style');
    style.id = 'rk-news-admin-styles';
    style.textContent = `
      .news-admin-panel { display:none; animation:fadeInUp .25s ease; }
      .news-admin-panel.active { display:block; }
      .news-admin-form { background:var(--card); border:1px solid var(--border); border-radius:12px; padding:1rem; margin-bottom:1rem; }
      .news-admin-form input,.news-admin-form textarea,.news-admin-form select { width:100%; box-sizing:border-box; padding:.65rem .75rem; border-radius:8px; border:1px solid var(--input-border); background:var(--input-bg); color:var(--input-text); font:inherit; margin:.3rem 0 .75rem; }
      .news-admin-form textarea { min-height:100px; resize:vertical; }
      .news-admin-grid { display:grid; grid-template-columns:1fr 1fr; gap:.75rem; }
      .news-admin-item { background:var(--card); border:1px solid var(--border); border-radius:12px; padding:1rem; margin-bottom:.65rem; }
      .news-admin-item h3 { margin:0 0 .3rem; font-size:.95rem; }
      .news-admin-meta { color:var(--text-muted); font-size:.76rem; margin-bottom:.5rem; }
      .news-admin-content { color:var(--text-soft); font-size:.84rem; line-height:1.5; margin-bottom:.75rem; }
      .news-admin-actions { display:flex; gap:.45rem; flex-wrap:wrap; }
      @media(max-width:600px){.news-admin-grid{grid-template-columns:1fr;}}
    `;
    document.head.appendChild(style);
  }

  function buildAdminUI() {
    const tabs = document.querySelector('.admin-tabs');
    const main = document.querySelector('main');
    if (!tabs || !main || document.getElementById('news-admin-panel')) return;

    addAdminStyles();

    const btn = document.createElement('button');
    btn.className = 'tab-btn';
    btn.id = 'tab-btn-news';
    btn.textContent = 'News';
    btn.onclick = () => window.rkOpenNewsAdmin();
    tabs.appendChild(btn);

    const panel = document.createElement('div');
    panel.className = 'news-admin-panel';
    panel.id = 'news-admin-panel';
    panel.innerHTML = `
      <div class="section-header">
        <h2>Latest News</h2>
        <button class="sm-btn" id="news-refresh-btn">Refresh</button>
      </div>
      <div class="news-admin-form">
        <h3 style="margin-top:0">Add News</h3>
        <label class="add-form-label">Title</label>
        <input id="newsTitle" placeholder="News headline" maxlength="160">
        <div class="news-admin-grid">
          <div>
            <label class="add-form-label">Category</label>
            <select id="newsCategory">
              <option>Announcement</option><option>Title Update</option><option>System</option><option>Community</option><option>Event</option>
            </select>
          </div>
          <div>
            <label class="add-form-label">Publication date</label>
            <input id="newsDate" type="date">
          </div>
        </div>
        <label class="add-form-label">Content</label>
        <textarea id="newsContent" placeholder="Short description of the announcement" maxlength="5000"></textarea>
        <div style="display:flex;justify-content:flex-end">
          <button class="sm-btn accent" id="newsAddBtn">Publish News</button>
        </div>
      </div>
      <div id="newsAdminList"><p style="color:var(--text-muted)">Loading…</p></div>
    `;
    main.appendChild(panel);

    document.getElementById('newsDate').value = new Date().toISOString().slice(0, 10);
    document.getElementById('news-refresh-btn').onclick = loadAdminNews;
    document.getElementById('newsAddBtn').onclick = addNews;
  }

  async function loadAdminNews() {
    const list = document.getElementById('newsAdminList');
    if (!list) return;
    list.innerHTML = '<p style="color:var(--text-muted)">Loading…</p>';
    try {
      const items = await loadNews();
      list.innerHTML = items.length ? items.map(item => `
        <div class="news-admin-item">
          <div class="news-admin-meta">${esc(item.category)} · ${esc(formatDate(item.published_at))}</div>
          <h3>${esc(item.title)}</h3>
          <div class="news-admin-content">${esc(item.content)}</div>
          <div class="news-admin-actions">
            <button class="sm-btn danger" data-delete-news="${item.id}">Delete</button>
          </div>
        </div>
      `).join('') : '<p style="color:var(--text-muted)">No news published.</p>';
      list.querySelectorAll('[data-delete-news]').forEach(btn => {
        btn.onclick = () => deleteNews(Number(btn.dataset.deleteNews));
      });
    } catch (error) {
      list.innerHTML = `<p style="color:#f87171">${esc(error.message || 'Failed to load news.')}</p>`;
    }
  }

  async function addNews() {
    const supabase = getClient();
    const title = document.getElementById('newsTitle').value.trim();
    const content = document.getElementById('newsContent').value.trim();
    const category = document.getElementById('newsCategory').value;
    const date = document.getElementById('newsDate').value;
    if (!title || !content || !date) return alert('Please fill in the title, content, and date.');

    const { data: sessionData } = await supabase.auth.getSession();
    const user = sessionData.session?.user;
    if (!user) return alert('Please log in first.');

    const { error } = await supabase.from('news').insert({
      title,
      content,
      category,
      published_at: `${date}T12:00:00Z`,
      created_by: user.id
    });
    if (error) return alert(error.message);

    document.getElementById('newsTitle').value = '';
    document.getElementById('newsContent').value = '';
    await loadAdminNews();
  }

  async function deleteNews(id) {
    if (!confirm('Remove this news item from the site?')) return;
    const supabase = getClient();
    const { error } = await supabase.from('news').delete().eq('id', id);
    if (error) return alert(error.message);
    await loadAdminNews();
  }

  window.rkOpenNewsAdmin = function () {
    const panel = document.getElementById('news-admin-panel');
    const btn = document.getElementById('tab-btn-news');
    if (!panel || !btn) return;
    document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    panel.classList.add('active');
    btn.classList.add('active');
    loadAdminNews();
  };

  async function init() {
    const supabase = getClient();
    if (!supabase) return;

    try {
      const items = await loadNews();
      if (document.querySelector('.news-list')) renderHomeNews(items);
    } catch (_) {}

    if (!location.pathname.endsWith('/admin.html') && !location.pathname.endsWith('admin.html')) return;

    const { data: sessionData } = await supabase.auth.getSession();
    const user = sessionData.session?.user;
    if (!user) return;
    const { data: profile } = await supabase.from('profiles').select('is_admin').eq('id', user.id).maybeSingle();
    if (!profile?.is_admin) return;

    buildAdminUI();

    // Make the existing admin tabs automatically close the News panel.
    const originalOpenTab = window.openTab;
    if (typeof originalOpenTab === 'function' && !originalOpenTab.__rkNewsWrapped) {
      const wrapped = function (tab) {
        const panel = document.getElementById('news-admin-panel');
        if (panel) panel.classList.remove('active');
        const newsBtn = document.getElementById('tab-btn-news');
        if (newsBtn) newsBtn.classList.remove('active');
        return originalOpenTab.apply(this, arguments);
      };
      wrapped.__rkNewsWrapped = true;
      window.openTab = wrapped;
    }
  }

  document.addEventListener('DOMContentLoaded', init);
})();
