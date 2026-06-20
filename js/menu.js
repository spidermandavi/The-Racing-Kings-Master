const pages = [
  { slug: "index",      label: "Home" },
  { slug: "players",    label: "Players" },
  { slug: "leaderboard",label: "Leaderboard" },
  { slug: "profile",    label: "Profile" },
  { slug: "search",     label: "Title Checker" },
  { slug: "titles",     label: "Titles" },
  { slug: "about",      label: "About" }
];

function applyTheme(theme) {
  document.documentElement.setAttribute("data-theme", theme);
  const btn = document.getElementById("themeToggle");
  if (btn) btn.textContent = theme === "light" ? "☽" : "☀";
}

document.addEventListener("DOMContentLoaded", () => {
  const menuPanel  = document.getElementById("menuPanel");
  const menuBtn    = document.getElementById("menuBtn");
  const backBtn    = document.getElementById("backBtn");
  const forwardBtn = document.getElementById("forwardBtn");
  const navRight   = document.querySelector(".nav-right");

  // ── Theme toggle ────────────────────────────────────────────────────────
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
      const next = (document.documentElement.getAttribute("data-theme") || "dark") === "dark"
        ? "light" : "dark";
      localStorage.setItem("rk-theme", next);
      applyTheme(next);
    });
  }

  // ── Build menu links ─────────────────────────────────────────────────────
  if (menuPanel) {
    pages.forEach(page => {
      const a = document.createElement("a");
      a.href = page.slug === "index" ? "index.html" : `${page.slug}.html`;
      a.textContent = page.label;
      menuPanel.appendChild(a);
    });

    // Separator
    const sep = document.createElement("div");
    sep.style.cssText = "height:1px;background:var(--border);margin:0.3rem 0.5rem";
    menuPanel.appendChild(sep);

    // Auth placeholder — filled in after fetch
    const authSlot = document.createElement("div");
    authSlot.id = "menuAuthSlot";
    menuPanel.appendChild(authSlot);
  }

  // ── Nav auth button (Login / username) ──────────────────────────────────
  if (navRight) {
    const authBtn = document.createElement("button");
    authBtn.className = "icon-btn";
    authBtn.id = "navAuthBtn";
    authBtn.style.display = "none";
    navRight.insertBefore(authBtn, menuBtn);
    navRight.insertBefore(authBtn, navRight.querySelector("#menuBtn") || navRight.firstChild);
  }

  // ── Fetch current user and populate auth UI ──────────────────────────────
  fetch("/api/auth/me")
    .then(r => r.json())
    .then(({ user }) => {
      const authSlot = document.getElementById("menuAuthSlot");
      const navAuthBtn = document.getElementById("navAuthBtn");

      if (!user) {
        // Not logged in
        if (navAuthBtn) {
          navAuthBtn.textContent = "Login";
          navAuthBtn.style.display = "";
          navAuthBtn.onclick = () => { window.location.href = "auth.html"; };
        }
        if (authSlot) {
          const a = document.createElement("a");
          a.href = "auth.html";
          a.textContent = "Login / Register";
          authSlot.appendChild(a);
        }
      } else {
        // Logged in
        if (navAuthBtn) {
          navAuthBtn.textContent = user.username;
          navAuthBtn.style.display = "";
          navAuthBtn.style.maxWidth = "120px";
          navAuthBtn.style.overflow = "hidden";
          navAuthBtn.style.textOverflow = "ellipsis";
          navAuthBtn.style.whiteSpace = "nowrap";
          navAuthBtn.onclick = () => {
            window.location.href = user.is_admin ? "admin.html" : "auth.html";
          };
        }
        if (authSlot) {
          if (user.is_admin) {
            const admin = document.createElement("a");
            admin.href = "admin.html";
            admin.textContent = "Admin Panel";
            admin.style.color = "var(--accent)";
            authSlot.appendChild(admin);
          }
          const userLabel = document.createElement("div");
          userLabel.style.cssText = "padding:0.45rem 0.9rem;font-size:0.82rem;color:var(--text-muted)";
          userLabel.textContent = `Signed in as ${user.username}`;
          authSlot.appendChild(userLabel);

          const logoutBtn = document.createElement("button");
          logoutBtn.textContent = "Logout";
          logoutBtn.style.cssText = `
            display:block;width:calc(100% - 0.8rem);margin:0 0.4rem 0.2rem;
            padding:0.5rem 0.6rem;border-radius:8px;border:1px solid var(--border);
            background:transparent;color:var(--text-muted);font-size:0.85rem;
            font-family:inherit;cursor:pointer;text-align:left;
            transition:background 0.15s,color 0.15s;
          `;
          logoutBtn.onmouseover = () => { logoutBtn.style.background = "rgba(248,113,113,0.08)"; logoutBtn.style.color = "#f87171"; };
          logoutBtn.onmouseout  = () => { logoutBtn.style.background = "transparent"; logoutBtn.style.color = "var(--text-muted)"; };
          logoutBtn.onclick = async () => {
            await fetch("/api/auth/logout", { method: "POST" });
            window.location.reload();
          };
          authSlot.appendChild(logoutBtn);
        }
      }
    })
    .catch(() => {
      // Server likely static (no Flask) — fall back to showing login link
      const authSlot = document.getElementById("menuAuthSlot");
      const navAuthBtn = document.getElementById("navAuthBtn");
      if (navAuthBtn) {
        navAuthBtn.textContent = "Login";
        navAuthBtn.style.display = "";
        navAuthBtn.onclick = () => { window.location.href = "auth.html"; };
      }
      if (authSlot) {
        const a = document.createElement("a");
        a.href = "auth.html";
        a.textContent = "Login / Register";
        authSlot.appendChild(a);
      }
    });

  // ── Menu open / close ────────────────────────────────────────────────────
  if (menuBtn && menuPanel) {
    menuBtn.addEventListener("click", () => menuPanel.classList.toggle("open"));
  }

  document.addEventListener("click", e => {
    if (menuPanel && menuBtn && !menuPanel.contains(e.target) && !menuBtn.contains(e.target)) {
      menuPanel.classList.remove("open");
    }
  });

  // ── Back / Forward ───────────────────────────────────────────────────────
  if (backBtn)    backBtn.addEventListener("click", () => history.back());
  if (forwardBtn) forwardBtn.addEventListener("click", () => history.forward());
});
