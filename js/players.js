(() => {
  const playersList = document.getElementById('playersList');
  const titledPlayersList = document.getElementById('titledPlayersList');
  const statusEl = document.getElementById('status');
  const titledStatusEl = document.getElementById('titledStatus');
  const searchInput = document.getElementById('playerSearch');
  const searchBtn = document.getElementById('searchBtn');
  const topCountEl = document.getElementById('topCount');
  const titledCountEl = document.getElementById('titledCount');

  const titleOrder = ['RKSGM','RKGM','RKIM','RKM','RKCM','RKV','RKHM','RKWC'];
  const titleMeta = {
    RKSGM: { name: 'Super Grandmaster', className: 'title-elite' },
    RKGM:  { name: 'Grandmaster', className: 'title-grand' },
    RKIM:  { name: 'International Master', className: 'title-master' },
    RKM:   { name: 'Master', className: 'title-candidate' },
    RKCM:  { name: 'Candidate Master', className: 'title-clight' },
    RKV:   { name: 'Veteran', className: 'title-veteran' },
    RKHM:  { name: 'Honorary Master', className: 'title-special' },
    RKWC:  { name: 'World Champion', className: 'title-special' }
  };

  let titledProfiles = [];
  let topUsers = [];

  const esc = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  }[char]));

  const titleRank = (code) => {
    const index = titleOrder.indexOf(String(code || '').toUpperCase());
    return index === -1 ? 999 : index;
  };

  const titleInfo = (code) => titleMeta[String(code || '').toUpperCase()] || {
    name: String(code || 'Title'),
    className: 'title-special'
  };

  function titleBadge(code, compact = false) {
    const info = titleInfo(code);
    return '<span class="title-badge ' + info.className + (compact ? ' compact' : '') + '">' +
      esc(String(code || '').toUpperCase()) +
      '</span>';
  }

  function titleSummary(codes) {
    return codes
      .slice()
      .sort((a, b) => titleRank(a) - titleRank(b))
      .map((code) => {
        const info = titleInfo(code);
        return titleBadge(code) + '<span class="title-full-name">' + esc(info.name) + '</span>';
      })
      .join('');
  }

  function formatRating(rating) {
    return Number.isFinite(Number(rating)) ? Number(rating).toLocaleString() : 'N/A';
  }

  function formatPercent(value) {
    return Number.isFinite(value) ? value.toFixed(1) + '%' : 'N/A';
  }

  function getRacingKingsPerf(user) {
    return user?.perfs?.racingKings || {};
  }

  function getGames(user) {
    return Number(user?.rkPerfCount?.all ?? getRacingKingsPerf(user).games ?? 0);
  }

  function getWinRate(user) {
    const games = getGames(user);
    const wins = Number(user?.rkPerfCount?.win ?? 0);
    return games ? (wins / games) * 100 : Number.NaN;
  }

  function getHighestRating(user) {
    return user?.rkHighestRating ?? getRacingKingsPerf(user)?.highest?.int ?? getRacingKingsPerf(user)?.rating ?? null;
  }

  function renderStatusCount(el, count, label) {
    if (el) el.textContent = count + ' ' + label;
  }

  function clearList(list) {
    if (list) list.innerHTML = '';
  }

  function renderTopPlayer(user, index, options = {}) {
    const { searchResult = false } = options;
    const username = user.username || user.id || 'Unknown';
    const rk = getRacingKingsPerf(user);
    const rating = rk.rating;
    const games = getGames(user);
    const wins = Number(user?.rkPerfCount?.win ?? 0);
    const highest = getHighestRating(user);
    const siteTitles = Array.isArray(user.siteTitles) ? user.siteTitles : [];
    const lichessTitle = user.title || null;

    const article = document.createElement('article');
    article.className = 'player-row';
    article.style.animationDelay = Math.min(index * 0.045, 0.5) + 's';

    article.innerHTML = `
      <div class="player-rank">${searchResult ? '<span class="rank-search">SEARCH</span>' : '<span class="rank-number">' + (index + 1) + '</span>'}</div>
      <div class="player-main">
        <div class="player-heading">
          <a class="player-link" href="profile.html?u=${encodeURIComponent(username)}">${esc(username)}</a>
          <div class="player-badge-group">
            ${lichessTitle ? '<span class="lichess-title-badge">' + esc(lichessTitle) + '</span>' : ''}
            ${siteTitles.length ? titleBadge(siteTitles[0], true) : '<span class="untitled-badge">No site title</span>'}
          </div>
        </div>
        <div class="player-metrics">
          <span><strong>${esc(formatRating(rating))}</strong><em>rating</em></span>
          <span><strong>${games.toLocaleString()}</strong><em>games</em></span>
          <span><strong>${esc(formatPercent(getWinRate(user)))}</strong><em>win rate</em></span>
        </div>
      </div>
      <button class="player-expand" type="button" aria-expanded="false" aria-label="Show ${esc(username)} details">+</button>
      <div class="player-details">
        <div class="details-grid">
          <div><span>Highest rating</span><strong>${esc(formatRating(highest))}</strong></div>
          <div><span>Lichess title</span><strong>${esc(lichessTitle || 'None')}</strong></div>
          <div><span>Racing Kings games</span><strong>${games.toLocaleString()}</strong></div>
          <div><span>Site title${siteTitles.length === 1 ? '' : 's'}</span><strong>${siteTitles.length ? esc(siteTitles.join(', ')) : 'None'}</strong></div>
        </div>
        <div class="detail-actions">
          <a class="btn" href="profile.html?u=${encodeURIComponent(username)}">View Profile</a>
          <a class="btn" href="https://lichess.org/@/${encodeURIComponent(username)}" target="_blank" rel="noopener noreferrer">Lichess Profile</a>
        </div>
      </div>
    `;

    const expandButton = article.querySelector('.player-expand');
    const details = article.querySelector('.player-details');
    expandButton.addEventListener('click', () => {
      const open = details.classList.toggle('open');
      expandButton.setAttribute('aria-expanded', String(open));
      expandButton.textContent = open ? '−' : '+';
    });

    playersList.appendChild(article);
  }

  function renderTitledPlayer(player, index) {
    const username = player.username;
    const titles = player.titles
      .slice()
      .sort((a, b) => titleRank(a) - titleRank(b));
    const highestTitle = titles[0];
    const info = titleInfo(highestTitle);
    const lichess = player.lichess || {};
    const rk = getRacingKingsPerf(lichess);

    const article = document.createElement('article');
    article.className = 'titled-player-card';
    article.style.animationDelay = Math.min(index * 0.05, 0.6) + 's';

    article.innerHTML = `
      <div class="titled-card-top">
        <div class="title-emblem ${info.className}">${esc(highestTitle)}</div>
        <div class="titled-card-heading">
          <a href="profile.html?u=${encodeURIComponent(username)}" class="titled-username">${esc(username)}</a>
          <span class="titled-name">Racing Kings ${esc(info.name)}</span>
        </div>
      </div>
      <div class="all-titles">${titleSummary(titles)}</div>
      <div class="titled-card-stats">
        <span><strong>${esc(formatRating(rk.rating))}</strong><em>current rating</em></span>
        <span><strong>${getGames(lichess).toLocaleString()}</strong><em>RK games</em></span>
      </div>
      <a class="titled-profile-link" href="profile.html?u=${encodeURIComponent(username)}">Open player profile <span>→</span></a>
    `;

    titledPlayersList.appendChild(article);
  }

  async function fetchLichessUser(username) {
    try {
      const [detailRes, perfRes] = await Promise.all([
        fetch('https://lichess.org/api/user/' + encodeURIComponent(username), {
          headers: { Accept: 'application/json' }
        }),
        fetch('https://lichess.org/api/user/' + encodeURIComponent(username) + '/perf/racingKings', {
          headers: { Accept: 'application/json' }
        })
      ]);

      let detail = {};
      let perf = {};

      if (!detailRes.ok) {
        if (detailRes.status === 404) throw new Error('Player not found on Lichess.');
        throw new Error('Could not load the Lichess player.');
      }

      detail = await detailRes.json();
      if (perfRes.ok) perf = await perfRes.json();

      return {
        ...detail,
        rkPerfCount: perf.stat?.count || {},
        rkHighestRating: perf.stat?.highest?.int ?? null
      };
    } catch {
      return { username };
    }
  }

  async function loadTitleHolders() {
    titledStatusEl.textContent = 'Loading official title holders…';
    try {
      const [titlesResponse, profilesResponse] = await Promise.all([
        window.rkSupabase
          .from('titles')
          .select('user_id,title,awarded_at')
          .order('awarded_at', { ascending: true }),
        window.rkSupabase
          .from('profiles')
          .select('id,username,country')
      ]);

      if (titlesResponse.error) throw titlesResponse.error;
      if (profilesResponse.error) throw profilesResponse.error;

      const profileMap = new Map(
        (profilesResponse.data || []).map((profile) => [profile.id, profile])
      );

      const grouped = new Map();

      for (const row of titlesResponse.data || []) {
        const profile = profileMap.get(row.user_id);
        const code = String(row.title || '').trim().toUpperCase();
        if (!profile?.username || !titleMeta[code]) continue;

        if (!grouped.has(profile.id)) {
          grouped.set(profile.id, {
            username: profile.username,
            country: profile.country || null,
            titles: []
          });
        }

        const item = grouped.get(profile.id);
        if (!item.titles.includes(code)) item.titles.push(code);
      }

      titledProfiles = Array.from(grouped.values()).map((player) => ({
        ...player,
        titles: player.titles.slice().sort((a, b) => titleRank(a) - titleRank(b))
      })).sort((a, b) => {
        const rankDiff = titleRank(a.titles[0]) - titleRank(b.titles[0]);
        return rankDiff || a.username.localeCompare(b.username);
      });

      const enriched = await Promise.all(
        titledProfiles.map(async (player) => ({
          ...player,
          lichess: await fetchLichessUser(player.username)
        }))
      );

      titledProfiles = enriched;

      clearList(titledPlayersList);
      titledProfiles.forEach(renderTitledPlayer);
      renderStatusCount(titledCountEl, titledProfiles.length, titledProfiles.length === 1 ? 'titled player' : 'titled players');
      titledStatusEl.textContent = titledProfiles.length
        ? 'Official Racing Kings Master title holders'
        : 'No official title holders have been recorded yet.';
    } catch (error) {
      console.warn('Could not load titled players:', error);
      clearList(titledPlayersList);
      titledPlayersList.innerHTML = '<p class="section-empty">The titled-player list could not be loaded right now.</p>';
      titledStatusEl.textContent = 'Titled-player data unavailable.';
      renderStatusCount(titledCountEl, 0, 'titled players');
    }
  }

  function mergeSiteTitles(users, titleMap) {
    return users.map((user) => ({
      ...user,
      siteTitles: titleMap.get(String(user.id || user.username || '').toLowerCase()) || []
    }));
  }

  async function buildTitleMap() {
    const [titlesResponse, profilesResponse] = await Promise.all([
      window.rkSupabase.from('titles').select('user_id,title'),
      window.rkSupabase.from('profiles').select('id,username')
    ]);

    if (titlesResponse.error) throw titlesResponse.error;
    if (profilesResponse.error) throw profilesResponse.error;

    const usernameById = new Map(
      (profilesResponse.data || []).map((profile) => [profile.id, profile.username])
    );

    const titleMap = new Map();
    for (const row of titlesResponse.data || []) {
      const username = usernameById.get(row.user_id);
      const code = String(row.title || '').trim().toUpperCase();
      if (!username || !titleMeta[code]) continue;
      const key = username.toLowerCase();
      if (!titleMap.has(key)) titleMap.set(key, []);
      const list = titleMap.get(key);
      if (!list.includes(code)) list.push(code);
    }

    for (const list of titleMap.values()) {
      list.sort((a, b) => titleRank(a) - titleRank(b));
    }

    return titleMap;
  }

  async function loadPlayers() {
    statusEl.textContent = 'Loading the live Lichess top 10…';
    clearList(playersList);

    try {
      const titleMap = await buildTitleMap();
      const response = await fetch('https://lichess.org/api/player/top/10/racingKings', {
        headers: { Accept: 'application/json' }
      });

      if (!response.ok) throw new Error('Failed to load the Racing Kings leaderboard.');

      const data = await response.json();
      const users = data.users || [];

      topUsers = await Promise.all(
        users.map(async (user) => {
          const [detail, perf] = await Promise.all([
            fetchLichessUser(user.id),
            Promise.resolve(user)
          ]);

          return {
            ...user,
            ...detail,
            rkPerfCount: detail.rkPerfCount,
            rkHighestRating: detail.rkHighestRating
          };
        })
      );

      topUsers = mergeSiteTitles(topUsers, titleMap);

      topUsers.forEach((user, index) => renderTopPlayer(user, index));
      renderStatusCount(topCountEl, topUsers.length, topUsers.length === 1 ? 'player' : 'players');
      statusEl.textContent = 'Live Racing Kings leaderboard from Lichess';
    } catch (error) {
      console.warn('Could not load top players:', error);
      playersList.innerHTML = '<p class="section-empty">The live leaderboard could not be loaded right now.</p>';
      statusEl.textContent = 'Leaderboard unavailable.';
      renderStatusCount(topCountEl, 0, 'players');
    }
  }

  async function searchUser(rawUsername) {
    const username = rawUsername.trim();
    if (!username) {
      loadPlayers();
      return;
    }

    statusEl.textContent = 'Searching Lichess for ' + username + '…';
    clearList(playersList);

    try {
      const user = await fetchLichessUser(username);

      if (!user?.username && !user?.id) {
        throw new Error('Player not found.');
      }

      const titleMap = await buildTitleMap();
      user.siteTitles = titleMap.get(String(user.username || user.id).toLowerCase()) || [];

      renderTopPlayer(user, 0, { searchResult: true });
      renderStatusCount(topCountEl, 1, 'search result');
      statusEl.textContent = 'Lichess user found';
    } catch (error) {
      playersList.innerHTML = '<p class="section-empty">Could not find that player on Lichess.</p>';
      renderStatusCount(topCountEl, 0, 'results');
      statusEl.textContent = 'Search failed.';
    }
  }

  searchInput.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') searchUser(searchInput.value);
  });

  searchBtn.addEventListener('click', () => searchUser(searchInput.value));

  searchInput.addEventListener('input', () => {
    if (!searchInput.value.trim()) loadPlayers();
  });

  loadPlayers();
  loadTitleHolders();
})();