const pages = [
  { slug: "index", label: "Home" },
  { slug: "rk-leaderboard", label: "Leaderboard" },
  { slug: "hall-of-fame", label: "Hall of Fame" },
  { slug: "title-system", label: "Title System" },
  { slug: "profile", label: "Profile" },
  { slug: "about", label: "About" }
];

(function () {
  const t = localStorage.getItem("rk-theme") || "dark";
  document.documentElement.setAttribute("data-theme", t);
})();

async function getSiteUser() {
  const sb = window.rkSupabase;
  if (!sb) return null;
  const { data: { session } } = await sb.auth.getSession();
  if (!session) return null;
  try {
    const res = await fetch("/api/auth/supabase-session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ access_token: session.access_token })
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data.user || null;
  } catch { return null; }
}

document.addEventListener("DOMContentLoaded", async () => {
  const menuPanel = document.getElementById("menuPanel");
  const menuBtn = document.getElementById("menuBtn");
  const navRight = document.querySelector(".nav-right");

  if (navRight) {
    const bellWrap = document.createElement("div");
    bellWrap.style.cssText = "position:relative;display:inline-flex;align-items:center";
    const bellBtn = document.createElement("button");
    bellBtn.className = "icon-btn";
    bellBtn.id = "notifBell";
    bellBtn.setAttribute("aria-label", "Notifications");
    bellBtn.innerHTML = "🔔";
    bellBtn.onclick = () => { window.location.href = "settings.html"; };
    const dot = document.createElement("span");
    dot.id = "notifDot";
    dot.style.cssText = "display:none;position:absolute;top:2px;right:2px;width:8px;height:8px;border-radius:50%;background:#ef4444;border:2px solid var(--bg);pointer-events:none;";
    bellWrap.appendChild(bellBtn); bellWrap.appendChild(dot);
    navRight.insertBefore(bellWrap, navRight.firstChild);
  }

  if (menuPanel) {
    pages.forEach(page => {
      const a = document.createElement("a");
      a.href = page.slug === "index" ? "index.html" : `${page.slug}.html`;
      a.textContent = page.label;
      menuPanel.appendChild(a);
    });
    const sep = document.createElement("div");
    sep.style.cssText = "height:1px;background:var(--border);margin:0.3rem 0.5rem";
    menuPanel.appendChild(sep);
    const authSlot = document.createElement("div");
    authSlot.id = "menuAuthSlot";
    menuPanel.appendChild(authSlot);
  }

  if (navRight) {
    const authBtn = document.createElement("button");
    authBtn.className = "icon-btn";
    authBtn.id = "navAuthBtn";
    authBtn.style.display = "none";
    const mBtn = navRight.querySelector("#menuBtn");
    navRight.insertBefore(authBtn, mBtn || null);
  }

  const user = await getSiteUser();
  const authSlot = document.getElementById("menuAuthSlot");
  const navAuthBtn = document.getElementById("navAuthBtn");

  if (!user) {
    if (navAuthBtn) {
      navAuthBtn.textContent = "Login";
      navAuthBtn.style.display = "";
      navAuthBtn.onclick = () => { window.location.href = "auth.html"; };
    }
    if (authSlot) {
      const a = document.createElement("a");
      a.href = "auth.html"; a.textContent = "Login / Register";
      authSlot.appendChild(a);
    }
  } else {
    if (navAuthBtn) {
      navAuthBtn.textContent = user.username;
      navAuthBtn.style.display = "";
      navAuthBtn.style.maxWidth = "120px";
      navAuthBtn.style.overflow = "hidden";
      navAuthBtn.style.textOverflow = "ellipsis";
      navAuthBtn.style.whiteSpace = "nowrap";
      navAuthBtn.onclick = () => { window.location.href = "settings.html"; };
    }
    if (authSlot) {
      if (user.is_admin) {
        const adminLink = document.createElement("a");
        adminLink.href = "admin.html";
        adminLink.textContent = "Admin Panel";
        adminLink.style.color = "var(--accent)";
        authSlot.appendChild(adminLink);
      }
      const chatLink = document.createElement("a");
      chatLink.href = "chat.html"; chatLink.textContent = "💬 Chat";
      authSlot.appendChild(chatLink);
      const settingsLink = document.createElement("a");
      settingsLink.href = "settings.html"; settingsLink.textContent = "⚙ Settings";
      authSlot.appendChild(settingsLink);
      const userLabel = document.createElement("div");
      userLabel.style.cssText = "padding:0.45rem 0.9rem;font-size:0.82rem;color:var(--text-muted)";
      userLabel.textContent = `Signed in as ${user.username}`;
      authSlot.appendChild(userLabel);
      const logoutBtn = document.createElement("button");
      logoutBtn.textContent = "Logout";
      logoutBtn.style.cssText = "display:block;width:calc(100% - 0.8rem);margin:0 0.4rem 0.2rem;padding:0.5rem 0.6rem;border-radius:8px;border:1px solid var(--border);background:transparent;color:var(--text-muted);font-size:0.85rem;font-family:inherit;cursor:pointer;text-align:left;";
      logoutBtn.onclick = async () => {
        if (window.rkSupabase) await window.rkSupabase.auth.signOut();
        await fetch("/api/auth/logout", { method: "POST" }).catch(() => {});
        window.location.reload();
      };
      authSlot.appendChild(logoutBtn);
    }
    pollNotifications();
  }

  if (menuBtn && menuPanel) menuBtn.addEventListener("click", () => menuPanel.classList.toggle("open"));
  document.addEventListener("click", e => {
    if (menuPanel && menuBtn && !menuPanel.contains(e.target) && !menuBtn.contains(e.target)) menuPanel.classList.remove("open");
  });
});

function pollNotifications() { fetchNotifCount(); setInterval(fetchNotifCount, 15000); }
async function fetchNotifCount() {
  try {
    const res = await fetch("/api/notifications/unread-count");
    if (!res.ok) return;
    const { count } = await res.json();
    const dot = document.getElementById("notifDot");
    if (dot) dot.style.display = count > 0 ? "block" : "none";
  } catch {}
}
