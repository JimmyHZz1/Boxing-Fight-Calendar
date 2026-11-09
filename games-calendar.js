/* Independent Games Calendar navigation and Games-only release history. */
(() => {
  const menu = document.getElementById("mobile-calendar-menu");
  const trigger = document.getElementById("brand-calendar-switcher");
  const mark = document.getElementById("brand-mark-letter");
  const title = document.getElementById("brand-title");
  const closeMenu = () => {
    if (!menu || !trigger) return;
    menu.hidden = true;
    trigger.setAttribute("aria-expanded", "false");
  };
  const setBrand = screenId => {
    const games = screenId === "games-calendar-screen" || screenId === "games-version-history-screen";
    document.body.classList.toggle("games-mode", games);
    if (mark) mark.textContent = games ? "G" : "S";
    if (title) title.textContent = games ? "GAMES" : "SPORTS";
  };
  if (menu && trigger) {
    // A single document-level capture handler handles taps on every nested part
    // of the brand and prevents other header listeners swallowing iOS clicks.
    document.addEventListener("click", event => {
      const target = event.target instanceof Element ? event.target : event.target?.parentElement;
      const triggerHit = target?.closest("#brand-calendar-switcher");
      if (triggerHit) {
        event.preventDefault();
        event.stopPropagation();
        menu.hidden = !menu.hidden;
        trigger.setAttribute("aria-expanded", String(!menu.hidden));
        return;
      }
      const menuButton = target?.closest("#mobile-calendar-menu button[data-screen]");
      if (menuButton && menu.contains(menuButton)) {
        event.preventDefault();
        event.stopPropagation();
        const destination = menuButton.dataset.screen;
        closeMenu();
        setBrand(destination);
        if (typeof window.showScreen === "function") {
          window.showScreen(destination);
        } else {
          document.querySelectorAll(".screen").forEach(screen => {
            screen.classList.toggle("active", screen.id === destination);
          });
          setBrand(destination);
        }
        return;
      }
      if (!menu.contains(target)) closeMenu();
    }, true);
    document.addEventListener("keydown", event => {
      if (event.key === "Escape") closeMenu();
    });
    window.addEventListener("sports:screen-changed", event => setBrand(event.detail?.screen || ""));
  }


  document.querySelectorAll(".games-page-footer [data-screen], .games-history-link[data-screen], .games-version-history-link[data-screen]").forEach(button => {
    button.addEventListener("click", () => window.showScreen?.(button.dataset.screen));
  });

  const list = document.getElementById("games-recent-release-list");
  const status = document.getElementById("games-recent-release-status");
  if (!list) return;
  const featuredTicker = document.getElementById("games-up-next-ticker");
  const londonMidnight = releaseDate => {
    const [year, month, day] = releaseDate.split("-").map(Number);
    const utcGuess = Date.UTC(year, month - 1, day);
    const parts = new Intl.DateTimeFormat("en-GB", {
      timeZone: "Europe/London", year: "numeric", month: "2-digit",
      day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit",
      hourCycle: "h23"
    }).formatToParts(new Date(utcGuess));
    const values = Object.fromEntries(parts.filter(part => part.type !== "literal").map(part => [part.type, Number(part.value)]));
    const londonClockAsUtc = Date.UTC(values.year, values.month - 1, values.day, values.hour, values.minute, values.second);
    return utcGuess - (londonClockAsUtc - utcGuess);
  };
  const releaseCountdown = releaseDate => {
    const remaining = londonMidnight(releaseDate) - Date.now();
    if (!Number.isFinite(remaining)) return "DATE TBC";
    if (remaining <= 0) return "RELEASED";
    const seconds = Math.floor(remaining / 1000);
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return "IN " + days + "D " + String(hours).padStart(2,"0") + "H " +
      String(minutes).padStart(2,"0") + "M " + String(secs).padStart(2,"0") + "S";
  };
  const renderFeaturedGames = items => {
    if (!featuredTicker) return;
    const today = new Intl.DateTimeFormat("en-CA", {timeZone:"Europe/London",year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date());
    const upcoming = (Array.isArray(items) ? items : [])
      .filter(game => game && typeof game.release_date === "string" && game.release_date.length === 10 && game.release_date[4] === "-" && game.release_date[7] === "-" && game.release_date >= today)
      .sort((a,b) => a.release_date.localeCompare(b.release_date));
    featuredTicker.replaceChildren();
    if (!upcoming.length) {
      const empty = document.createElement("span");
      empty.className = "games-up-next-loading";
      empty.textContent = "No confirmed major release dates currently listed.";
      featuredTicker.append(empty);
      return;
    }
    const track = document.createElement("div");
    track.className = "next-event-track";
    const group = document.createElement("div");
    group.className = "next-event-group";
    upcoming.forEach(game => {
      const item = document.createElement(game.source_url && (game.source_url.startsWith("https://") || game.source_url.startsWith("http://")) ? "a" : "article");
      item.className = "next-event-item games-up-next-item";
      item.dataset.sport = "games";
      if (item.tagName === "A") {
        item.href = game.source_url;
        item.target = "_blank";
        item.rel = "noopener noreferrer";
        item.setAttribute("aria-label", "Release details for " + (game.title || "upcoming game"));
      }
      const info = document.createElement("span");
      info.className = "next-event-info";
      const label = document.createElement("small");
      label.className = "next-event-sport";
      label.textContent = "GAMES";
      const name = document.createElement("strong");
      name.className = "next-event-name";
      name.textContent = game.title || "Upcoming release";
      const countdown = document.createElement("small");
      countdown.className = "next-event-countdown";
      countdown.dataset.releaseDate = game.release_date;
      countdown.textContent = releaseCountdown(game.release_date);
      const platforms = document.createElement("small");
      platforms.className = "next-event-detail";
      platforms.textContent = Array.isArray(game.platforms) ? game.platforms.join(" · ") : "PC & CONSOLE";
      info.append(label, name, countdown, platforms);
      const logoWrap = document.createElement("span");
      logoWrap.className = "next-event-state games-up-next-logo";
      if (game.logo_url && game.logo_url.startsWith("https://")) {
        const logo = document.createElement("img");
        logo.src = game.logo_url;
        logo.alt = (game.title || "Game") + " logo";
        logo.loading = "lazy";
        logo.onerror = () => {
          logo.remove();
          logoWrap.textContent = String(game.short_name || game.title || "GAME").split(" ").map(word => word[0]).join("").slice(0,3).toUpperCase();
          logoWrap.classList.add("games-up-next-logo-fallback");
        };
        logoWrap.append(logo);
      } else {
        logoWrap.textContent = String(game.short_name || game.title || "GAME").split(" ").map(word => word[0]).join("").slice(0,3).toUpperCase();
        logoWrap.classList.add("games-up-next-logo-fallback");
      }
      item.append(info, logoWrap);
      group.append(item);
    });
    track.append(group);
    featuredTicker.replaceChildren(track);
    const groupWidth = group.getBoundingClientRect().width || group.scrollWidth;
    const gap = parseFloat(getComputedStyle(group).columnGap || getComputedStyle(group).gap) || 0;
    const loopDistance = groupWidth + gap;
    if (groupWidth && loopDistance) {
      const targetWidth = Math.max(featuredTicker.clientWidth + loopDistance * 1.25, loopDistance * 2.5);
      let copies = 1;
      while (track.scrollWidth < targetWidth && copies < 20) {
        const clone = group.cloneNode(true);
        clone.dataset.tickerClone = "true";
        clone.setAttribute("aria-hidden", "true");
        clone.querySelectorAll("a,button").forEach(node => { node.tabIndex = -1; });
        track.append(clone);
        copies++;
      }
      track.style.setProperty("--ticker-distance", loopDistance + "px");
      track.style.setProperty("--ticker-offset", "-" + loopDistance + "px");
      track.style.setProperty("--ticker-duration", Math.max(24, loopDistance / 22) + "s");
      featuredTicker.classList.add("is-auto-scrolling");
    }
  };
  const updateReleaseCountdowns = () => {
    featuredTicker?.querySelectorAll("[data-release-date]").forEach(node => {
      node.textContent = releaseCountdown(node.dataset.releaseDate);
    });
  };
  if (featuredTicker) {
    featuredTicker.addEventListener("touchstart", () => featuredTicker.classList.add("is-paused"), {passive:true});
    featuredTicker.addEventListener("touchend", () => setTimeout(() => featuredTicker.classList.remove("is-paused"), 1200), {passive:true});
    fetch("./data/games-featured.json?t="+Date.now(), {cache:"no-store"})
      .then(response => { if (!response.ok) throw new Error("Featured game feed unavailable"); return response.json(); })
      .then(data => { renderFeaturedGames(data.games); updateReleaseCountdowns(); })
      .catch(() => renderFeaturedGames([]));
    window.setInterval(updateReleaseCountdowns, 1000);
  }
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
        const body = String(pr.body || "").replace(/<!--[\s\S]*?-->/g," ").replace(/https?:\/\/\S+/g,"").replace(/\s+/g," ").trim();
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
