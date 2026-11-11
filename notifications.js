/* Shared event notification centre for the web and WebView2 desktop app. */
(() => {
  const root = document.getElementById("notification-center");
  const bell = document.getElementById("notification-bell");
  const panel = document.getElementById("notification-popover");
  const list = document.getElementById("notification-list");
  const count = document.getElementById("notification-count");
  const markAll = document.getElementById("notification-mark-read");
  if (!root || !bell || !panel || !list || !count) return;

  const STORAGE_KEY = "sports-calendar-read-notifications-v1";
  const readIds = new Set(JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]"));
  const now = Date.now();
  const horizon = now + 14 * 24 * 60 * 60 * 1000;
  let notifications = [];

  const parseDate = value => {
    if (!value) return null;
    const raw = String(value);
    const dateOnly = /^\d{4}-\d{2}-\d{2}$/.test(raw);
    const parsed = new Date(dateOnly ? raw + "T09:00:00" : raw);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  };
  const add = (item, category, dateField = "date") => {
    const title = item.name || item.title || item.short_name;
    const date = parseDate(item[dateField] || item.start_at || item.start_time_utc || item.release_date);
    if (!title || !date || date.getTime() < now || date.getTime() > horizon) return;
    if (item.source_note) return;
    const id = String(item.id || [category, title, date.toISOString()].join("|"));
    notifications.push({ id, category, title, date, screen: category === "GAME RELEASE" ? "games-calendar-screen" : "calendar-screen" });
  };
  const loadFeed = async (path, category, field = "events") => {
    try {
      const response = await fetch("./" + path + "?notification-check=" + Date.now(), { cache: "no-store" });
      if (!response.ok) return;
      const data = await response.json();
      if (Array.isArray(data[field])) data[field].forEach(item => add(item, category));
    } catch (_) {}
  };

  const refresh = async () => {
    await Promise.all([
      loadFeed("data/f1.json", "FORMULA 1"),
      loadFeed("data/darts.json", "PDC DARTS"),
      loadFeed("data/ufc.json", "UFC"),
      loadFeed("data/bkfc.json", "BKFC"),
      loadFeed("data/fights.json", "BOXING")
    ]);
    try {
      const response = await fetch("./data/speedway.json?notification-check=" + Date.now(), { cache: "no-store" });
      if (response.ok) {
        const data = await response.json();
        Object.values(data.competitions || {}).forEach(competition =>
          (competition.events || []).forEach(item => add(item, "FIM SPEEDWAY")));
      }
    } catch (_) {}
    try {
      const response = await fetch("./data/games-featured.json?notification-check=" + Date.now(), { cache: "no-store" });
      if (response.ok) {
        const data = await response.json();
        (data.games || []).forEach(item => add(item, "GAME RELEASE", "release_date"));
      }
    } catch (_) {}

    const unique = new Map();
    notifications.forEach(item => unique.set(item.id, item));
    notifications = [...unique.values()].sort((a, b) => a.date - b.date);
    render();
  };

  const saveRead = () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify([...readIds].slice(-500)));
  };
  const render = () => {
    const unread = notifications.filter(item => !readIds.has(item.id)).length;
    count.textContent = unread > 99 ? "99+" : String(unread);
    count.hidden = unread === 0;
    list.replaceChildren();
    if (!notifications.length) {
      const empty = document.createElement("p");
      empty.className = "notification-empty";
      empty.textContent = "No upcoming events or releases in the next 14 days.";
      list.append(empty);
      return;
    }
    notifications.forEach(item => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "notification-item" + (readIds.has(item.id) ? " is-read" : " is-unread");
      const copy = document.createElement("span");
      copy.className = "notification-item-copy";
      const category = document.createElement("small");
      category.textContent = item.category;
      const title = document.createElement("strong");
      title.textContent = item.title;
      const date = document.createElement("time");
      date.dateTime = item.date.toISOString();
      date.textContent = new Intl.DateTimeFormat("en-GB", {
        weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit"
      }).format(item.date);
      copy.append(category, title, date);
      const dot = document.createElement("span");
      dot.className = "notification-item-dot";
      dot.setAttribute("aria-hidden", "true");
      button.append(copy, dot);
      button.addEventListener("click", () => {
        readIds.add(item.id);
        saveRead();
        render();
        panel.hidden = true;
        bell.setAttribute("aria-expanded", "false");
        if (typeof window.showScreen === "function") window.showScreen(item.screen);
      });
      list.append(button);
    });
  };

  bell.addEventListener("click", () => {
    panel.hidden = !panel.hidden;
    bell.setAttribute("aria-expanded", String(!panel.hidden));
  });
  markAll?.addEventListener("click", () => {
    notifications.forEach(item => readIds.add(item.id));
    saveRead();
    render();
  });
  document.addEventListener("click", event => {
    if (!root.contains(event.target)) {
      panel.hidden = true;
      bell.setAttribute("aria-expanded", "false");
    }
  });
  document.addEventListener("keydown", event => {
    if (event.key === "Escape") {
      panel.hidden = true;
      bell.setAttribute("aria-expanded", "false");
    }
  });

  refresh();
  window.addEventListener("focus", refresh);
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) refresh();
  });
})();
