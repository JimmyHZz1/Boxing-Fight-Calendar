(() => {
  "use strict";
  const SPORTS = [
    { key: "f1", label: "FORMULA 1", mark: "F1" },
    { key: "darts", label: "PDC DARTS", mark: "PDC" },
    { key: "boxing", label: "BOXING", mark: "BOX" },
    { key: "ufc", label: "UFC", mark: "UFC" },
    { key: "bkfc", label: "BKFC", mark: "BKFC" }
  ];
  const root = () => document.getElementById("home-next-up-list");
  let boxingEvents = [];
  let feedsReady = false;
  const londonToday = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/London" }).format(new Date());
  const eventDate = event => event.start_at || event.main_card_at || event.start_time_utc || event.starts_at || event.date || event.event_date || "";
  const eventName = event => event.name || event.title || event.event_name || event.short_title || "Upcoming event";
  const dateKey = event => {
    const value = eventDate(event);
    if (!value) return "";
    const raw = String(value);
    if (/^\\d{4}-\\d{2}-\\d{2}$/.test(raw)) return raw;
    const date = new Date(raw);
    return Number.isNaN(date.getTime()) ? raw.slice(0, 10) : new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/London" }).format(date);
  };
  const dateLabel = event => {
    const value = eventDate(event);
    if (!value) return "DATE TBC";
    const raw = String(value);
    const date = new Date(/^\\d{4}-\\d{2}-\\d{2}$/.test(raw) ? raw + "T12:00:00Z" : raw);
    if (Number.isNaN(date.getTime())) return "DATE TBC";
    const dateText = new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/London", weekday: "short", day: "numeric", month: "short" }).format(date);
    if (/^\\d{4}-\\d{2}-\\d{2}$/.test(raw)) return dateText + " · TIME TBC";
    const timeText = new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/London", hour: "2-digit", minute: "2-digit" }).format(date);
    return dateText + " · " + timeText;
  };
  const detailText = (sport, event) => {
    if (sport === "boxing") {
      const bouts = Array.isArray(event.bouts) ? event.bouts : [];
      const main = bouts.find(b => b.title_text) || bouts[0];
      const bout = main ? [main.fighter1, main.fighter2].filter(Boolean).join(" vs ") : "";
      return [bout, bouts.length ? bouts.length + " bouts" : "", event.location || event.city || event.country].filter(Boolean).join(" · ");
    }
    return [event.venue || event.circuit || event.location || event.city || event.country, event.round ? "Round " + event.round : ""].filter(Boolean).join(" · ");
  };
  function nextEvent(sport) {
    if (sport === "boxing") {
      return boxingEvents.filter(event => dateKey(event) >= londonToday()).sort((a, b) => dateKey(a).localeCompare(dateKey(b)))[0] || null;
    }
    return window.SportsData?.getNextEvent?.(sport) || null;
  }
  function render() {
    const target = root();
    if (!target || !feedsReady) return;
    target.replaceChildren();
    let count = 0;
    SPORTS.forEach(sport => {
      const event = nextEvent(sport.key);
      const card = document.createElement("button");
      card.type = "button";
      card.className = "home-next-up-item";
      card.dataset.sport = sport.key;
      const mark = document.createElement("span");
      mark.className = "home-next-up-mark";
      mark.textContent = sport.mark;
      const info = document.createElement("span");
      info.className = "home-next-up-info";
      const title = document.createElement("strong");
      title.textContent = event ? eventName(event) : "No confirmed event";
      const date = document.createElement("small");
      date.textContent = event ? dateLabel(event) : "Awaiting schedule";
      const detail = document.createElement("small");
      detail.className = "home-next-up-detail";
      detail.textContent = event ? detailText(sport.key, event) : "Check back after the next data sync";
      info.append(title, date, detail);
      const arrow = document.createElement("span");
      arrow.className = "home-next-up-arrow";
      arrow.textContent = event ? "↗" : "—";
      card.append(mark, info, arrow);
      card.disabled = !event;
      card.addEventListener("click", () => {
        if (sport.key === "boxing") {
          window.showScreen?.("home-screen");
          document.getElementById("boxing-home-content")?.scrollIntoView({ behavior: "smooth", block: "start" });
        } else if (window.SportPages?.open) {
          window.SportPages.open(sport.key);
        } else {
          window.showScreen?.("home-screen");
          window.SportsSelector?.goToSport(sport.key);
        }
      });
      target.append(card);
      if (event) count++;
    });
    target.setAttribute("aria-label", "Next events across five sports; " + count + " confirmed");
  }
  async function loadBoxing() {
    try {
      const response = await fetch("./data/fights.json?t=" + Date.now(), { cache: "no-store" });
      if (!response.ok) throw new Error("HTTP " + response.status);
      const payload = await response.json();
      boxingEvents = Array.isArray(payload.events) ? payload.events : [];
    } catch (error) {
      boxingEvents = [];
    }
  }
  async function refresh() {
    await loadBoxing();
    feedsReady = true;
    render();
  }
  document.addEventListener("sports:feeds-updated", render);
  if (window.SportsData) refresh();
  else document.addEventListener("DOMContentLoaded", refresh, { once: true });
  setInterval(render, 60000);
})();
