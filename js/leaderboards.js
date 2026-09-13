/* ============================================================
   LEADERBOARDS DATA LAYER
   - Live Racing Kings top 20 from the official Lichess API
   - Official title holders from Supabase
   - Historical tournament records from the generated Thijs snapshot
   ============================================================ */

const RATING_API = 'https://lichess.org/api/player/top/20/racingKings';
const TOP_RATING_URL = 'https://lichess.org/player/top/racingKings';
const SUPABASE_URL = 'https://oprfbthhvbqdiktnuqzz.supabase.co';
const SUPABASE_PUBLIC_KEY = 'sb_publishable_qad4DWNHCFaLLbTv7cnZsw_t2YPsnuL';
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
  if (Number.isFinite(n)) return Number.isInteger(n) ? String(n) : String(n);
  return escapeHtml(value);
}

function renderRows(container, rows, metricLabel, valueKey = 'value', usernameKey = 'username') {
  if (!container) return;
  if (!rows?.length) {
    container.innerHTML = '<div class="empty-board">No verified records are currently available.</div>';
    return;
  }

  container.innerHTML = rows.slice(0, 10).map((row, index) => {
    const username = row[usernameKey] || row.name || row.player || 'Unknown';
    const value = row[valueKey];
    const meta = row.meta || '';
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

function setBoardMessage(container, message, type = 'empty-board') {
  if (container) container.innerHTML = `<div class="${type}">${escapeHtml(message)}</div>`;
}

async function supabaseGet(resource) {
  const response = await fetch(`${SUPABASE_URL}/rest/v1/${resource}`, {
    headers: {
      apikey: SUPABASE_PUBLIC_KEY,
      Authorization: `Bearer ${SUPABASE_PUBLIC_KEY}`,
      Accept: 'application/json'
    },
    cache: 'no-store'
  });
  if (!response.ok) throw new Error(`Supabase returned ${response.status}`);
  return response.json();
}

async function loadRatings() {
  try {
    const response = await fetch(RATING_API, { headers: { Accept: 'application/json' }, cache: 'no-store' });
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
      meta: p.online ? 'online' : ''
    })), 'rating');

    const link = document.querySelector('[data-board="rating"] .board-link');
    if (link) link.innerHTML = `<a href="${TOP_RATING_URL}" target="_blank" rel="noopener noreferrer">View Lichess leaderboard ↗</a>`;
  } catch (error) {
    console.error('Could not load Lichess Racing Kings leaderboard:', error);
    document.getElementById('ratingCount').textContent = 'Unavailable';
    setBoardMessage(ratingBoard, 'The official Lichess Racing Kings leaderboard could not be reached right now.', 'error');
  }
}

async function loadTitles() {
  try {
    const [profiles, titles] = await Promise.all([
      supabaseGet('profiles?select=id,username'),
      supabaseGet('titles?select=user_id,title,awarded_at&order=awarded_at.asc')
    ]);

    const byId = new Map((Array.isArray(profiles) ? profiles : []).map(profile => [
      profile.id,
      { username: profile.username, titles: [] }
    ]));

    (Array.isArray(titles) ? titles : []).forEach(record => {
      const player = byId.get(record.user_id);
      if (!player || !record.title) return;
      player.titles.push({ code: record.title, awardedAt: record.awarded_at });
    });

    const holders = [...byId.values()]
      .filter(player => player.titles.length > 0)
      .sort((a, b) =>
        b.titles.length - a.titles.length ||
        String(a.username || '').localeCompare(String(b.username || ''))
      );

    document.getElementById('titleCount').textContent = holders.length;
    renderRows(titlesBoard, holders.map(player => ({
      username: player.username,
      value: player.titles.length,
      meta: player.titles.map(title => title.code).join(' · ')
    })), 'titles');
  } catch (error) {
    console.error('Could not load title holders from Supabase:', error);
    document.getElementById('titleCount').textContent = '—';
    setBoardMessage(titlesBoard, 'The title-holder data could not be loaded right now.', 'error');
  }
}

// Do not fall back to a generic row.value here. A fallback can silently put the
// wrong statistic into a board (for example points displayed as Shield trophies).
function normalizeSnapshotRows(rows, metric) {
  if (!Array.isArray(rows)) return [];
  return rows.map(row => ({
    username: row?.username || row?.name || row?.player,
    value: row?.primary,
    metric: row?.metric,
    meta: row?.meta || ''
  })).filter(row =>
    row.username &&
    row.value != null &&
    row.metric === metric &&
    Number.isFinite(Number(row.value))
  ).sort((a, b) => Number(b.value) - Number(a.value));
}

async function loadThijsBoards() {
  try {
    const response = await fetch(THIJS_DATA_URL, { cache: 'no-store' });
    if (!response.ok) throw new Error(`Tournament snapshot returned ${response.status}`);
    const data = await response.json();
    const views = data?.views || {};

    const boards = [
      { key: 'points', container: pointsBoard, label: 'points' },
      { key: 'maximum', container: maximumBoard, label: 'score' },
      { key: 'events', container: eventsBoard, label: 'events' },
      { key: 'trophies', container: shieldBoard, label: 'trophies' }
    ];

    boards.forEach(({ key, container, label }) => {
      const rows = normalizeSnapshotRows(views[key], key);
      if (rows.length) renderRows(container, rows, label);
      else if (data?.errors?.[key]) setBoardMessage(container, `Verified ${label} data is temporarily unavailable while the source is being refreshed.`, 'error');
      else setBoardMessage(container, 'No verified records are currently available.');
    });

    const stampValue = data.lastSuccessfulUpdate || data.updatedAt;
    const stamp = stampValue ? new Date(stampValue) : null;
    document.getElementById('dataUpdated').textContent = stamp && !Number.isNaN(stamp.getTime())
      ? stamp.toLocaleDateString(undefined, { day: '2-digit', month: 'short' })
      : 'Unavailable';
  } catch (error) {
    console.warn('Tournament snapshot is not available:', error);
    document.getElementById('dataUpdated').textContent = 'Unavailable';
    [pointsBoard, maximumBoard, eventsBoard, shieldBoard].forEach(el =>
      setBoardMessage(el, 'Tournament leaderboard data could not be loaded right now.', 'error')
    );
  }
}

Promise.allSettled([loadRatings(), loadTitles(), loadThijsBoards()]);
