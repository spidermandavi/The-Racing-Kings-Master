const leaderboard = document.getElementById("leaderboard");

const sortFilter = document.getElementById("sortFilter");
const titleFilter = document.getElementById("titleFilter");
const memberFilter = document.getElementById("memberFilter");
const playerSearch = document.getElementById("playerSearch");
const leaderboardSummary = document.getElementById("leaderboardSummary");

const titlePriority = {
  RKSGM: 5,
  RKGM: 4,
  RKIM: 3,
  RKM: 2,
  RKCM: 1
};

const specialTitles = [
  "RKWC",
  "RKV",
  "RKHM"
];

const titleClassMap = {
  RKSGM: "elite",
  RKGM: "grand",
  RKIM: "master",
  RKM: "candidate",
  RKCM: "candidate-light",
  RKWC: "elite"
};

let allPlayers = [];

function normalizeTitle(title) {
  return String(title || "")
    .trim()
    .toUpperCase();
}

function getMainTitles(player) {
  return player.titles.filter(
    t =>
      !specialTitles.includes(
        normalizeTitle(t.code)
      )
  );
}

function getSpecialTitles(player) {
  return player.titles.filter(
    t =>
      specialTitles.includes(
        normalizeTitle(t.code)
      )
  );
}

function getBestMainTitle(player) {
  const mains = getMainTitles(player);

  if (!mains.length) return null;

  return mains.sort((a, b) => {
    return (
      (titlePriority[b.code] || 0) -
      (titlePriority[a.code] || 0)
    );
  })[0];
}

function getTitleRank(player) {
  const best =
    getBestMainTitle(player);

  return titlePriority[
    best?.code
  ] || 0;
}

function playerHasTitle(
  player,
  titleCode
) {
  return player.titles.some(
    t =>
      normalizeTitle(t.code) ===
      titleCode
  );
}

function createBadge(
  titleCode,
  special = false
) {
  const badge =
    document.createElement("div");

  badge.className =
    `title-badge ${
      special
        ? "special"
        : titleClassMap[
            titleCode
          ] || ""
    }`;

  badge.textContent = titleCode;

  return badge;
}

async function fetchRating(
  username
) {
  try {
    const response = await fetch(
      `https://lichess.org/api/user/${username}`
    );

    if (!response.ok)
      return null;

    const data =
      await response.json();

    return data?.perfs?.racingKings?.rating || 0;
  } catch {
    return null;
  }
}

async function loadPlayers() {
  leaderboard.innerHTML =
    "<p>Loading players and ratings...</p>";

  // Fetch titled players and registered members in parallel
  const [playersRes, membersRes] = await Promise.all([
    fetch("players.json"),
    fetch("/api/members").catch(() => ({ ok: false }))
  ]);

  const titledPlayers = playersRes.ok ? await playersRes.json() : [];
  const members = membersRes.ok ? await membersRes.json() : [];

  // Merge titled players and registered members by username
  const byUsername = new Map();

  titledPlayers.forEach(player => {
    byUsername.set(player.username.toLowerCase(), {
      ...player,
      member: false
    });
  });

  members.forEach(member => {
    const key = member.username.toLowerCase();
    if (byUsername.has(key)) {
      byUsername.get(key).member = true;
    } else {
      byUsername.set(key, {
        id: member.id,
        username: member.username,
        description: "",
        titles: [],
        member: true
      });
    }
  });

  const players = Array.from(byUsername.values());

  await Promise.all(
    players.map(async player => {
      player.rating = await fetchRating(player.username);
    })
  );

  allPlayers = players;

  renderLeaderboard();
}

function renderLeaderboard() {
  let players = [...allPlayers];

  const selectedTitle = titleFilter.value;
  const sortType = sortFilter.value;
  const membersOnly = memberFilter && memberFilter.checked;
  const search = playerSearch ? playerSearch.value.trim().toLowerCase() : "";

  if (membersOnly) {
    players = players.filter(p => p.member);
  }

  if (selectedTitle !== "ALL") {
    players = players.filter(
      player => playerHasTitle(player, selectedTitle)
    );
  }

  if (search) {
    players = players.filter(player =>
      player.username.toLowerCase().includes(search)
    );
  }

  const aRank = p => getTitleRank(p) || (p.member ? -1 : 0);
  const aRating = p => p.rating || 0;

  if (sortType === "rating") {
    players.sort((a, b) => {
      if (aRating(b) !== aRating(a)) return aRating(b) - aRating(a);
      return aRank(b) - aRank(a);
    });
  } else {
    players.sort((a, b) => {
      if (aRank(b) !== aRank(a)) return aRank(b) - aRank(a);
      return aRating(b) - aRating(a);
    });
  }

  leaderboard.innerHTML = "";
  renderSummary(players);

  if (players.length === 0) {
    leaderboard.innerHTML = `<p class="empty-leaderboard">No players match the selected filters.</p>`;
    return;
  }

  const podium = document.createElement("section");
  podium.className = "podium";
  podium.setAttribute("aria-label", "Top three players");
  players.slice(0, 3).forEach((player, index) => podium.appendChild(createPodiumCard(player, index)));
  leaderboard.appendChild(podium);

  const table = document.createElement("section");
  table.className = "ranking-table-wrap";
  table.innerHTML = `
    <div class="ranking-table-header">
      <span>RANK</span><span>PLAYER</span><span>RATING</span><span>TITLES</span><span></span>
    </div>
    <div class="ranking-table" role="list"></div>
  `;
  const rows = table.querySelector(".ranking-table");
  players.slice(3).forEach((player, index) => rows.appendChild(createRankingRow(player, index + 3)));
  leaderboard.appendChild(table);
}

function renderSummary(players) {
  if (!leaderboardSummary) return;
  const titled = players.filter(p => p.titles.length).length;
  const members = players.filter(p => p.member).length;
  leaderboardSummary.innerHTML = `
    <div><strong>${players.length}</strong><span>players</span></div>
    <div><strong>${titled}</strong><span>titled</span></div>
    <div><strong>${members}</strong><span>members</span></div>
  `;
}

function playerBadges(player) {
  const badges = [];
  const bestMain = getBestMainTitle(player);
  if (bestMain) badges.push(`<span class="title-badge ${titleClassMap[bestMain.code] || ""}">${escHtml(bestMain.code)}</span>`);
  getSpecialTitles(player).forEach(t => badges.push(`<span class="title-badge special">${escHtml(t.code)}</span>`));
  return badges.join("");
}

function createPodiumCard(player, index) {
  const card = document.createElement("article");
  card.className = `podium-card podium-${index + 1}`;
  card.innerHTML = `
    <div class="podium-rank">#${index + 1}</div>
    <div class="podium-medal">${index === 0 ? "♛" : index === 1 ? "◇" : "△"}</div>
    <a class="username-link" href="profile.html?u=${encodeURIComponent(player.username)}">
      <span class="username">${escHtml(player.username)}</span>
    </a>
    ${player.member ? `<span class="member-badge">Member</span>` : ""}
    <div class="podium-badges">${playerBadges(player)}</div>
    <strong class="podium-rating">${player.rating ?? "N/A"}</strong>
    <span class="podium-label">RATING</span>
    <div class="podium-actions">
      <a class="profile-button" href="profile.html?u=${encodeURIComponent(player.username)}">Profile</a>
      <a class="external-button" href="https://lichess.org/@/${encodeURIComponent(player.username)}" target="_blank" rel="noopener noreferrer" aria-label="Open ${escHtml(player.username)} on Lichess">↗</a>
    </div>
  `;
  return card;
}

function createRankingRow(player, index) {
  const row = document.createElement("article");
  row.className = "ranking-row";
  row.setAttribute("role", "listitem");
  row.innerHTML = `
    <div class="rank-number">#${index + 1}</div>
    <div class="row-player">
      <div class="avatar">${escHtml(player.username.charAt(0).toUpperCase())}</div>
      <div class="row-player-info">
        <a class="username-link" href="profile.html?u=${encodeURIComponent(player.username)}"><span class="username">${escHtml(player.username)}</span></a>
        <div class="row-meta">${player.member ? `<span class="member-status">● Member</span>` : `<span>Registered player</span>`}${player.titles.length ? ` · ${player.titles.length} title${player.titles.length === 1 ? "" : "s"}` : ""}</div>
      </div>
    </div>
    <div class="row-rating"><strong>${player.rating ?? "N/A"}</strong><span class="rating-bar"><i style="width:${Math.min(100, Math.max(8, ((player.rating || 0) - 1000) / 14))}%"></i></span></div>
    <div class="row-titles">${playerBadges(player) || '<span class="no-title">—</span>'}</div>
    <div class="row-actions">
      <a class="profile-button" href="profile.html?u=${encodeURIComponent(player.username)}">Profile</a>
      <button class="expand-btn" aria-expanded="false" aria-label="Show stats for ${escHtml(player.username)}"><span class="expand-icon">⌄</span></button>
    </div>
  `;
  const statsPanel = document.createElement("div");
  statsPanel.className = "stats-panel";
  statsPanel.hidden = true;
  row.appendChild(statsPanel);
  const expandBtn = row.querySelector(".expand-btn");
  expandBtn.addEventListener("click", () => {
    const open = !statsPanel.hidden;
    statsPanel.hidden = open;
    expandBtn.setAttribute("aria-expanded", String(!open));
    if (!open) loadProfileStats(player.username, statsPanel, player.member);
  });
  return row;
}

function escHtml(text) {
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}

const profileCache = {};

async function loadProfileStats(username, panel, isMember = false) {
  if (profileCache[username]) {
    renderProfileStats(profileCache[username], panel, isMember);
    return;
  }

  panel.innerHTML = `<div class="stats-loading">Loading stats…</div>`;

  try {
    const [userRes, perfRes] = await Promise.all([
      fetch(`https://lichess.org/api/user/${encodeURIComponent(username)}`),
      fetch(`https://lichess.org/api/user/${encodeURIComponent(username)}/perf/racingKings`)
    ]);

    const user = userRes.ok ? await userRes.json() : null;
    const perf = perfRes.ok ? await perfRes.json() : null;

    const data = { user, perf };
    profileCache[username] = data;
    renderProfileStats(data, panel, isMember);
  } catch {
    panel.innerHTML = `<div class="stats-error">Could not load profile data.</div>`;
  }
}

function renderProfileStats({ user, perf }, panel, isMember = false) {
  if (!user) {
    panel.innerHTML = `<div class="stats-error">Player not found on Lichess.</div>`;
    return;
  }

  const rk = user.perfs?.racingKings || {};
  const perfStat = perf?.stat || {};
  const count = perfStat.count || {};

  const currentRating = rk.rating ?? "N/A";
  const highest = perfStat.highest?.int ?? rk.rating ?? "N/A";
  const games = count.all ?? rk.games ?? "N/A";
  const wins = count.win ?? "N/A";
  const losses = count.loss ?? "N/A";
  const winRate = (count.all && count.win != null)
    ? ((count.win / count.all) * 100).toFixed(1) + "%"
    : "N/A";

  const lichessTitle = user.title ? `<span class="lichess-title">${user.title}</span> ` : "";
  const country = user.profile?.country
    ? `<span class="stat-flag">${getFlagEmoji(user.profile.country)}</span> ` : "";
  const memberSince = user.createdAt
    ? new Date(user.createdAt).getFullYear()
    : "N/A";
  const streak = perfStat.currentResultStreak?.wins?.v
    || perfStat.maxResultStreak?.wins?.v
    || null;

  panel.innerHTML = `
    <div class="stats-header">
      ${country}${lichessTitle}
      <div class="stats-header-actions">
        <a class="stats-profile-link"
           href="profile.html?u=${encodeURIComponent(user.username || user.id)}">
          View full profile →
        </a>
        <a class="stats-lichess-link"
           href="https://lichess.org/@/${encodeURIComponent(user.username || user.id)}"
           target="_blank" rel="noopener noreferrer">
          View on Lichess ↗
        </a>
      </div>
    </div>
    <div class="stats-grid">
      <div class="stat-item">
        <span class="stat-label">Current Rating</span>
        <span class="stat-value">${currentRating}</span>
      </div>
      <div class="stat-item">
        <span class="stat-label">Peak Rating</span>
        <span class="stat-value">${highest}</span>
      </div>
      <div class="stat-item">
        <span class="stat-label">Total Games</span>
        <span class="stat-value">${games}</span>
      </div>
      <div class="stat-item">
        <span class="stat-label">Wins</span>
        <span class="stat-value">${wins}</span>
      </div>
      <div class="stat-item">
        <span class="stat-label">Losses</span>
        <span class="stat-value">${losses}</span>
      </div>
      <div class="stat-item">
        <span class="stat-label">Win Rate</span>
        <span class="stat-value">${winRate}</span>
      </div>
      <div class="stat-item">
        <span class="stat-label">Member Since</span>
        <span class="stat-value">${memberSince}</span>
      </div>
      ${streak != null ? `
      <div class="stat-item">
        <span class="stat-label">Best Win Streak</span>
        <span class="stat-value">${streak}</span>
      </div>` : ""}
    </div>
  `;
}

function getFlagEmoji(countryCode) {
  if (!countryCode || countryCode.length !== 2) return "";
  return countryCode
    .toUpperCase()
    .split("")
    .map(c => String.fromCodePoint(0x1F1E6 + c.charCodeAt(0) - 65))
    .join("");
}

sortFilter.addEventListener(
  "change",
  renderLeaderboard
);

titleFilter.addEventListener(
  "change",
  renderLeaderboard
);

memberFilter.addEventListener(
  "change",
  renderLeaderboard
);

playerSearch.addEventListener("input", renderLeaderboard);

loadPlayers();
