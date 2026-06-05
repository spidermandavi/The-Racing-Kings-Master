const leaderboard = document.getElementById("leaderboard");
const menuPanel = document.getElementById("menuPanel");

const sortFilter = document.getElementById("sortFilter");
const titleFilter = document.getElementById("titleFilter");

const pages = [
  "index",
  "players",
  "profile",
  "search",
  "titles",
  "about",
  "leaderboard"
];

pages.forEach(page => {
  const link = document.createElement("a");

  link.href = `${page}.html`;

  link.textContent =
    page.charAt(0).toUpperCase() +
    page.slice(1);

  menuPanel.appendChild(link);
});

document
  .getElementById("menuBtn")
  .addEventListener("click", () => {
    menuPanel.classList.toggle("open");
  });

document
  .getElementById("backBtn")
  .addEventListener("click", () => history.back());

document
  .getElementById("forwardBtn")
  .addEventListener("click", () => history.forward());

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

    return (
      data?.perfs?.rapid?.rating ||
      data?.perfs?.blitz?.rating ||
      data?.perfs?.bullet?.rating ||
      0
    );
  } catch {
    return null;
  }
}

async function loadPlayers() {
  const res = await fetch(
    "players.json"
  );

  const players =
    await res.json();

  leaderboard.innerHTML =
    "<p>Loading ratings...</p>";

  await Promise.all(
    players.map(async player => {
      player.rating =
        await fetchRating(
          player.username
        );
    })
  );

  allPlayers = players;

  renderLeaderboard();
}

function renderLeaderboard() {
  let players = [...allPlayers];

  const selectedTitle =
    titleFilter.value;

  const sortType =
    sortFilter.value;

  if (
    selectedTitle !== "ALL"
  ) {
    players = players.filter(
      player =>
        playerHasTitle(
          player,
          selectedTitle
        )
    );
  }

  if (sortType === "rating") {
    players.sort((a, b) => {
      return (
        (b.rating || 0) -
        (a.rating || 0)
      );
    });
  } else {
    players.sort((a, b) => {
      return (
        getTitleRank(b) -
        getTitleRank(a)
      );
    });
  }

  leaderboard.innerHTML = "";

  players.forEach(player => {
    const card =
      document.createElement(
        "div"
      );

    card.className =
      "player-card";

    const bestMain =
      getBestMainTitle(player);

    const specials =
      getSpecialTitles(player);

    card.innerHTML = `
      <div class="player-top">
        <div class="username">
          ${player.username}
        </div>
      </div>

      <div class="description">
        ${player.description || ""}
      </div>

      <div class="player-rating">
        Rating: ${
          player.rating ??
          "N/A"
        }
      </div>
    `;

    const titleRow =
      document.createElement(
        "div"
      );

    titleRow.className =
      "title-row";

    if (bestMain) {
      titleRow.appendChild(
        createBadge(
          bestMain.code
        )
      );
    }

    specials.forEach(t => {
      titleRow.appendChild(
        createBadge(
          t.code,
          true
        )
      );
    });

    card.appendChild(
      titleRow
    );

    const dates =
      document.createElement(
        "div"
      );

    dates.className =
      "date-list";

    dates.innerHTML =
      player.titles
        .map(
          t => `
        <div>
          ${t.code}: ${t.date}
        </div>
      `
        )
        .join("");

    card.appendChild(
      dates
    );

    leaderboard.appendChild(
      card
    );
  });
}

sortFilter.addEventListener(
  "change",
  renderLeaderboard
);

titleFilter.addEventListener(
  "change",
  renderLeaderboard
);

loadPlayers();
