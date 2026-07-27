const leaderboard = document.getElementById("leaderboard");

const sortFilter = document.getElementById("sortFilter");
const titleFilter = document.getElementById("titleFilter");
const memberFilter = document.getElementById("memberFilter");

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

  if (membersOnly) {
    players = players.filter(p => p.member);
  }

  if (selectedTitle !== "ALL") {
    players = players.filter(
      player => playerHasTitle(player, selectedTitle)
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

  if (players.length === 0) {
    leaderboard.innerHTML = `<p class="empty-leaderboard">No players match the selected filters.</p>`;
    return;
  }

  players.forEach(player => {
    const card = document.createElement("div");
    card.className = "player-card";

    const bestMain = getBestMainTitle(player);
    const specials = getSpecialTitles(player);

    card.innerHTML = `
      <div class="player-top">
        <a class="username-link" href="profile.html?u=${encodeURIComponent(player.username)}" title="View ${escHtml(player.username)}'s profile">
          <span class="username">${escHtml(player.username)}</span>
        </a>
        ${player.member ? `<span class="member-badge">Member</span>` : ""}
        <button class="expand-btn" aria-expanded="false" aria-label="Show stats">
          <span class="expand-icon">▸</span>
        </button>
      </div>

      <div class="description">
        ${player.description || ""}
      </div>

      <div class="player-rating">
        Rating: ${player.rating ?? "N/A"}
      </div>
    `;

    const titleRow = document.createElement("div");
    titleRow.className = "title-row";

    if (bestMain) {
      titleRow.appendChild(createBadge(bestMain.code));
    }

    specials.forEach(t => {
      titleRow.appendChild(createBadge(t.code, true));
    });

    card.appendChild(titleRow);

    const dates = document.createElement("div");
    dates.className = "date-list";
    dates.innerHTML = player.titles
      .map(t => `<div>${t.code}: ${t.date}</div>`)
      .join("");
    card.appendChild(dates);

    const statsPanel = document.createElement("div");
    statsPanel.className = "stats-panel";
    statsPanel.hidden = true;
    card.appendChild(statsPanel);

    const expandBtn = card.querySelector(".expand-btn");

    expandBtn.addEventListener("click", () => {
      const isOpen = !statsPanel.hidden;
      if (isOpen) {
        statsPanel.hidden = true;
        expandBtn.setAttribute("aria-expanded", "false");
        expandBtn.querySelector(".expand-icon").textContent = "▸";
      } else {
        statsPanel.hidden = false;
        expandBtn.setAttribute("aria-expanded", "true");
        expandBtn.querySelector(".expand-icon").textContent = "▾";
        loadProfileStats(player.username, statsPanel, player.member);
      }
    });

    leaderboard.appendChild(card);
  });
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

loadPlayers();
