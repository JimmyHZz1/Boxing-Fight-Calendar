(() => {
  const SPORTS = ["f1", "darts", "ufc", "bkfc"];
  const data = {f1:[], darts:[], ufc:[], bkfc:[]};
  const meta = {};
  let active = "f1";
  let calendarFilter = "all";
  const $ = id => document.getElementById(id);
  const today = () => new Intl.DateTimeFormat("en-CA",{timeZone:"Europe/London"}).format(new Date());
  function safe(value, fallback="") { return value == null || value === "" ? fallback : String(value); }
  function dateKey(value, dateOnly=false) {
    if (!value) return "";
    const s=String(value);
    if (dateOnly && /^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
    const d=new Date(s);
    if (Number.isNaN(d.getTime())) return /^\d{4}-\d{2}-\d{2}/.test(s)?s.slice(0,10):"";
    return new Intl.DateTimeFormat("en-CA",{timeZone:"Europe/London",year:"numeric",month:"2-digit",day:"2-digit"}).format(d);
  }
  function timeLabel(value) {
    if (!value) return "Time TBC";
    const d=new Date(value);
    if (Number.isNaN(d.getTime())) return safe(value);
    return new Intl.DateTimeFormat("en-GB",{timeZone:"Europe/London",hour:"2-digit",minute:"2-digit"}).format(d)+" UK";
  }
  function dateLabel(value) {
    const key=dateKey(value, /^\d{4}-\d{2}-\d{2}$/.test(String(value||"")));
    if (!key) return "Date TBC";
    const d=new Date(key+"T12:00:00Z");
    return new Intl.DateTimeFormat("en-GB",{timeZone:"Europe/London",weekday:"short",day:"numeric",month:"short"}).format(d);
  }
  function statusLabel(event) {
    const s=String(event.status||"").toLowerCase();
    if (["completed","complete","finished","ended"].includes(s)) return "COMPLETED";
    if (["live","in_progress","ongoing"].includes(s)) return "IN PROGRESS";
    if (["cancelled","canceled"].includes(s)) return "CANCELLED";
    if (["postponed"].includes(s)) return "POSTPONED";
    return "UPCOMING";
  }
  function make(tag, cls, text) {
    const el=document.createElement(tag);
    if (cls) el.className=cls;
    if (text != null) el.textContent=text;
    return el;
  }
  async function fetchFeed(sport) {
    try {
      const response=await fetch("./data/"+sport+".json?t="+Date.now(),{cache:"no-store"});
      if (!response.ok) throw new Error("HTTP "+response.status);
      const payload=await response.json();
      data[sport]=Array.isArray(payload.events)?payload.events:[];
      meta[sport]=payload;
    } catch (error) {
      data[sport]=[];
      meta[sport]={sync_warning:"Could not load "+sport.toUpperCase()+" data ("+error.message+")."};
    }
  }
  function allEvents() {
    return SPORTS.flatMap(sport=>data[sport].map(event=>({...event,sport})));
  }
  function eventDate(event) {
    if (event.sport==="darts"||event.sport==="bkfc") return dateKey(event.start_at||event.date,!!(event.date&&/^\\d{4}-\\d{2}-\\d{2}$/.test(event.date)&&!event.start_at));
    return dateKey(event.start_at||event.date,!!(event.date&&/^\d{4}-\d{2}-\d{2}$/.test(event.date)&&!event.start_at));
  }
  function sortedEvents(sport, includePast=false) {
    const list=data[sport].slice();
    return list.filter(e=>includePast||eventDate({...e,sport})>=today())
      .sort((a,b)=>(eventDate({...a,sport})||"").localeCompare(eventDate({...b,sport})||""));
  }
  function sportLogo(sport) {
    const logos={
      f1:{src:"https://www.formula1.com/assets/home/_next/static/media/f1-logo.43a01c6b.svg",alt:"Formula 1"},
      darts:{src:"https://commons.wikimedia.org/wiki/Special:FilePath/Professional%20Darts%20Corporation%20logo.png",alt:"PDC"},
      ufc:{src:"https://commons.wikimedia.org/wiki/Special:FilePath/UFC%20Logo.svg",alt:"UFC"},\n      bkfc:{src:"https://commons.wikimedia.org/wiki/Special:FilePath/Bkfc-logo.png",alt:"BKFC"}
    };
    return logos[sport]||null;
  }
  function watchInfo(sport,event) {
    if(sport==="f1") return [
      {name:"Sky Sports F1",href:"https://www.skysports.com/f1",logo:"https://commons.wikimedia.org/wiki/Special:FilePath/Sky_Sports_2026.svg"},
      {name:"NOW",href:"https://www.nowtv.com/watch-sky-sports",logo:null},
      ...(/british grand prix/i.test(event.name||"")?[{name:"Channel 4 · live British GP & highlights",href:"https://www.channel4.com/",logo:"https://commons.wikimedia.org/wiki/Special:FilePath/Channel_4_2022.svg"}]:[])
    ];
    if(sport==="ufc") return [
      {name:"TNT Sports",href:"https://www.tntsports.co.uk/",logo:"https://commons.wikimedia.org/wiki/Special:FilePath/TNT_Sports_(2023).svg"},
      {name:"UFC Fight Pass",href:"https://ufcfightpass.com/",logo:"https://commons.wikimedia.org/wiki/Special:FilePath/UFC_Fight_Pass_Logo.svg"}
    ];
    if(sport==="bkfc") return [\n      {name:"BKFC+ · most live events",href:"https://www.bkfc.com/",logo:"https://commons.wikimedia.org/wiki/Special:FilePath/Bkfc-logo.png"},\n      {name:"DAZN · selected exclusive events",href:"https://www.dazn.com/",logo:"https://commons.wikimedia.org/wiki/Special:FilePath/DAZN_logo.svg"}\n    ];\n    if(sport==="darts") return [
      {name:"Sky Sports Darts · selected events",href:"https://www.skysports.com/darts",logo:"https://commons.wikimedia.org/wiki/Special:FilePath/Sky_Sports_Darts_-_Logo_2025.svg"},
      {name:"ITV4 · selected events",href:"https://www.itv.com/watch",logo:"https://commons.wikimedia.org/wiki/Special:FilePath/ITV_logo.svg"},
      {name:"PDCTV · where UK rights allow",href:"https://video.pdc.tv/",logo:null}
    ];
    return [];
  }
  function renderWatch(root,sport,event) {
    const providers=watchInfo(sport,event);
    if(!providers.length)return;
    const section=make("div","sport-watch-panel");
    section.append(make("small","sport-watch-label","WHERE TO WATCH · UK"));
    const row=make("div","sport-watch-providers");
    providers.forEach(provider=>{
      const link=make("a","sport-watch-provider");link.href=provider.href;link.target="_blank";link.rel="noopener noreferrer";link.title=provider.name;
      if(provider.logo){const img=make("img");img.src=provider.logo;img.alt=provider.name+" logo";img.loading="lazy";img.onerror=()=>{img.remove();link.append(make("span",null,provider.name));};link.append(img);}
      else link.append(make("span",null,provider.name));
      row.append(link);
    });
    section.append(row);root.append(section);
  }
  function eventCard(sport,event) {
    const sportNames={f1:"FORMULA 1",darts:"PDC DARTS",ufc:"UFC",bkfc:"BKFC"};
    const card=make("details","sport-event-card sport-event-"+sport);
    const summary=make("summary");
    const visual=make("span","sport-event-visual");
    const logo=sportLogo(sport);
    if(logo){const img=make("img");img.src=logo.src;img.alt=logo.alt+" logo";img.loading="lazy";img.onerror=()=>{img.remove();visual.append(make("strong","sport-logo-wordmark",sport==="darts"?"PDC":sport==="f1"?"F1":sport.toUpperCase()));};visual.append(img);}
    else visual.append(make("strong","sport-logo-wordmark",sport==="boxing"?"BOXING":"SPORT"));
    const date=make("span","sport-event-date");
    const d=eventDate({...event,sport});
    const parsed=d?new Date(d+"T12:00:00Z"):null;
    date.append(make("small",null,parsed?new Intl.DateTimeFormat("en-GB",{month:"short"}).format(parsed).toUpperCase():"TBC"));
    date.append(make("strong",null,parsed?parsed.getUTCDate():"—"));
    const main=make("span","sport-event-main");
    main.append(make("strong",null,event.name||event.title||"Event"));
    const sub=[];
    if (sport==="f1") sub.push("ROUND "+safe(event.round,"?"),event.circuit,event.country);
    if (sport==="darts") sub.push(event.tier?String(event.tier).replaceAll("_"," ").toUpperCase():null,event.matches?event.matches+" matches":null);
    if (sport==="ufc") sub.push(event.number?"EVENT "+event.number:null,event.start_at?timeLabel(event.start_at):null);\n    if (sport==="bkfc") sub.push(event.location||event.venue||null,event.start_at?timeLabel(event.start_at):null);
    main.append(make("small",null,sub.filter(Boolean).join(" · ")||dateLabel(event.date||event.start_at)));
    summary.append(visual,date,main,make("span","sport-event-badge",statusLabel(event)));
    card.append(summary);
    const body=make("div","sport-event-body");
    if (sport==="f1") renderF1Details(body,event);
    else if (sport==="darts") renderDartsDetails(body,event);
    else if (sport==="ufc") renderUfcDetails(body,event);\n    else renderBkfcDetails(body,event);
    renderWatch(body,sport,event);
    card.append(body);
    return card;
  }
  function renderRows(root, rows, headers, mapper) {
    if (!Array.isArray(rows)||!rows.length) return;
    const table=make("table","sport-results-table");
    const thead=make("thead"),tr=make("tr");
    headers.forEach(h=>tr.append(make("th",null,h)));
    thead.append(tr);table.append(thead);
    const tbody=make("tbody");
    rows.slice(0,10).forEach(row=>{
      const line=make("tr");
      mapper(row).forEach(v=>line.append(make("td",null,safe(v,"—"))));
      tbody.append(line);
    });
    table.append(tbody);root.append(table);
  }
  function renderF1Details(root,event) {
    const sessions=event.sessions||[];
    if (sessions.length) {
      const list=make("div","sport-session-list");
      sessions.forEach(s=>list.append(make("div","sport-session-row",safe(s.name)+" · "+dateLabel(s.date)+" — "+timeLabel(s.start_at))));
      root.append(list);
    }
    if (event.results?.length) {
      root.append(make("p","sport-sync-note","RACE RESULTS"));
      renderRows(root,event.results,["POS","DRIVER","TEAM","TIME / STATUS"],r=>[r.position,r.driver,r.team,r.time||r.status]);
    }
    if (event.sprint_results?.length) {
      root.append(make("p","sport-sync-note","SPRINT RESULTS"));
      renderRows(root,event.sprint_results,["POS","DRIVER","TEAM","TIME / STATUS"],r=>[r.position,r.driver,r.team,r.time||r.status]);
    }
    if (event.qualifying_results?.length) {
      root.append(make("p","sport-sync-note","QUALIFYING"));
      renderRows(root,event.qualifying_results,["POS","DRIVER","TEAM","Q3"],r=>[r.position,r.driver,r.team,r.q3||r.q2||r.q1]);
    }
    if (!sessions.length&&!event.results?.length&&!event.qualifying_results?.length&&!event.sprint_results?.length) root.append(make("p","sport-sync-note","Session timetable or results have not been published yet."));
    if (event.source_url) {const a=make("a","event-source-link","Race details ↗");a.href=event.source_url;a.target="_blank";a.rel="noopener noreferrer";root.append(a);}
  }
  function renderDartsDetails(root,event) {
    const bits=[event.organiser?String(event.organiser).replaceAll("_"," ").toUpperCase():null,event.tier?String(event.tier).replaceAll("_"," ").toUpperCase():null,event.matches?event.matches+" matches scheduled":null].filter(Boolean);
    root.append(make("p","sport-sync-note",bits.join(" · ")||"PDC tournament date"));
    root.append(make("p","sport-sync-note","Tournament calendar entry. Match-by-match scores are not included."));
  }
  function fighterName(value) {
    if (!value) return "TBC";
    if (typeof value==="string") return value;
    return value.name||[value.given_name,value.family_name].filter(Boolean).join(" ")||"TBC";
  }
  function renderBkfcDetails(root,event) {
    const meta=[event.location||event.venue,event.country,event.start_at?timeLabel(event.start_at):null].filter(Boolean);
    if(meta.length)root.append(make("p","sport-sync-note",meta.join(" · ")));
    const fights=event.fights||event.card||event.bouts||[];
    if(fights.length){
      const list=make("div","sport-session-list");
      fights.forEach(f=>{
        const a=f.fighter_a||f.fighter1||f.red||f.corner_a||f.name_a||"TBC";
        const b=f.fighter_b||f.fighter2||f.blue||f.corner_b||f.name_b||"TBC";
        const row=make("div","sport-fight-row");
        row.append(make("strong",null,fighterName(a)+" vs "+fighterName(b)));
        row.append(make("small",null,[f.weight_class,f.result?.method,f.result?.round?"R"+f.result.round:null].filter(Boolean).join(" · ")||safe(f.card_section,"Fight card")));
        list.append(row);
      });
      root.append(list);
    } else root.append(make("p","sport-sync-note","Fight card details will appear here when confirmed by BKFC."));
    const source=event.source_url||event.url||"https://www.bkfc.com/events";
    const a=make("a","event-source-link","Official BKFC event details ↗");a.href=source;a.target="_blank";a.rel="noopener noreferrer";root.append(a);
  }
  function renderUfcDetails(root,event) {
    const fights=event.fights||event.card||event.bouts||[];
    if (event.main_card_at) root.append(make("p","sport-sync-note","MAIN CARD "+timeLabel(event.main_card_at)+(event.prelims_at?" · PRELIMS "+timeLabel(event.prelims_at):"")+(event.early_prelims_at?" · EARLY PRELIMS "+timeLabel(event.early_prelims_at):"")));
    if (fights.length) {
      const list=make("div","sport-session-list");
      fights.forEach(f=>{
        const a=fighterName(f.fighter_a||f.fighter1||f.corner_a);
        const b=fighterName(f.fighter_b||f.fighter2||f.corner_b);
        const result=f.result||{};
        const winner=f.winner||result.winner;
        const finish=[result.method||f.method,result.round?"R"+result.round:null].filter(Boolean).join(" · ");
        const row=make("div","sport-fight-row");
        row.append(make("strong",null,a+" vs "+b));
        row.append(make("small",null,winner?fighterName(winner)+" · "+finish:finish||safe(f.card_section,"Fight card")));
        list.append(row);
      });
      root.append(list);
    } else root.append(make("p","sport-sync-note","Full fight card has not yet been published by the data provider."));
    const source=event.source_url||event.url;
    if (source&&/^https?:\/\//i.test(source)) {const a=make("a","event-source-link","Event details ↗");a.href=source;a.target="_blank";a.rel="noopener noreferrer";root.append(a);}
  }
  function renderActive(sport) {
    active=sport;
    const panel=$("sport-data-panel");
    if (!panel) return;
    panel.hidden=sport==="boxing";
    if (sport==="boxing") return;
    panel.replaceChildren();
    const title={f1:"Formula 1",darts:"PDC darts",ufc:"UFC",bkfc:"BKFC bare-knuckle boxing"}[sport];
    const heading=make("div","sport-data-heading");
    const left=make("div");
    left.append(make("span","eyebrow","UPCOMING EVENTS"));
    left.append(make("h2",null,title+" calendar"));
    heading.append(left,make("small",null,(data[sport].length||0)+" EVENTS"));
    panel.append(heading);
    if (meta[sport]?.sync_warning) panel.append(make("p","sport-sync-note",meta[sport].sync_warning));
    if (meta[sport]?.notice) panel.append(make("p","sport-sync-note",meta[sport].notice));
    const list=make("div","sport-event-list");
    const events=sortedEvents(sport).slice(0,8);
    if (!events.length) list.append(make("div","sport-empty",sport==="darts"?"PDC calendar data will appear here once the Darts API key is connected and its first sync completes.":sport==="bkfc"?"BKFC event data will appear here after the next successful official schedule sync.":"Schedule data will appear here once the API connection is configured and its first sync completes."));
    else events.forEach(event=>list.append(eventCard(sport,event)));
    panel.append(list);
  }
  function getCalendarFilter(){return calendarFilter;}
  function setCalendarFilter(value) {
    calendarFilter=value;
    document.querySelectorAll("[data-calendar-sport]").forEach(button=>button.setAttribute("aria-pressed",String(button.dataset.calendarSport===value)));
    if (window.renderCalendar) window.renderCalendar();
  }
  function markCalendarDays(grid,start) {
    const filter=calendarFilter;
    allEvents().forEach(event=>{
      if (filter!=="all"&&filter!==event.sport) return;
      const key=eventDate(event);
      if (!key) return;
      const d=new Date(key+"T12:00:00Z");
      const offset=(d.getUTCDay()+6)%7;
      const index=Math.round((Date.UTC(d.getUTCFullYear(),d.getUTCMonth(),d.getUTCDate())-Date.UTC(start.getFullYear(),start.getMonth(),start.getDate()))/86400000);
      const button=grid.children[index];
      if (button&&index>=0&&index<42) button.classList.add("has-sport-event");
    });
  }
  function renderSelectedDate(key) {
    const root=$("sports-selected-date-events");
    if (!root) return;
    root.replaceChildren();
    const events=allEvents().filter(event=>(calendarFilter==="all"||calendarFilter===event.sport)&&eventDate(event)===key);
    if (events.length) {
      root.append(make("div","section-heading compact", "OTHER SPORTS"));
      events.forEach(event=>root.append(eventCard(event.sport,event)));
    }
  }
  function renderEventCards() {
    const root=$("sports-event-cards");
    if (!root) return;
    root.replaceChildren();
    const events=allEvents().sort((a,b)=>(eventDate(a)||"").localeCompare(eventDate(b)||""));
    if (!events.length) return;
    const heading=make("div","section-heading compact");
    heading.append(make("h2",null,"Formula 1 · Darts · Boxing · UFC · BKFC"));
    root.append(heading);
    events.forEach(event=>root.append(eventCard(event.sport,event)));
  }
  function renderAll() {
    renderActive(active);
    renderEventCards();
  }
  document.querySelectorAll("[data-calendar-sport]").forEach(button=>button.addEventListener("click",()=>setCalendarFilter(button.dataset.calendarSport)));
  window.SportsData={load:async()=>{await Promise.all(SPORTS.map(fetchFeed));renderAll();if(window.renderCalendar)window.renderCalendar();},renderActive,renderAll,renderEventCards,renderSelectedDate,markCalendarDays,getCalendarFilter};
  window.SportsData.load();
})();