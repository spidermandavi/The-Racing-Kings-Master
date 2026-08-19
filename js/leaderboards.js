/* ============================================================
   LEADERBOARDS DATA LAYER
   - Live Racing Kings top 20 from the official Lichess API
   - Official title holders from players.json
   - Historical tournament records from the generated snapshot
   ============================================================ */

const RATING_API = 'https://lichess.org/api/player/top/20/racingKings';
const TOP_RATING_URL = 'https://lichess.org/player/top/racingKings';
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

// Leaderboard numbers are displayed without locale separators:
// 2527, not 2,527.
function formatNumber(value) {
  if (value == null || value === '') return '—';
  const n = Number(value);
  if (Number.isFinite(n)) {
    return Number.isInteger(n) ? String(n) : String(n);
  }
  return escapeHtml(value);
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
    const title = row.title ? `<span class="mini-title">${escapeHtml(row.title)}</span>` : '';
    return `
      <div class="rank-row">
        <div class="rank ${index < 3 ? 'top' : ''}">${index + 1}</div>
        <div class="player">
          <div class="player-name"><a href="${playerLink(username)}" target="_blank" rel="noopener noreferrer">${escapeHtml(username)}</a>${title}</div>
          ${meta !== '' ? `<div class="player-meta">${escapeHtml(meta)}</div>` : ''}
        </div>
        <div class="metric">${formatNumber(value)}<small>${escapeHtml(metricLabel)}</small></div>
      </div>`;
  }).join('');
}

async function loadRatings() {
  try {
    const response = await fetch(RATING_API, {
      headers: { Accept: 'application/json' },
      cache: 'no-store'
    });
    if (!response.ok) throw new Error(`Lichess API returned ${response.status}`);

    const data = await response.json();
    const players = Array.isArray(data?.users)
      ? data.users.filter(p => p?.perfs?.racingKings?.rating != null).slice(0, 20)
      : [];

    document.getElementById('ratingCount').textContent = players.length ? `Top ${players.length}` : '—';
    renderRows(ratingBoard, players.map(p => ({
      username: p.username || p.id,
      title: p.title || '',
      value: p.perfs.racingKings.rating,
      meta: `${formatNumber(p.perfs.racingKings.progress || 0)} rating progress${p.online ? ' · online' : ''}`
    })), 'rating');

    const link = document.querySelector('[data-board="rating"] .board-link');
    if (link) {
      link.innerHTML = `<a href="${TOP_RATING_URL}" target="_blank" rel="noopener noreferrer">Lichess Top 200 ↗</a>`;
    }
  } catch (error) {
    console.error('Could not load Lichess Racing Kings leaderboard:', error);
    document.getElementById('ratingCount').textContent = 'Unavailable';
    ratingBoard.innerHTML = `<div class="error">The official Lichess Racing Kings leaderboard could not be reached right now. Please try again later.</div>`;
  }
}

async function loadTitles() {
  try {
    const response = await fetch(PLAYERS_URL, { cache: 'no-store' });
    if (!response.ok) throw new Error(`players.json returned ${response.status}`);
    const players = await response.json();
    const holders = (Array.isArray(players) ? players : [])
      .filter(p => Array.isArray(p.titles) && p.titles.length > 0)
      .sort((a, b) => b.titles.length - a.titles.length || String(a.username || '').localeCompare(String(b.username || '')));

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

function normalizeSnapshotRows(rows, valueKey = 'primary') {
  if (!Array.isArray(rows)) return [];
  return rows.map(row => ({
    username: row.username || row.name || row.player,
    value: row[valueKey] ?? row.value,
    meta: row.meta || ''
  })).filter(row => row.username && row.value != null);
}

async function loadThijsBoards() {
  try {
    const response = await fetch(THIJS_DATA_URL, { cache: 'no-store' });
    if (!response.ok) throw new Error(`Tournament snapshot returned ${response.status}`);
    const data = await response.json();

    const views = data?.views || {};
    const points = views.points || data.points || [];
    const maximum = views.maximum || data.maximum || [];
    const events = views.events || data.events || [];
    const shield = views.trophies || data.shield || data.trophies || [];

    renderRows(pointsBoard, normalizeSnapshotRows(points), 'points');
    renderRows(maximumBoard, normalizeSnapshotRows(maximum), 'score');
    renderRows(eventsBoard, normalizeSnapshotRows(events), 'events');
    renderRows(shieldBoard, normalizeSnapshotRows(shield), 'trophies');

    const stamp = data.updatedAt ? new Date(data.updatedAt) : null;
    document.getElementById('dataUpdated').textContent = stamp && !Number.isNaN(stamp.getTime())
      ? stamp.toLocaleDateString(undefined, { day: '2-digit', month: 'short' })
      : 'Ready';
  } catch (error) {
    console.warn('Tournament snapshot is not available yet:', error);
    document.getElementById('dataUpdated').textContent = 'Pending';
    [pointsBoard, maximumBoard, eventsBoard, shieldBoard].forEach((el) => {
      if (el) el.innerHTML = '<div class="empty-board">Tournament data will appear here once the server-side leaderboard snapshot has been generated.</div>';
    });
  }
}

Promise.allSettled([loadRatings(), loadTitles(), loadThijsBoards()]);
