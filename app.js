const DATA_URL = "./data/fights.json";
const ACTIONS_URL = "https://github.com/JimmyHZz1/Boxing-Fight-Calendar/actions/workflows/sync-fights.yml";
const state = { events: [], month: new Date(new Date().getFullYear(), new Date().getMonth(), 1), selected: new Date() };
const $ = id => document.getElementById(id);
const pad = n => String(n).padStart(2, "0");
const dateKey = d => `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
const parseDate = value => { const d = new Date(value); return Number.isNaN(d.getTime()) ? null : d; };
const ukParts = value => {
  const d = value instanceof Date ? value : parseDate(value);
  if (!d) return null;
  const parts = new Intl.DateTimeFormat("en-GB", { timeZone:"Europe/London", year:"numeric", month:"2-digit", day:"2-digit" }).formatToParts(d);
  return Object.fromEntries(parts.filter(p => p.type !== "literal").map(p => [p.type,p.value]));
};
const ukKey = value => { const p=ukParts(value); return p ? `${p.year}-${p.month}-${p.day}` : ""; };
const todayKey = () => ukKey(new Date());
const ukDate = value => { const d=parseDate(value); return d ? new Intl.DateTimeFormat("en-GB",{timeZone:"Europe/London",weekday:"short",day:"numeric",month:"short",year:"numeric"}).format(d) : "Date TBC"; };
const ukTime = value => { const d=parseDate(value); return d ? new Intl.DateTimeFormat("en-GB",{timeZone:"Europe/London",hour:"2-digit",minute:"2-digit",hour12:false}).format(d) + " UK" : "Time TBC"; };
const boutDateTime = b => b.start_datetime_utc || (b.date ? b.date + "T" + (b.start_time_utc || "00:00") + ":00Z" : null);
const formatTime = (value, date) => { if (!value) return null; const d=parseDate(value) || parseDate(date ? date + "T" + String(value).slice(0,5) + ":00Z" : null); return d ? ukTime(d) : null; };
function allBouts() {
  return state.events.flatMap(e => (e.bouts || e.fights || []).map(b => ({...b, scheduleName:e.name, eventUrl:e.event_url, eventBroadcasters:e.broadcasters || [], eventPromoter:e.promoter, eventDate:e.date, eventStartTime:e.start_time_utc, eventCountry:e.country, eventCity:e.city, eventLocation:e.location, eventSource:e.data_source})))
    .filter(b => b.fighter1 || b.fighter2 || b.fighter_a || b.fighter_b)
    .sort((a,b) => (parseDate(boutDateTime(a))?.getTime() || 0) - (parseDate(boutDateTime(b))?.getTime() || 0));
}
function showScreen(id) {
  document.querySelectorAll(".screen").forEach(s => s.classList.toggle("active",s.id===id));
  document.querySelectorAll(".nav-item").forEach(b => b.classList.toggle("active",b.dataset.screen===id));
  window.scrollTo({top:0,behavior:"smooth"});
}
document.querySelectorAll(".nav-item").forEach(b => b.addEventListener("click",()=>showScreen(b.dataset.screen)));
function fighterNames(b) {
  return [b.fighter1||b.fighter_a||b.red_corner||b.boxer1||"TBC", b.fighter2||b.fighter_b||b.blue_corner||b.boxer2||"TBC"];
}
function makeBoutRow(b) {
  const row=document.createElement("article");
  row.className="bout-row";
  const [a,c]=fighterNames(b);
  const left=document.createElement("div"); left.className="fighter"; left.textContent=a;
  const vs=document.createElement("div"); vs.className="vs"; vs.textContent="VS";
  const right=document.createElement("div"); right.className="fighter"; right.textContent=c;
  const meta=document.createElement("div"); meta.className="bout-meta";
  const timeLabel = b.start_time_utc ? "FIGHT TIME " + (formatTime(b.start_time_utc,b.date)||"TBC") : (b.eventStartTime ? "CARD START " + (formatTime(b.eventStartTime,b.eventDate)||"TBC") : null);
  const details=[b.weight_class||b.division,b.rounds ? b.rounds+" rounds" : null,b.title_text,b.eventCountry ? "COUNTRY "+b.eventCountry : null,timeLabel].filter(Boolean);
  const detailLine=document.createElement("span");
  detailLine.textContent=details.length ? details.join(" · ") : "Weight division not supplied";
  meta.append(detailLine);
  const broadcast=document.createElement("div"); broadcast.className="broadcast-line";
  const label=document.createElement("span"); label.textContent="WATCH: ";
  broadcast.append(label);
  const channels=(b.eventBroadcasters||[]).map(x=>typeof x==="string"?x:([x.name||x.broadcaster||x.platform,x.region].filter(Boolean).join(" (")+(x.region?")":""))).filter(Boolean);
  const boutChannel=b.broadcaster||b.broadcast||b.tv_channel||null;
  const channel=(boutChannel && typeof boutChannel==="object") ? (boutChannel.name||boutChannel.broadcaster||boutChannel.platform||null) : (boutChannel||channels.join(", ")||null);
  const url=b.broadcast_url||b.broadcaster_url||b.watch_url||null;
  if(channel && url && /^https?:\/\//i.test(url)) {
    const link=document.createElement("a"); link.href=url; link.target="_blank"; link.rel="noopener noreferrer"; link.textContent=channel; broadcast.append(link);
  } else {
    const text=document.createElement("span"); text.textContent=channel || "Broadcast information not announced"; broadcast.append(text);
    if(url && /^https?:\/\//i.test(url)) { const link=document.createElement("a"); link.href=url; link.target="_blank"; link.rel="noopener noreferrer"; link.textContent="Watch details"; broadcast.append(" · ",link); }
  }
  if(b.eventUrl && /^https?:\/\//i.test(b.eventUrl)) { const link=document.createElement("a"); link.href=b.eventUrl; link.target="_blank"; link.rel="noopener noreferrer"; link.textContent="Event details"; broadcast.append(" · ",link); }
  meta.append(document.createElement("br"),broadcast);
  row.append(left,vs,right,meta);
  return row;
}
function eventDateKey(event) {
  const raw = event.date || event.bouts?.[0]?.date;
  if (!raw) return "";
  return /^\d{4}-\d{2}-\d{2}$/.test(String(raw)) ? String(raw) : ukKey(raw);
}
function eventBouts(event) {
  const bouts=(event.bouts||event.fights||[]).map(b=>({
    ...b,
    eventUrl:event.event_url||event.url,
    eventBroadcasters:event.broadcasters||[],
    eventPromoter:event.promoter,
    eventStartTime:event.start_time_utc,
    eventDate:event.date,
    eventCountry:event.country,
    eventCity:event.city,
    eventLocation:event.location
  }));
  bouts.forEach(b=>{
    const [one,two]=fighterNames(b);
    if(/joshua buatsi/i.test(one)&&/willy hutchinson/i.test(two)){
      const first=b.fighter1; b.fighter1=b.fighter2; b.fighter2=first;
      const record=b.record1; b.record1=b.record2; b.record2=record;
    }
  });
  return bouts.sort((x,y)=>{
    const xt=x.title_text?1:0, yt=y.title_text?1:0;
    if(xt!==yt)return yt-xt;
    return (Number(y.rounds)||0)-(Number(x.rounds)||0);
  });
}
function countryName(value) {
  if (!value) return null;
  const map={GB:"United Kingdom",UK:"United Kingdom",US:"United States",JP:"Japan",VE:"Venezuela",TR:"Türkiye",MX:"Mexico",SA:"Saudi Arabia",CA:"Canada",ES:"Spain",FR:"France",AU:"Australia",DE:"Germany"};
  return map[String(value).toUpperCase()]||value;
}
function eventTitle(event,bouts) {
  if (event.name && !/^(boxing event|mr event)$/i.test(event.name)) return event.name;
  const headline=bouts.find(b=>b.title_text)||bouts[0];
  if (headline) return fighterNames(headline).join(" vs ");
  return event.city ? event.city+" boxing event" : "Boxing event";
}
function renderEventCard(event, expanded=false) {
  const bouts=eventBouts(event);
  const details=document.createElement("details");
  details.className="fight-card-accordion";
  details.open=expanded;
  const summary=document.createElement("summary");
  summary.className="event-card fight-card-summary";
  const dateValue=event.date||bouts[0]?.date;
  const date=parseDate(dateValue);
  const dateBox=document.createElement("div");dateBox.className="event-date";
  const day=document.createElement("strong");day.textContent=date?new Intl.DateTimeFormat("en-GB",{timeZone:"Europe/London",day:"2-digit"}).format(date):"—";
  const month=document.createElement("span");month.textContent=date?new Intl.DateTimeFormat("en-GB",{timeZone:"Europe/London",month:"short"}).format(date).toUpperCase():"DATE";
  dateBox.append(day,month);
  const info=document.createElement("div");info.className="event-info";
  const title=document.createElement("h3");title.textContent=eventTitle(event,bouts);
  const country=countryName(event.country||event.country_code);
  const desc=document.createElement("p");
  const countLabel=event.source_note?"Additional bouts · card not confirmed":bouts.length+" bouts on this card";
  desc.textContent=[countLabel,event.city,country].filter(Boolean).join(" · ");
  info.append(title,desc);
  const tag=document.createElement("div");tag.className="event-tag";
  const cardStart=formatTime(event.start_time_utc,event.date);
  const firstTime=bouts.find(x=>x.start_time_utc);
  tag.textContent=cardStart?"CARD "+cardStart:(firstTime?"FIRST BOUT "+formatTime(firstTime.start_time_utc,firstTime.date):"TIME TBC");
  summary.append(dateBox,info,tag);
  details.append(summary);
  const panel=document.createElement("div");panel.className="fight-card-details";
  const meta=document.createElement("div");meta.className="fight-card-meta";
  const metaBits=[];
  if(country)metaBits.push("COUNTRY: "+country);
  if(event.promoter)metaBits.push("PROMOTER: "+event.promoter);
  if(cardStart)metaBits.push("CARD START: "+cardStart);
  const channels=(event.broadcasters||[]).map(x=>typeof x==="string"?x:(x.name||x.broadcaster||x.platform||x.service||"")).filter(Boolean);
  if(channels.length)metaBits.push("WATCH: "+channels.join(", "));
  meta.textContent=metaBits.join(" · ")||"Full card details below";
  panel.append(meta);
  const list=document.createElement("div");list.className="bout-list";
  if(bouts.length)bouts.forEach(b=>list.append(makeBoutRow(b)));
  else {const empty=document.createElement("p");empty.className="muted-note";empty.textContent="No individual bouts have been confirmed for this event yet.";list.append(empty);}
  panel.append(list);
  const sourceUrl=event.event_url||event.url;
  if(sourceUrl&&/^https?:\/\//i.test(sourceUrl)){const link=document.createElement("a");link.href=sourceUrl;link.target="_blank";link.rel="noopener noreferrer";link.className="event-source-link";link.textContent="View original event details ↗";panel.append(link);}
  details.append(panel);
  return details;
}
function eventsForDate(key) {
  return state.events.filter(e=>eventDateKey(e)===key && (e.bouts||e.fights||[]).length);
}
function renderTonight() {
  const key=todayKey();
  const date=new Intl.DateTimeFormat("en-GB",{timeZone:"Europe/London",weekday:"long",day:"numeric",month:"long"}).format(new Date());
  $("today-date-label").textContent=date;
  const root=$("tonight-bouts");root.replaceChildren();
  const events=eventsForDate(key);
  if(!events.length)root.innerHTML='<div class="muted-note">No fight cards are listed for today in the current schedule.</div>';
  else events.forEach(e=>root.append(renderEventCard(e,false)));
  const button=$("today-date-button");
  button.setAttribute("aria-expanded",String(!root.hidden));
  button.onclick=()=>{root.hidden=!root.hidden;button.setAttribute("aria-expanded",String(!root.hidden));button.querySelector("strong").textContent=root.hidden?"VIEW FIGHT CARDS ↓":"HIDE FIGHT CARDS ↑";};
}
function renderHome() {
  const nowKey=todayKey();
  const upcoming=state.events.filter(e=>eventDateKey(e)>=nowKey&&(e.bouts||e.fights||[]).length).sort((a,b)=>eventDateKey(a).localeCompare(eventDateKey(b)));
  $("event-count").textContent=upcoming.length+" CARDS";
  const list=$("next-events");list.replaceChildren();
  if(!upcoming.length)list.innerHTML='<div class="empty-state"><span class="empty-icon">🥊</span><h3>No upcoming cards listed</h3><p>The schedule will update automatically as new fights are published.</p></div>';
  else upcoming.slice(0,8).forEach(event=>{const card=renderEventCard(event,false);list.append(card);});
  const headlines=$("headline-bouts");headlines.replaceChildren();
  const upcomingBouts=allBouts().filter(b=>ukKey(boutDateTime(b))>=nowKey&&b.title_text).slice(0,5);
  if(!upcomingBouts.length)headlines.innerHTML='<div class="muted-note">Headline bouts will appear here when confirmed title-fight details are available.</div>';
  else upcomingBouts.forEach(b=>headlines.append(makeBoutRow(b)));
  renderTonight();
}
function renderCalendar() {
  const y=state.month.getFullYear(),m=state.month.getMonth();
  $("month-label").textContent=state.month.toLocaleDateString("en-GB",{month:"long",year:"numeric"});
  const first=new Date(y,m,1),offset=(first.getDay()+6)%7,start=new Date(y,m,1-offset);
  const grid=$("calendar-grid");grid.replaceChildren();
  const today=todayKey(),fightDates=new Set(groupBoutsByUkDate(allBouts()).keys());
  for(let i=0;i<42;i++){
    const d=new Date(start);d.setDate(start.getDate()+i);const key=dateKey(d);
    const btn=document.createElement("button");btn.className="day";btn.textContent=d.getDate();
    if(d.getMonth()!==m)btn.classList.add("outside");if(key===today)btn.classList.add("today");
    if(fightDates.has(key))btn.classList.add("has-event");if(key===ukKey(state.selected))btn.classList.add("selected");
    btn.addEventListener("click",()=>{state.selected=d;renderCalendar();renderSelectedDate();});grid.append(btn);
  }
  renderSelectedDate();
}
function renderSelectedDate() {
  const key=dateKey(state.selected);
  $("selected-date-label").textContent=state.selected.toLocaleDateString("en-GB",{weekday:"long",day:"numeric",month:"long"});
  const root=$("selected-date-events");root.replaceChildren();
  const events=eventsForDate(key);
  if(!events.length)root.innerHTML='<div class="muted-note">No fight cards listed for this date.</div>';
  else events.forEach(e=>root.append(renderEventCard(e,false)));
}
function renderCards() {
  const root=$("full-cards");root.replaceChildren();
  const events=[...state.events].filter(e=>(e.bouts||e.fights||[]).length).sort((a,b)=>eventDateKey(a).localeCompare(eventDateKey(b)));
  if(!events.length){root.innerHTML='<div class="empty-state"><span class="empty-icon">📋</span><h3>No fight cards loaded</h3><p>Scheduled event cards will appear here as providers publish confirmed details.</p></div>';return;}
  const byDate=new Map();
  events.forEach(event=>{const key=eventDateKey(event);if(!byDate.has(key))byDate.set(key,[]);byDate.get(key).push(event);});
  for(const [key,dayEvents] of byDate){
    const section=document.createElement("section");section.className="fight-date-section";
    const heading=document.createElement("div");heading.className="section-heading compact";
    const title=document.createElement("h2");title.textContent=ukDate(key+"T12:00:00Z")+" · "+dayEvents.length+" "+(dayEvents.length===1?"CARD":"CARDS");
    heading.append(title);section.append(heading);
    const list=document.createElement("div");list.className="event-list";
    dayEvents.forEach(event=>list.append(renderEventCard(event,false)));
    section.append(list);root.append(section);
  }
}
async function loadData() {
  try {
    const res=await fetch(DATA_URL+"?t="+Date.now(),{cache:"no-store"});
    if(!res.ok)throw new Error("Data feed unavailable");
    const data=await res.json();state.events=Array.isArray(data.events)?data.events:[];
    if(data.last_updated)$("home-updated").textContent="DATA UPDATED "+new Intl.DateTimeFormat("en-GB",{timeZone:"Europe/London",dateStyle:"medium",timeStyle:"short"}).format(new Date(data.last_updated));
    else $("home-updated").textContent="AWAITING DATA SYNC";
    $("refresh-help").textContent="Schedule snapshot loaded. Use Update fight data to run a fresh API sync.";
  } catch(e) {
    $("home-updated").textContent="DATA FEED NOT CONNECTED";
    $("refresh-help").textContent="Could not load the latest published schedule.";
  }
  renderHome();renderCalendar();renderCards();
}
$("manual-refresh").addEventListener("click",async()=>{
  const button=$("manual-refresh");
  if(button.dataset.stage==="reload"){
    button.disabled=true;button.textContent="↻ Loading schedule…";
    await loadData();button.dataset.stage="";button.disabled=false;button.textContent="↻ Update fight data";return;
  }
  window.open(ACTIONS_URL,"_blank","noopener");
  button.dataset.stage="reload";button.textContent="↻ Reload latest schedule";
  $("refresh-help").textContent="In GitHub Actions, open “Refresh boxing schedule” and tap “Run workflow”. Return here and tap Reload latest schedule.";
});
document.addEventListener("visibilitychange",()=>{if(!document.hidden && $("manual-refresh").dataset.stage==="reload")$("refresh-help").textContent="When the GitHub Actions run finishes, tap Reload latest schedule.";});
$("prev-month").addEventListener("click",()=>{state.month.setMonth(state.month.getMonth()-1);renderCalendar();});
$("next-month").addEventListener("click",()=>{state.month.setMonth(state.month.getMonth()+1);renderCalendar();});
loadData();setInterval(loadData,5*60*1000);
if("serviceWorker" in navigator && location.protocol.startsWith("http"))navigator.serviceWorker.register("./sw.js").catch(()=>{});
