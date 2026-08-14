const recordGrid = document.getElementById('recordGrid');
const topPlayers = document.getElementById('topPlayers');

// The site does not currently have a verified master list of every strong RK player,
// so this list combines known community players with players already present in the site data.
const seedPlayers = [
  'Mysterious_Past', 'james126', 'Somerandomguy25', 'MandoMan13', 'CuberJ', 'Mixiong'
];

const cache = new Map();

async function getUser(username) {
  if (cache.has(username)) return cache.get(username);
  try {
    const response = await fetch(`https://lichess.org/api/user/${encodeURIComponent(username)}`);
    if (!response.ok) return null;
    const user = await response.json();
    cache.set(username, user);
    return user;
  } catch { return null; }
}

function ratingOf(user) {
  return user?.perfs?.racingKings?.rating || 0;
}

function gamesOf(user) {
  return user?.perfs?.racingKings?.games || 0;
}

function userLink(username) {
  return `https://lichess.org/@/${encodeURIComponent(username)}`;
}

function escapeHtml(value) {
  const div = document.createElement('div');
  div.textContent = String(value ?? '');
  return div.innerHTML;
}

async function loadSeedPlayers() {
  let names = [...seedPlayers];
  try {
    const response = await fetch('players.json', { cache: 'no-store' });
    if (response.ok) {
      const players = await response.json();
      for (const player of players) if (player?.username) names.push(player.username);
    }
  } catch { /* players.json is optional */ }

  names = [...new Set(names.map(n => String(n).trim()).filter(Boolean))];
  const users = await Promise.all(names.map(getUser));
  return users.filter(Boolean);
}

function renderTop10(users) {
  const ranked = users
    .filter(user => ratingOf(user) > 0)
    .sort((a,b) => ratingOf(b) - ratingOf(a))
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

  const best = ranked[0];
  const mostGames = [...users].sort((a,b) => gamesOf(b) - gamesOf(a))[0];
  const highestRating = best;
  renderRecordCards({ highestRating, mostGames });
}

function renderRecordCards({ highestRating, mostGames }) {
  recordGrid.innerHTML = `
    <article class="record-card">
      <span class="record-label">Highest Current RK Rating</span>
      <strong class="record-value">${highestRating ? ratingOf(highestRating) : '—'}</strong>
      <span class="record-player">${highestRating ? escapeHtml(highestRating.username) : 'No data'}</span>
      ${highestRating ? `<a href="${userLink(highestRating.username)}" target="_blank" rel="noopener noreferrer">View on Lichess ↗</a>` : ''}
    </article>
    <article class="record-card">
      <span class="record-label">Most RK Games</span>
      <strong class="record-value">${mostGames ? gamesOf(mostGames).toLocaleString() : '—'}</strong>
      <span class="record-player">${mostGames ? escapeHtml(mostGames.username) : 'No data'}</span>
      ${mostGames ? `<a href="${userLink(mostGames.username)}" target="_blank" rel="noopener noreferrer">View on Lichess ↗</a>` : ''}
    </article>
    <article class="record-card">
      <span class="record-label">Live Data</span>
      <strong class="record-value">Lichess</strong>
      <span class="record-player">Ratings update automatically</span>
      <span class="hof-note">Historical records are kept separately so live ratings do not overwrite them.</span>
    </article>
  `;
}

async function init() {
  try {
    const users = await loadSeedPlayers();
    renderTop10(users);
  } catch {
    topPlayers.innerHTML = '<p class="loading">Unable to load Lichess data. Please try again later.</p>';
    renderRecordCards({});
  }
}

init();
