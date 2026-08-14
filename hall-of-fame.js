const recordGrid = document.getElementById('recordGrid');
const topPlayers = document.getElementById('topPlayers');

const LICHESS_TOP_URL = 'https://lichess.org/api/player/top/10/racingKings';
const THIJS_RK_POINTS = 'https://lichess.thijs.com/rankings/racingkings/all/list_players_points.html';
const THIJS_RK_SHIELD = 'https://lichess.thijs.com/rankings/racingkings/shield/list_players_maximum.html';

function escapeHtml(value) {
  const div = document.createElement('div');
  div.textContent = String(value ?? '');
  return div.innerHTML;
}

function userLink(username) {
  return `https://lichess.org/@/${encodeURIComponent(username)}`;
}

function ratingOf(user) {
  return user?.perfs?.racingKings?.rating ?? 0;
}

function gamesOf(user) {
  return user?.perfs?.racingKings?.games ?? 0;
}

function renderTop10(users) {
  const ranked = users.filter(user => ratingOf(user) > 0).sort((a, b) => ratingOf(b) - ratingOf(a)).slice(0, 10);
  if (!ranked.length) {
    topPlayers.innerHTML = '<p class="loading">No Racing Kings ratings could be loaded right now.</p>';
    return;
  }

  topPlayers.innerHTML = ranked.map((user, index) => `
    <div class="top-row">
      <span class="top-rank ${index === 0 ? 'top-1' : ''}">#${index + 1}</span>
      <div class="top-player"><a href="${userLink(user.username)}" target="_blank" rel="noopener noreferrer">${escapeHtml(user.username)}</a></div>
      <span class="top-rating">${ratingOf(user)}</span>
      <span class="top-games">${gamesOf(user).toLocaleString()} games</span>
    </div>
  `).join('');

  renderLiveRecords(ranked);
}

function renderLiveRecords(ranked) {
  const leader = ranked[0];
  const mostGames = [...ranked].sort((a, b) => gamesOf(b) - gamesOf(a))[0];

  recordGrid.innerHTML = `
    <article class="record-card">
      <span class="record-label">#1 Current RK Rating</span>
      <strong class="record-value">${ratingOf(leader)}</strong>
      <span class="record-player">${escapeHtml(leader.username)}</span>
      <a href="${userLink(leader.username)}" target="_blank" rel="noopener noreferrer">View on Lichess ↗</a>
    </article>
    <article class="record-card">
      <span class="record-label">Most RK Games — Top 10</span>
      <strong class="record-value">${gamesOf(mostGames).toLocaleString()}</strong>
      <span class="record-player">${escapeHtml(mostGames.username)}</span>
      <a href="${userLink(mostGames.username)}" target="_blank" rel="noopener noreferrer">View on Lichess ↗</a>
    </article>
    <article class="record-card">
      <span class="record-label">All-Time RK Arena Points</span>
      <strong class="record-value">50,153</strong>
      <span class="record-player">nataniel123</span>
      <a href="${THIJS_RK_POINTS}" target="_blank" rel="noopener noreferrer">View Thijs ranking ↗</a>
    </article>
    <article class="record-card shield-record">
      <span class="record-label">RK Shield Champions</span>
      <strong class="record-value">Historical record</strong>
      <div id="shieldLeaders" class="shield-list"><span>Loading Shield records…</span></div>
      <a href="${THIJS_RK_SHIELD}" target="_blank" rel="noopener noreferrer">View full Shield ranking ↗</a>
    </article>
  `;

  loadShieldRecords();
}

// Thijs' site publishes the Shield ranking as a historical HTML table. Browsers may block
// direct cross-origin HTML fetching, so the page always has a reliable link fallback.
async function loadShieldRecords() {
  const container = document.getElementById('shieldLeaders');
  if (!container) return;

  try {
    const response = await fetch(THIJS_RK_SHIELD, { cache: 'no-store' });
    if (!response.ok) throw new Error(`Thijs returned ${response.status}`);
    const html = await response.text();
    const doc = new DOMParser().parseFromString(html, 'text/html');
    const rows = [...doc.querySelectorAll('table tr')].slice(1, 6);
    const records = rows.map(row => {
      const cells = [...row.querySelectorAll('td')].map(cell => cell.textContent.trim());
      const link = row.querySelector('a[href*="lichess.org/@/"]');
      const username = link?.textContent.trim() || cells.find(cell => /^[A-Za-z0-9_-]+$/.test(cell));
      return { username, data: cells };
    }).filter(item => item.username);

    if (!records.length) throw new Error('No Shield rows found');

    container.innerHTML = records.map((item, index) => `
      <div class="shield-row">
        <span>#${index + 1}</span>
        <a href="${userLink(item.username)}" target="_blank" rel="noopener noreferrer">${escapeHtml(item.username)}</a>
        <span>${escapeHtml(item.data[item.data.length - 1] || '')}</span>
      </div>
    `).join('');
  } catch (error) {
    console.info('Shield table could not be fetched directly; keeping Thijs link fallback.', error);
    container.innerHTML = '<span>See the verified historical Shield ranking below.</span>';
  }
}

async function loadTop10() {
  topPlayers.innerHTML = '<div class="loading">Loading the Lichess Racing Kings leaderboard…</div>';
  try {
    const response = await fetch(LICHESS_TOP_URL, { cache: 'no-store' });
    if (!response.ok) throw new Error(`Lichess returned ${response.status}`);
    const users = await response.json();
    renderTop10(Array.isArray(users) ? users : []);
  } catch (error) {
    console.error('Could not load Lichess Racing Kings leaderboard:', error);
    topPlayers.innerHTML = `<div class="loading"><p>Could not load the live leaderboard right now.</p><a href="https://lichess.org/player/top/racingKings" target="_blank" rel="noopener noreferrer">Open the Lichess Racing Kings leaderboard ↗</a></div>`;
    recordGrid.innerHTML = `
      <article class="record-card"><span class="record-label">Lichess Racing Kings Leaderboard</span><strong class="record-value">LIVE</strong><span class="record-player">Official top-player list</span><a href="https://lichess.org/player/top/racingKings" target="_blank" rel="noopener noreferrer">Open on Lichess ↗</a></article>
      <article class="record-card"><span class="record-label">All-Time RK Arena Points</span><strong class="record-value">50,153</strong><span class="record-player">nataniel123</span><a href="${THIJS_RK_POINTS}" target="_blank" rel="noopener noreferrer">View Thijs ranking ↗</a></article>
      <article class="record-card shield-record"><span class="record-label">RK Shield Champions</span><strong class="record-value">Historical record</strong><div id="shieldLeaders" class="shield-list"><span>See verified Thijs ranking below.</span></div><a href="${THIJS_RK_SHIELD}" target="_blank" rel="noopener noreferrer">View full Shield ranking ↗</a></article>
    `;
  }
}

loadTop10();
