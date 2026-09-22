const SNAPSHOT_URL = 'json/lichess-team.json';

let snapshot = null;
let members = [];

const escapeHtml = value => {
  const div = document.createElement('div');
  div.textContent = value ?? '';
  return div.innerHTML;
};

const rating = user => {
  const value = Number(user?.perfs?.racingKings?.rating);
  return Number.isFinite(value) ? value : null;
};

function formatSnapshotTime(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
}

function updateStatistics() {
  const ratings = members.map(rating).filter(Number.isFinite);
  const memberCount = document.getElementById('memberCount');
  const rkRatedCount = document.getElementById('rkRatedCount');
  const averageRating = document.getElementById('averageRating');
  const highestRating = document.getElementById('highestRating');
  if (memberCount) memberCount.textContent = members.length.toLocaleString();
  if (rkRatedCount) rkRatedCount.textContent = ratings.length.toLocaleString();
  if (averageRating) averageRating.textContent = ratings.length
    ? Math.round(ratings.reduce((sum, value) => sum + value, 0) / ratings.length).toLocaleString()
    : '—';
  if (highestRating) highestRating.textContent = ratings.length ? Math.max(...ratings).toLocaleString() : '—';
}

function renderLeaders() {
  const container = document.getElementById('leadersList');
  if (!container) return;
  const leaders = Array.isArray(snapshot?.team?.leaders)
    ? [...new Set(snapshot.team.leaders.filter(Boolean).map(String))]
    : [];
  if (!leaders.length) {
    container.innerHTML = snapshot?.health === 'pending'
      ? '<div class="empty">Leadership data is waiting for the first automatic refresh.</div>'
      : '<div class="empty">No public leadership information is available.</div>';
    return;
  }
  container.innerHTML = leaders.map(name =>
    '<div class="leader-row">' +
    '<span class="leader-badge">Leader</span>' +
    '<a class="leader-name" href="https://lichess.org/@/' + encodeURIComponent(name) + '" target="_blank" rel="noopener">' +
    escapeHtml(name) + '</a></div>'
  ).join('');
}

function renderMembers() {
  const list = document.getElementById('membersList');
  const more = document.getElementById('membersMore');
  const searchInput = document.getElementById('memberSearch');
  const sortSelect = document.getElementById('memberSort');
  if (!list || !searchInput || !sortSelect) return;
  const query = searchInput.value.trim().toLowerCase();
  const sort = sortSelect.value;
  const filtered = members.filter(user =>
    String(user?.username || '').toLowerCase().includes(query)
  );
  filtered.sort((a, b) => {
    if (sort === 'name') return String(a.username || '').localeCompare(String(b.username || ''));
    if (sort === 'title') {
      return String(a.title || '').localeCompare(String(b.title || '')) ||
        String(a.username || '').localeCompare(String(b.username || ''));
    }
    return (rating(b) ?? -1) - (rating(a) ?? -1) ||
      String(a.username || '').localeCompare(String(b.username || ''));
  });
  if (!filtered.length) {
    const message = snapshot?.health === 'pending'
      ? 'Team member data is waiting for the first automatic refresh.'
      : query
        ? 'No members match that search.'
        : 'No team members are currently available.';
    list.innerHTML = '<div class="empty">' + escapeHtml(message) + '</div>';
  } else {
    list.innerHTML = filtered.map(user => {
      const username = String(user.username || 'Unknown');
      const currentRating = rating(user);
      const title = user.title ? String(user.title) : '';
      return '<a class="member-row" href="https://lichess.org/@/' + encodeURIComponent(username) + '" target="_blank" rel="noopener">' +
        '<span class="member-avatar">' + escapeHtml(username[0]?.toUpperCase() || '?') + '</span>' +
        '<span class="member-name">' + escapeHtml(username) + '</span>' +
        '<span class="member-title">' + escapeHtml(title || 'RK') + '</span>' +
        '<span class="member-rating">' + (currentRating != null ? currentRating.toLocaleString() : '—') + '</span>' +
        '</a>';
    }).join('');
  }
  if (more) {
    more.textContent = filtered.length.toLocaleString() +
      ' member' + (filtered.length === 1 ? '' : 's') + ' shown';
  }
}

function updateFreshnessLabel() {
  const label = document.getElementById('memberUpdated');
  if (!label) return;
  const time = formatSnapshotTime(snapshot?.lastSuccessfulUpdate || snapshot?.updatedAt);
  if (snapshot?.health === 'healthy' && time) {
    label.textContent = 'Updated ' + time;
    return;
  }
  if (snapshot?.health === 'pending') {
    label.textContent = 'Waiting for automatic refresh';
    return;
  }
  label.textContent = time
    ? 'Last successful update ' + time + ' · Refresh warning'
    : 'Automatic data unavailable';
}

function updateTeamHeader() {
  const name = document.getElementById('teamName');
  const description = document.getElementById('teamDescription');
  if (name && snapshot?.team?.name) name.textContent = snapshot.team.name;
  if (description && snapshot?.team?.description) description.textContent = snapshot.team.description;
}

async function loadTeamSnapshot() {
  const leaders = document.getElementById('leadersList');
  const membersList = document.getElementById('membersList');
  try {
    const response = await fetch(SNAPSHOT_URL, {
      cache: 'no-store',
      headers: { Accept: 'application/json' }
    });
    if (!response.ok) throw new Error('Team snapshot returned HTTP ' + response.status);
    snapshot = await response.json();
    if (!snapshot || !Array.isArray(snapshot.members)) throw new Error('Team snapshot is invalid.');
    members = snapshot.members;
    updateTeamHeader();
    updateStatistics();
    renderLeaders();
    renderMembers();
    updateFreshnessLabel();
  } catch (error) {
    console.error('Could not load automatic Lichess team snapshot:', error);
    if (leaders) leaders.innerHTML = '<div class="error-box">The automatic team snapshot could not be loaded right now.</div>';
    if (membersList) membersList.innerHTML = '<div class="error-box">Team member data is temporarily unavailable.</div>';
    const label = document.getElementById('memberUpdated');
    if (label) label.textContent = 'Snapshot unavailable';
  }
}

document.getElementById('memberSearch')?.addEventListener('input', renderMembers);
document.getElementById('memberSort')?.addEventListener('change', renderMembers);

loadTeamSnapshot();
