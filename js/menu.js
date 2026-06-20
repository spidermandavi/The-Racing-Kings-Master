const pages = [
  { slug: "index", label: "Home" },
  { slug: "players", label: "Players" },
  { slug: "leaderboard", label: "Leaderboard" },
  { slug: "profile", label: "Profile" },
  { slug: "search", label: "Search" },
  { slug: "titles", label: "Titles" },
  { slug: "about", label: "About" }
];

document.addEventListener("DOMContentLoaded", () => {
  const menuPanel = document.getElementById("menuPanel");
  const menuBtn = document.getElementById("menuBtn");
  const backBtn = document.getElementById("backBtn");
  const forwardBtn = document.getElementById("forwardBtn");

  if (menuPanel) {
    pages.forEach(page => {
      const link = document.createElement("a");

      link.href =
        page.slug === "index"
          ? "index.html"
          : `${page.slug}.html`;

      link.textContent = page.label;

      menuPanel.appendChild(link);
    });
  }

  if (menuBtn && menuPanel) {
    menuBtn.addEventListener("click", () => {
      menuPanel.classList.toggle("open");
    });
  }

  if (backBtn) {
    backBtn.addEventListener("click", () => {
      history.back();
    });
  }

  if (forwardBtn) {
    forwardBtn.addEventListener("click", () => {
      history.forward();
    });
  }
  document.addEventListener("click", (e) => {
    if (
      menuPanel &&
      menuBtn &&
      !menuPanel.contains(e.target) &&
      !menuBtn.contains(e.target)
    ) {
      menuPanel.classList.remove("open");
    }
  });
});
