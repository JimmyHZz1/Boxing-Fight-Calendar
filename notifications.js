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
  const PREF_KEY = "sports-calendar-notification-preferences-v1";
  const categories = ["FORMULA 1","PDC DARTS","BOXING","UFC","BKFC","FIM SPEEDWAY","GAME RELEASE"];
  const defaults = { leadDays: 14, categories: Object.fromEntries(categories.map(name => [name, true])) };
  let preferences = (() => { try { return {...defaults, ...JSON.parse(localStorage.getItem(PREF_KEY) || "{}"), categories:{...defaults.categories,...(JSON.parse(localStorage.getItem(PREF_KEY) || "{}").categories||{})}}; } catch (_) { return defaults; } })();
  const readIds = new Set(JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]"));
  const now = () => Date.now();
  const horizon = () => now() + Math.max(1, Math.min(14, Number(preferences.leadDays)||14)) * 24 * 60 * 60 * 1000;
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
    const rawDate = item[dateField] || item.start_at || item.start_time_utc || item.release_date;
    const date = parseDate(rawDate);
    const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
    if (!title || !date || date.getTime() < todayStart.getTime() || date.getTime() > horizon() || preferences.categories[category] === false) return;
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

  function savePreferences() {
    localStorage.setItem(PREF_KEY, JSON.stringify(preferences));
    if (window.chrome?.webview) window.chrome.webview.postMessage({type:"notification-preferences", preferences});
    notifications = [];
    refresh();
  }
  function addPreferences() {
    if (panel.querySelector(".notification-preferences")) return;
    const section = document.createElement("details"); section.className = "notification-preferences";
    const summary = document.createElement("summary"); summary.textContent = "PERSONALISE ALERTS"; section.append(summary);
    const leadLabel = document.createElement("label"); leadLabel.className = "notification-preference-lead"; leadLabel.textContent = "Show events within ";
    const select = document.createElement("select");
    [1,3,7,14].forEach(days=>{const option=document.createElement("option");option.value=String(days);option.textContent=days+" days";select.append(option);});
    select.value=String(preferences.leadDays||14); select.addEventListener("change",()=>{preferences.leadDays=Number(select.value);savePreferences();}); leadLabel.append(select);section.append(leadLabel);
    const grid=document.createElement("div");grid.className="notification-preference-grid";
    categories.forEach(category=>{const label=document.createElement("label"),input=document.createElement("input"),text=document.createElement("span");input.type="checkbox";input.checked=preferences.categories[category]!==false;input.addEventListener("change",()=>{preferences.categories[category]=input.checked;savePreferences();});text.textContent=category;label.append(input,text);grid.append(label);});
    section.append(grid); const heading=panel.querySelector(".notification-popover-heading"); heading?.after(section);
  }
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

  addPreferences();
  refresh();
  window.addEventListener("focus", refresh);
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) refresh();
  });
})();
