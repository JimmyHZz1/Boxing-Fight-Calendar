(() => {
  const $ = id => document.getElementById(id);
  const order = ["f1","darts","boxing","ufc","bkfc"];
  const labels = {f1:"FORMULA 1",darts:"PDC DARTS",boxing:"BOXING",ufc:"UFC",bkfc:"BKFC"};
  const icons = {f1:"F1",darts:"PDC",boxing:"BOX",ufc:"UFC",bkfc:"BKFC"};
  const root = $("weekend-content");
  if (!root) return;
  const ukKey = value => {
    if (!value) return "";
    const raw = String(value);
    if (/^\\d{4}-\\d{2}-\\d{2}$/.test(raw)) return raw;
    const date = new Date(raw);
    return Number.isNaN(date.getTime()) ? "" : new Intl.DateTimeFormat("en-CA",{timeZone:"Europe/London"}).format(date);
  };
  const timestamp = event => {
    const value = event.start_at || event.start_time_utc || event.date || event.event_date;
    if (!value) return Number.MAX_SAFE_INTEGER;
    const date = new Date(/^\\d{4}-\\d{2}-\\d{2}$/.test(String(value)) ? value+"T12:00:00Z" : value);
    return Number.isNaN(date.getTime()) ? Number.MAX_SAFE_INTEGER : date.getTime();
  };
  const dateLabel = key => new Intl.DateTimeFormat("en-GB",{timeZone:"Europe/London",weekday:"long",day:"numeric",month:"long"}).format(new Date(key+"T12:00:00Z"));
  const timeLabel = event => {
    const value = event.start_at || event.start_time_utc || event.main_card_at || event.race_start_at;
    if (!value || /^\\d{4}-\\d{2}-\\d{2}$/.test(String(value))) return "TIME TBC";
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? "TIME TBC" : new Intl.DateTimeFormat("en-GB",{timeZone:"Europe/London",hour:"2-digit",minute:"2-digit"}).format(date)+" UK";
  };
  const make = (tag, cls, value) => {
    const el = document.createElement(tag);
    if (cls) el.className = cls;
    if (value != null) el.textContent = value;
    return el;
  };
  function collect() {
    const all = [];
    order.forEach(sport => {
      const events = sport === "boxing" ? (window.BoxingSchedule?.getEvents?.() || []) : (window.SportsData?.getEvents?.(sport,true) || []);
      events.forEach(event => all.push({sport,event}));
    });
    return all.filter(item => {
      const key = ukKey(item.event.start_at || item.event.start_time_utc || item.event.date || item.event.event_date);
      return key && key >= todayKey() && key <= endKey();
    }).sort((a,b) => timestamp(a.event)-timestamp(b.event));
  }
  const todayKey = () => new Intl.DateTimeFormat("en-CA",{timeZone:"Europe/London"}).format(new Date());
  const endKey = () => {
    const now = new Date();
    const parts = new Intl.DateTimeFormat("en-CA",{timeZone:"Europe/London",year:"numeric",month:"2-digit",day:"2-digit"}).formatToParts(now);
    const map = Object.fromEntries(parts.filter(p=>p.type!=="literal").map(p=>[p.type,p.value]));
    const date = new Date(Date.UTC(Number(map.year),Number(map.month)-1,Number(map.day)+7));
    return date.toISOString().slice(0,10);
  };
  function eventCard(item) {
    const {sport,event} = item;
    const article = make("article","weekend-event weekend-"+sport);
    const time = make("div","weekend-event-time");
    time.append(make("strong",null,timeLabel(event)),make("small",null,labels[sport]));
    const info = make("div","weekend-event-info");
    info.append(make("strong",null,event.name || event.title || "Scheduled event"));
    const details = [event.venue,event.location,event.city,event.circuit,event.country].filter(Boolean);
    if (sport==="boxing" && event.bouts?.length) details.push(event.bouts.length+" confirmed bouts");
    if (sport==="boxing" && event.fights?.length) details.push(event.fights.length+" confirmed bouts");
    info.append(make("small",null,details.join(" · ") || "Event details to be confirmed"));
    const action = make("button","weekend-open","VIEW");
    action.type = "button";
    action.addEventListener("click",()=>{
      if (window.SportPages?.open) window.SportPages.open(sport);
      else window.showScreen?.("home-screen");
    });
    article.append(time,info,action);
    return article;
  }
  function render() {
    const items = collect();
    root.replaceChildren();
    const start = todayKey(), finish = endKey();
    $("weekend-range-label").textContent = dateLabel(start).toUpperCase()+" — "+dateLabel(finish).toUpperCase()+" · "+items.length+" EVENTS";
    if (!items.length) {
      root.append(make("div","weekend-empty","No events are currently listed in the next seven days. Check the individual sport pages for the latest announcements."));
      return;
    }
    const days = new Map();
    items.forEach(item=>{
      const key = ukKey(item.event.start_at || item.event.start_time_utc || item.event.date || item.event.event_date);
      if (!days.has(key)) days.set(key,[]);
      days.get(key).push(item);
    });
    days.forEach((events,key)=>{
      const section = make("section","weekend-day");
      const heading = make("div","weekend-day-heading");
      heading.append(make("h2",null,dateLabel(key)),make("span",null,events.length+" "+(events.length===1?"EVENT":"EVENTS")));
      section.append(heading);
      const list = make("div","weekend-day-list");
      events.forEach(item=>list.append(eventCard(item)));
      section.append(list);
      root.append(section);
    });
  }
  $("weekend-refresh")?.addEventListener("click",async()=>{
    $("weekend-refresh").disabled=true;
    if(window.SportsData?.load) await window.SportsData.load();
    render();
    $("weekend-refresh").disabled=false;
  });
  document.addEventListener("sports:feeds-updated",render);
  document.addEventListener("sports:boxing-data-updated",render);
  document.addEventListener("DOMContentLoaded",render);
  render();
  setInterval(()=>{if(document.visibilityState==="visible")render();},60000);
  window.MySportsWeekend={render};
})();