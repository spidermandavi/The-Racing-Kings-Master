/* ============================================================
   LEADERBOARDS DATA LAYER
   - Live Racing Kings rating from Lichess API
   - Official title holders from players.json
   - Tournament records from local thijs-leaderboards.json
   ============================================================ */

const RATING_API = 'https://lichess.org/api/player';
const PLAYERS_URL = 'players.json';
const THIJS_DATA_URL = 'json/thijs-leaderboards.json';

const ratingBoard = document.getElementById('ratingBoard');
const titlesBoard = document.getElementById('titlesBoard');
const pointsBoard = document.getElementById('pointsBoard');
const maximumBoard = document.getElementById('maximumBoard');
const eventsBoard = document.getElementById('eventsBoard');
const shieldBoard = document.getElementById('shieldBoard');

function escapeHtml(value) {
  const div = document.createElement('div');
  div.textContent = value == null ? '' : String(value);
  return div.innerHTML;
}

function playerLink(username) {
  return `https://lichess.org/@/${encodeURIComponent(username)}`;
}

function formatNumber(value) {
  if (value == null || value === '') return '—';
  const n = Number(value);
  return Number.isFinite(n) ? n.toLocaleString() : escapeHtml(value);
}

function renderRows(container, rows, metricLabel, valueKey = 'value', usernameKey = 'username') {
  if (!container) return;
  if (!rows?.length) {
    container.innerHTML = '<div class="empty-board">No records are currently available.</div>';
    return;
  }

  container.innerHTML = rows.slice(0, 10).map((row, index) => {
    const username = row[usernameKey] || row.name || row.player || 'Unknown';
    const value = row[valueKey];
    const meta = row.meta || row.events || row.tournaments || '';
    return `
      <div class="rank-row">
        <div class="rank ${index < 3 ? 'top' : ''}">${index + 1}</div>
        <div class="player">
          <div class="player-name"><a href="${playerLink(username)}" target="_blank" rel="noopener noreferrer">${escapeHtml(username)}</a></div>
          ${meta !== '' ? `<div class="player-meta">${escapeHtml(meta)}</div>` : ''}
        </div>
        <div class="metric">${formatNumber(value)}<small>${escapeHtml(metricLabel)}</small></div>
      </div>`;
  }).join('');
}

async function loadRatings() {
  try {
    const response = await fetch(RATING_API, { headers: { Accept: 'application/json' } });
    if (!response.ok) throw new Error(`Lichess API returned ${response.status}`);
    const data = await response.json();
    const players = (Array.isArray(data) ? data : [])
      .filter(p => p?.perfs?.racingKings?.rating)
      .sort((a, b) => (b.perfs.racingKings.rating || 0) - (a.perfs.racingKings.rating || 0))
      .slice(0, 10);

    document.getElementById('ratingCount').textContent = players.length ? 'Top 10' : '—';
    renderRows(ratingBoard, players.map(p => ({
      username: p.username || p.id,
      value: p.perfs.racingKings.rating,
      meta: `${formatNumber(p.perfs.racingKings.games || 0)} rated games`
    })), 'rating');
  } catch (error) {
    console.error('Could not load Lichess Racing Kings leaderboard:', error);
    document.getElementById('ratingCount').textContent = 'Unavailable';
    ratingBoard.innerHTML = `<div class="error">The Lichess rating service could not be reached right now. Please try again later.</div>`;
  }
}

async function loadTitles() {
  try {
    const response = await fetch(PLAYERS_URL, { cache: 'no-store' });
    if (!response.ok) throw new Error(`players.json returned ${response.status}`);
    const players = await response.json();
    const holders = (Array.isArray(players) ? players : [])
      .filter(p => Array.isArray(p.titles) && p.titles.length > 0)
      .sort((a, b) => b.titles.length - a.titles.length || String(a.username).localeCompare(String(b.username)));

    document.getElementById('titleCount').textContent = holders.length;
    renderRows(titlesBoard, holders.map(p => ({
      username: p.username,
      value: p.titles.length,
      meta: p.titles.map(t => typeof t === 'string' ? t : t.code).filter(Boolean).join(' · ')
    })), 'titles');
  } catch (error) {
    console.error('Could not load title holders:', error);
    document.getElementById('titleCount').textContent = '—';
    titlesBoard.innerHTML = '<div class="error">The official title-holder data could not be loaded.</div>';
  }
}

async function loadThijsBoards() {
  try {
    const response = await fetch(THIJS_DATA_URL, { cache: 'no-store' });
    if (!response.ok) throw new Error(`Thijs snapshot returned ${response.status}`);
    const data = await response.json();

    renderRows(pointsBoard, data.points, 'points');
    renderRows(maximumBoard, data.maximum, 'score');
    renderRows(eventsBoard, data.events, 'events');
    renderRows(shieldBoard, data.shield, 'trophies');

    const stamp = data.updatedAt ? new Date(data.updatedAt) : null;
    document.getElementById('dataUpdated').textContent = stamp && !Number.isNaN(stamp.getTime())
      ? stamp.toLocaleDateString(undefined, { day: '2-digit', month: 'short' })
      : 'Ready';
  } catch (error) {
    console.warn('Tournament snapshot is not available yet:', error);
    document.getElementById('dataUpdated').textContent = 'Pending';
    [pointsBoard, maximumBoard, eventsBoard, shieldBoard].forEach((el) => {
      if (el) el.innerHTML = '<div class="empty-board">Tournament data will appear here once the Thijs leaderboard snapshot has been generated.</div>';
    });
  }
}

Promise.allSettled([loadRatings(), loadTitles(), loadThijsBoards()]);
