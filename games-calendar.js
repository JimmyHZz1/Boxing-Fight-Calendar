/* Independent Games Calendar navigation and Games-only release history. */
(() => {
  const menu = document.getElementById("mobile-calendar-menu");
  const trigger = document.querySelector("[data-calendar-switcher]");
  const closeMenu = () => {
    if (!menu || !trigger) return;
    menu.hidden = true;
    trigger.setAttribute("aria-expanded", "false");
  };
  if (menu && trigger) {
    trigger.addEventListener("click", event => {
      event.preventDefault();
      event.stopPropagation();
      menu.hidden = !menu.hidden;
      trigger.setAttribute("aria-expanded", String(!menu.hidden));
    });
    menu.querySelectorAll("button[data-screen]").forEach(button => {
      button.addEventListener("click", () => {
        closeMenu();
        window.showScreen?.(button.dataset.screen);
      });
    });
    document.addEventListener("click", event => {
      if (!menu.contains(event.target) && !trigger.contains(event.target)) closeMenu();
    });
    document.addEventListener("keydown", event => {
      if (event.key === "Escape") closeMenu();
    });
  }

  document.querySelectorAll(".games-page-footer [data-screen], .games-history-link[data-screen]").forEach(button => {
    button.addEventListener("click", () => window.showScreen?.(button.dataset.screen));
  });

  const list = document.getElementById("games-recent-release-list");
  const status = document.getElementById("games-recent-release-status");
  if (!list) return;
  const API_URL = "https://api.github.com/repos/JimmyHZz1/Boxing-Fight-Calendar/pulls?state=closed&sort=updated&direction=desc&per_page=100";
  const CACHE_KEY = "gamesCalendarMergedHistoryV1";
  const CACHE_TTL = 60 * 60 * 1000;
  const isGamesChange = pr => /games/i.test(String(pr.title || "") + " " + (pr.labels || []).map(label => label.name || "").join(" "));
  const formatDate = value => {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? "Date not available" : new Intl.DateTimeFormat("en-GB", {day:"numeric",month:"short",year:"numeric"}).format(date);
  };
  const render = (items, cached = false) => {
    const merged = (Array.isArray(items) ? items : []).filter(pr => pr && pr.merged_at && !pr.draft && isGamesChange(pr)).sort((a,b) => new Date(b.merged_at)-new Date(a.merged_at)).slice(0,12);
    list.replaceChildren();
    if (!merged.length) {
      const empty = document.createElement("div");
      empty.className = "games-empty-state compact";
      const title = document.createElement("h3");
      title.textContent = "No additional merged updates yet";
      const copy = document.createElement("p");
      copy.textContent = "The Games version list will grow independently as Games Calendar work is merged.";
      empty.append(title, copy);
      list.appendChild(empty);
    } else {
      merged.forEach(pr => {
        const article = document.createElement("article");
        article.className = "games-recent-release";
        const meta = document.createElement("div");
        meta.className = "games-release-meta";
        meta.textContent = formatDate(pr.merged_at) + " · PR #" + pr.number;
        const title = document.createElement("h3");
        title.textContent = pr.title || "Games update";
        const summary = document.createElement("p");
        const body = String(pr.body || "").replace(/<!--[\\s\\S]*?-->/g," ").replace(/https?:\\/\\/\\S+/g,"").replace(/\\s+/g," ").trim();
        summary.textContent = body ? (body.length > 220 ? body.slice(0,217).trimEnd()+"…" : body) : "Merged Games Calendar update.";
        const link = document.createElement("a");
        link.href = pr.html_url;
        link.target = "_blank";
        link.rel = "noopener noreferrer";
        link.textContent = "VIEW CHANGE ↗";
        article.append(meta,title,summary,link);
        list.appendChild(article);
      });
    }
    if (status) status.textContent = cached ? "Showing the latest saved Games updates." : "Automatically refreshed from Games-related merged GitHub pull requests.";
  };
  let cachedItems = null;
  try {
    const saved = JSON.parse(localStorage.getItem(CACHE_KEY) || "null");
    if (saved && Array.isArray(saved.items)) {
      cachedItems = saved.items;
      render(cachedItems, true);
      if (Date.now() - Number(saved.savedAt || 0) < CACHE_TTL) return;
    }
  } catch (_) {}
  fetch(API_URL, {headers:{Accept:"application/vnd.github+json"}})
    .then(response => { if (!response.ok) throw new Error("GitHub returned " + response.status); return response.json(); })
    .then(items => {
      render(items);
      try { localStorage.setItem(CACHE_KEY, JSON.stringify({savedAt:Date.now(),items})); } catch (_) {}
    })
    .catch(() => {
      if (cachedItems) render(cachedItems, true);
      else if (status) status.textContent = "Games update history is temporarily unavailable. The Games v1.0 entry remains available below.";
    });
})();
