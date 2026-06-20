const pages = [
  { slug: "index", label: "Home" },
  { slug: "players", label: "Players" },
  { slug: "leaderboard", label: "Leaderboard" },
  { slug: "profile", label: "Profile" },
  { slug: "search", label: "Title Checker" },
  { slug: "titles", label: "Titles" },
  { slug: "about", label: "About" }
];

function applyTheme(theme) {
  document.documentElement.setAttribute("data-theme", theme);
  const btn = document.getElementById("themeToggle");
  if (btn) btn.textContent = theme === "light" ? "☽" : "☀";
}

document.addEventListener("DOMContentLoaded", () => {
  const menuPanel = document.getElementById("menuPanel");
  const menuBtn = document.getElementById("menuBtn");
  const backBtn = document.getElementById("backBtn");
  const forwardBtn = document.getElementById("forwardBtn");
  const navRight = document.querySelector(".nav-right");

  const savedTheme = localStorage.getItem("rk-theme") || "dark";
  applyTheme(savedTheme);

  if (navRight) {
    const themeBtn = document.createElement("button");
    themeBtn.className = "icon-btn";
    themeBtn.id = "themeToggle";
    themeBtn.setAttribute("aria-label", "Toggle light/dark mode");
    themeBtn.textContent = savedTheme === "light" ? "☽" : "☀";

    navRight.insertBefore(themeBtn, navRight.firstChild);

    themeBtn.addEventListener("click", () => {
      const current = document.documentElement.getAttribute("data-theme") || "dark";
      const next = current === "dark" ? "light" : "dark";
      localStorage.setItem("rk-theme", next);
      applyTheme(next);
    });
  }

  if (menuPanel) {
    pages.forEach(page => {
      const link = document.createElement("a");
      link.href = page.slug === "index" ? "index.html" : `${page.slug}.html`;
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
