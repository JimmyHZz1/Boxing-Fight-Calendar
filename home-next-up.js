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
    if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
    const date = new Date(raw);
    return Number.isNaN(date.getTime()) ? raw.slice(0, 10) : new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/London" }).format(date);
  };
  const dateLabel = event => {
    const value = eventDate(event);
    if (!value) return "DATE TBC";
    const raw = String(value);
    const date = new Date(/^\d{4}-\d{2}-\d{2}$/.test(raw) ? raw + "T12:00:00Z" : raw);
    if (Number.isNaN(date.getTime())) return "DATE TBC";
    const dateText = new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/London", weekday: "short", day: "numeric", month: "short" }).format(date);
    if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return dateText + " · TIME TBC";
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

  const resultsRoot = () => document.getElementById("home-latest-results-list");
  const resultSport = [
    {key:"f1",label:"FORMULA 1",mark:"F1"},
    {key:"darts",label:"PDC DARTS",mark:"PDC"},
    {key:"ufc",label:"UFC",mark:"UFC"},
    {key:"bkfc",label:"BKFC",mark:"BKFC"}
  ];
  const resultWinner = fight => {
    const result = fight?.result || {};
    const a = fight?.fighter_a || fight?.fighter1 || fight?.fighterA || {};
    const b = fight?.fighter_b || fight?.fighter2 || fight?.fighterB || {};
    const winner = fight?.winner || result.winner || result.winner_name || "";
    if (typeof winner === "string" && winner) return winner;
    const id = result.winner_fighter_id || result.winner_id || fight?.winner_fighter_id;
    if (id != null) return String(a.id) === String(id) ? (a.name || fight.fighter1 || "Winner") : String(b.id) === String(id) ? (b.name || fight.fighter2 || "Winner") : "";
    return "";
  };
  const hasConfirmedResult = event => {
    if (Array.isArray(event.results) && event.results.length) return true;
    const fights = event.fights || event.bouts || [];
    return Array.isArray(fights) && fights.some(f => f.result || f.winner || f.status === "completed");
  };
  const resultSummary = (sport,event) => {
    if (Array.isArray(event.results) && event.results.length) {
      return event.results.slice(0,3).map((r,i) => {
        const position = r.position || (i+1);
        const name = r.driver || r.name || r.player || r.competitor || "";
        return name ? "P"+position+" "+name : "";
      }).filter(Boolean).join(" · ");
    }
    const fights = (event.fights || event.bouts || []).filter(f => f.result || f.winner || f.status === "completed");
    const winners = fights.map(f => {
      const name = resultWinner(f) || f.winner || "";
      const method = f.result?.method || f.method || "";
      return name ? name+(method ? " · "+method : "") : "";
    }).filter(Boolean).slice(0,2);
    if (winners.length) return winners.join(" · ");
    return event.winner || event.result_summary || event.result || "";
  };
  function collectLatestResults() {
    const today = londonToday();
    const records = [];
    resultSport.forEach(sport => {
      const events = window.SportsData?.getEvents?.(sport.key,true) || [];
      events.forEach(event => {
        const date = dateKey(event);
        if (date && date <= today && hasConfirmedResult(event)) {
          records.push({sport:sport.key,mark:sport.mark,name:eventName(event),date,summary:resultSummary(sport.key,event),event});
        }
      });
    });
    boxingEvents.forEach(event => {
      const bouts = Array.isArray(event.bouts) ? event.bouts : [];
      const completed = bouts.filter(b => b.result || b.winner || b.status === "completed");
      if (!completed.length) return;
      const date = dateKey(event);
      if (!date || date > today) return;
      const winners = completed.map(b => {
        const winner = b.winner || b.result?.winner || b.result?.winner_name || "";
        return typeof winner === "string" ? winner : "";
      }).filter(Boolean).slice(0,2);
      records.push({sport:"boxing",mark:"BOX",name:eventName(event),date,summary:winners.join(" · ") || completed.length+" bout results confirmed",event});
    });
    return records.sort((a,b)=>b.date.localeCompare(a.date)).slice(0,4);
  }
  function renderLatestResults() {
    const target = resultsRoot();
    if (!target || !feedsReady) return;
    target.replaceChildren();
    const records = collectLatestResults();
    if (!records.length) {
      const empty = document.createElement("p");
      empty.className = "live-centre-empty";
      empty.textContent = "No confirmed results are available in the latest published feeds yet.";
      target.append(empty);
      return;
    }
    records.forEach(record => {
      const card = document.createElement("button");
      card.type = "button";
      card.className = "home-latest-result-item";
      card.dataset.sport = record.sport;
      const mark = document.createElement("span");
      mark.className = "home-latest-result-mark";
      mark.textContent = record.mark;
      const copy = document.createElement("span");
      copy.className = "home-latest-result-copy";
      const title = document.createElement("strong");
      title.textContent = record.name;
      const date = document.createElement("small");
      date.textContent = new Intl.DateTimeFormat("en-GB",{timeZone:"Europe/London",day:"numeric",month:"short"}).format(new Date(record.date+"T12:00:00Z"))+" · "+record.sport.toUpperCase();
      const summary = document.createElement("small");
      summary.className = "home-latest-result-summary";
      summary.textContent = record.summary || "Result confirmed";
      copy.append(title,date,summary);
      card.append(mark,copy);
      card.addEventListener("click",()=>{
        if(record.sport==="boxing"){
          document.getElementById("boxing-home-content")?.scrollIntoView({behavior:"smooth",block:"start"});
        } else if(window.SportPages?.open) window.SportPages.open(record.sport);
      });
      target.append(card);
    });
    target.setAttribute("aria-label",records.length+" latest confirmed sports results");
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
    renderLatestResults();
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
  document.addEventListener("sports:feeds-updated", () => { render(); renderLatestResults(); });
  if (window.SportsData) refresh();
  else document.addEventListener("DOMContentLoaded", refresh, { once: true });
  setInterval(() => { render(); renderLatestResults(); }, 60000);
})();
