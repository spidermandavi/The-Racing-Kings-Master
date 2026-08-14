const recordGrid = document.getElementById('recordGrid');
const topPlayers = document.getElementById('topPlayers');

const LICHESS_TOP_URL = 'https://lichess.org/api/player/top/10/racingKings';
const THIJS_RK_ALL = 'https://lichess.thijs.com/rankings/racingkings/all/list_players_points.html';
const THIJS_SHIELD = 'https://lichess.thijs.com/rankings/racingkings/shield/list_players_trophies.html';

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
  const ranked = users
    .filter(user => ratingOf(user) > 0)
    .sort((a, b) => ratingOf(b) - ratingOf(a))
    .slice(0, 10);

  if (!ranked.length) {
    topPlayers.innerHTML = '<p class="loading">No Racing Kings ratings could be loaded right now.</p>';
    return;
  }

  topPlayers.innerHTML = ranked.map((user, index) => `
    <div class="top-row">
      <span class="top-rank ${index === 0 ? 'top-1' : ''}">#${index + 1}</span>
      <div class="top-player">
        <a href="${userLink(user.username)}" target="_blank" rel="noopener noreferrer">${escapeHtml(user.username)}</a>
      </div>
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
      <span class="record-label">Most Games in Current Top 10</span>
      <strong class="record-value">${gamesOf(mostGames).toLocaleString()}</strong>
      <span class="record-player">${escapeHtml(mostGames.username)}</span>
      <a href="${userLink(mostGames.username)}" target="_blank" rel="noopener noreferrer">View on Lichess ↗</a>
    </article>
    <article class="record-card">
      <span class="record-label">Historical RK Arena Points</span>
      <strong class="record-value">50,153</strong>
      <span class="record-player">nataniel123</span>
      <a href="${THIJS_RK_ALL}" target="_blank" rel="noopener noreferrer">Open Thijs RK rankings ↗</a>
    </article>
    <article class="record-card">
      <span class="record-label">RK Shield Records</span>
      <strong class="record-value">View rankings</strong>
      <span class="record-player">Shield trophy history</span>
      <a href="${THIJS_SHIELD}" target="_blank" rel="noopener noreferrer">Open Thijs Shield rankings ↗</a>
    </article>
  `;
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
    topPlayers.innerHTML = `
      <div class="loading">
        <p>Could not load the live leaderboard right now.</p>
        <a href="https://lichess.org/player/top/racingKings" target="_blank" rel="noopener noreferrer">Open the Lichess Racing Kings leaderboard ↗</a>
      </div>
    `;
    recordGrid.innerHTML = `
      <article class="record-card">
        <span class="record-label">Lichess Racing Kings Leaderboard</span>
        <strong class="record-value">LIVE</strong>
        <span class="record-player">The official top-player list</span>
        <a href="https://lichess.org/player/top/racingKings" target="_blank" rel="noopener noreferrer">Open on Lichess ↗</a>
      </article>
      <article class="record-card">
        <span class="record-label">Historical RK Arena Points</span>
        <strong class="record-value">50,153</strong>
        <span class="record-player">nataniel123</span>
        <a href="${THIJS_RK_ALL}" target="_blank" rel="noopener noreferrer">Open Thijs RK rankings ↗</a>
      </article>
      <article class="record-card">
        <span class="record-label">RK Shield Records</span>
        <strong class="record-value">View rankings</strong>
        <span class="record-player">Shield trophy history</span>
        <a href="${THIJS_SHIELD}" target="_blank" rel="noopener noreferrer">Open Thijs Shield rankings ↗</a>
      </article>
    `;
  }
}

loadTop10();
