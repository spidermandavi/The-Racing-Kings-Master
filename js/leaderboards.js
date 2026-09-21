/* ============================================================
   LEADERBOARDS DATA LAYER
   - Cached Racing Kings top 20 snapshot refreshed by GitHub Actions
   - Official title holders from Supabase
   - Historical tournament records from the generated Thijs snapshot
   ============================================================ */

const TOP_PLAYERS_DATA_URL = 'json/lichess-top-players.json';
const THIJS_DATA_URL = 'json/thijs-leaderboards.json';
const PEAK_RATING_DATA_URL = 'json/peak-lichess-ratings.json';
const TOP_RATING_URL = 'https://lichess.org/player/top/racingKings';

const ratingBoard = document.getElementById('ratingBoard');
const titlesBoard = document.getElementById('titlesBoard');
const pointsBoard = document.getElementById('pointsBoard');
const maximumBoard = document.getElementById('maximumBoard');
const eventsBoard = document.getElementById('eventsBoard');
const shieldBoard = document.getElementById('shieldBoard');
const peakBoard = document.getElementById('peakBoard');
const victoriesBoard = document.getElementById('victoriesBoard');

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

function renderRows(container, rows, metricLabel) {
  if (!container) return;

  if (!rows?.length) {
    container.innerHTML = '<div class="empty-board">No verified records are currently available.</div>';
    return;
  }

  container.innerHTML = rows.slice(0, 20).map((row, index) => {
    const username = row.username || row.name || row.player || 'Unknown';
    const value = row.value;
    const meta = row.meta || '';
    const title = row.title
      ? `<span class="mini-title">${escapeHtml(row.title)}</span>`
      : '';

    return `
      <div class="rank-row">
        <div class="rank ${index < 3 ? 'top' : ''}">${index + 1}</div>
        <div class="player">
          <div class="player-name">
            <a href="${playerLink(username)}" target="_blank" rel="noopener noreferrer">${escapeHtml(username)}</a>
            ${title}
          </div>
          ${meta !== '' ? `<div class="player-meta">${escapeHtml(meta)}</div>` : ''}
        </div>
        <div class="metric">
          ${formatNumber(value)}
          <small>${escapeHtml(metricLabel)}</small>
        </div>
      </div>`;
  }).join('');
}

function setBoardMessage(container, message, type = 'empty-board') {
  if (container) container.innerHTML = `<div class="${type}">${escapeHtml(message)}</div>`;
}

async function loadRatings() {
  try {
    const response = await fetch(TOP_PLAYERS_DATA_URL, {
      headers: { Accept: 'application/json' },
      cache: 'no-store'
    });

    if (!response.ok) throw new Error(`Top-player snapshot returned ${response.status}`);

    const data = await response.json();
    const players = Array.isArray(data?.players) ? data.players.slice(0, 20) : [];

    if (!players.length) throw new Error('Top-player snapshot is empty');

    document.getElementById('ratingCount').textContent = `Top ${players.length}`;

    renderRows(
      ratingBoard,
      players.map(player => ({
        username: player.username || player.id,
        title: player.title || '',
        value: player?.perfs?.racingKings?.rating,
        meta: [
          player?.rkPerfCount?.all != null ? `${Number(player.rkPerfCount.all).toLocaleString()} games` : '',
          player.health
        ].filter(Boolean).join(' · ')
      })),
      'rating'
    );

    const link = document.querySelector('[data-board="rating"] .board-link');
    if (link) {
      link.innerHTML = `<a href="${TOP_RATING_URL}" target="_blank" rel="noopener noreferrer">View Lichess leaderboard ↗</a>`;
    }
  } catch (error) {
    console.error('Could not load cached Lichess Racing Kings leaderboard:', error);
    // Keep the server-rendered snapshot visible when the enhancement request fails.
    console.warn('Keeping the server-rendered Racing Kings snapshot visible.');
  }
}

async function loadTitles() {
  try {
    if (!window.rkSupabase) throw new Error('Supabase client is not available');

    const [profilesResponse, titlesResponse] = await Promise.all([
      window.rkSupabase.from('profiles').select('id,username'),
      window.rkSupabase.from('titles').select('user_id,title,awarded_at').order('awarded_at', { ascending: true })
    ]);

    if (profilesResponse.error) throw profilesResponse.error;
    if (titlesResponse.error) throw titlesResponse.error;

    const byId = new Map((profilesResponse.data || []).map(profile => [
      profile.id,
      { username: profile.username, titles: [] }
    ]));

    (titlesResponse.data || []).forEach(record => {
      const player = byId.get(record.user_id);
      if (!player || !record.title) return;
      player.titles.push({
        code: String(record.title).trim().toUpperCase(),
        awardedAt: record.awarded_at
      });
    });

    const holders = [...byId.values()]
      .filter(player => player.titles.length > 0)
      .sort((a, b) =>
        b.titles.length - a.titles.length ||
        String(a.username || '').localeCompare(String(b.username || ''))
      );

    document.getElementById('titleCount').textContent = holders.length;

    renderRows(
      titlesBoard,
      holders.map(player => ({
        username: player.username,
        value: player.titles.length,
        meta: [...new Set(player.titles.map(title => title.code))].join(' · ')
      })),
      'titles'
    );
  } catch (error) {
    console.error('Could not load title holders from Supabase:', error);
    document.getElementById('titleCount').textContent = '0';
    // The page contains a safe empty-state fallback for title data.
  }
}

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
    Number.isFinite(Number(row.value)) &&
    (metric !== 'trophies' || /gold.*silver.*bronze/i.test(row.meta))
  ).sort((a, b) => Number(b.value) - Number(a.value));
}

async function loadPeakRatings() {
  try {
    const response = await fetch(PEAK_RATING_DATA_URL, {
      headers: { Accept: 'application/json' },
      cache: 'no-store'
    });

    if (!response.ok) throw new Error(`Peak-rating snapshot returned ${response.status}`);

    const data = await response.json();
    const players = Array.isArray(data?.players) ? data.players.slice(0, 20) : [];

    if (!players.length) throw new Error('Peak-rating snapshot is empty');

    renderRows(
      peakBoard,
      players.map(player => ({
        username: player.username,
        value: player.peakRating,
        meta: 'Google Sheets'
      })),
      'peak rating'
    );

    const link = document.querySelector('[data-board="peak"] .board-link');
    if (link) {
      const sourceUrl = data.spreadsheetUrl || 'https://docs.google.com/spreadsheets/d/1HFcPCSp_31L8KgwjkNeyHHDwNMJ7gdB_fk6LU1z608o/edit';
      link.innerHTML = `<a href="${sourceUrl}" target="_blank" rel="noopener noreferrer">Google Sheets ↗</a>`;
    }
  } catch (error) {
    console.warn('Peak Lichess rating snapshot is not available:', error);
    if (peakBoard) {
      setBoardMessage(peakBoard, 'Peak-rating data is waiting for the first successful Google Sheets refresh.', 'error');
    }
  }
}

async function loadThijsBoards() {
  try {
    const response = await fetch(THIJS_DATA_URL, {
      headers: { Accept: 'application/json' },
      cache: 'no-store'
    });

    if (!response.ok) throw new Error(`Tournament snapshot returned ${response.status}`);

    const data = await response.json();
    const views = data?.views || {};

    const boards = [
      { key: 'points', container: pointsBoard, label: 'points' },
      { key: 'victories', container: victoriesBoard, label: 'wins' },
      { key: 'maximum', container: maximumBoard, label: 'score' },
      { key: 'events', container: eventsBoard, label: 'events' },
      { key: 'trophies', container: shieldBoard, label: 'trophies' }
    ];

    boards.forEach(({ key, container, label }) => {
      const rows = normalizeSnapshotRows(views[key], key);

      if (rows.length) {
        renderRows(container, rows, label);
      } else if (data?.errors?.[key]) {
        setBoardMessage(
          container,
          `Verified ${label} data is temporarily unavailable while the source is being refreshed.`,
          'error'
        );
      } else {
        setBoardMessage(container, 'No verified records are currently available.');
      }
    });

    const stampValue = data.lastSuccessfulUpdate || data.updatedAt;
    const stamp = stampValue ? new Date(stampValue) : null;

    document.getElementById('dataUpdated').textContent =
      stamp && !Number.isNaN(stamp.getTime())
        ? stamp.toLocaleDateString(undefined, { day: '2-digit', month: 'short' })
        : 'Unavailable';
  } catch (error) {
    console.warn('Tournament snapshot is not available:', error);
    // Keep the server-rendered tournament snapshot visible when enhancement fails.
    console.warn('Keeping the server-rendered tournament snapshot visible.');
  }
}

Promise.allSettled([
  loadRatings(),
  loadTitles(),
  loadPeakRatings(),
  loadThijsBoards()
]);