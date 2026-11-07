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
const boutDateTime = b => b.start_datetime_utc || (b.date ? `${b.date}T${b.start_time_utc || "00:00"}:00Z` : null);
function allBouts() {
  return state.events.flatMap(e => (e.bouts || e.fights || []).map(b => ({...b, scheduleName:e.name, eventUrl:e.event_url, eventBroadcasters:e.broadcasters || [], eventPromoter:e.promoter, eventDate:e.date, eventSource:e.data_source})))
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
  const details=[b.weight_class||b.division,b.rounds ? b.rounds+" rounds" : null,b.title_text].filter(Boolean);
  const detailLine=document.createElement("span");
  detailLine.textContent=details.length ? details.join(" · ") : "Weight division not supplied";
  meta.append(detailLine);
  const broadcast=document.createElement("div"); broadcast.className="broadcast-line";
  const label=document.createElement("span"); label.textContent="WATCH: ";
  broadcast.append(label);
  const channels=(b.eventBroadcasters||[]).map(x=>typeof x==="string"?x:(x.name||x.broadcaster||x.platform)).filter(Boolean);
  const channel=b.broadcaster||b.broadcast||b.tv_channel||channels.join(", ")||null;
  const url=b.broadcast_url||b.broadcaster_url||b.watch_url||null;
  if(channel && url && /^https?:\\/\\//i.test(url)) {
    const link=document.createElement("a"); link.href=url; link.target="_blank"; link.rel="noopener noreferrer"; link.textContent=channel; broadcast.append(link);
  } else {
    const text=document.createElement("span"); text.textContent=channel || "Broadcast information not announced"; broadcast.append(text);
    if(url && /^https?:\\/\\//i.test(url)) { const link=document.createElement("a"); link.href=url; link.target="_blank"; link.rel="noopener noreferrer"; link.textContent="Watch details"; broadcast.append(" · ",link); }
  }
  if(b.eventUrl && /^https?:\\/\\//i.test(b.eventUrl)) { const link=document.createElement("a"); link.href=b.eventUrl; link.target="_blank"; link.rel="noopener noreferrer"; link.textContent="Event details"; broadcast.append(" · ",link); }
  meta.append(document.createElement("br"),broadcast);
  row.append(left,vs,right,meta);
  return row;
}
function dateCard(key,bouts) {
  const d=parseDate(boutDateTime(bouts[0]));
  const card=document.createElement("article"); card.className="event-card date-card";
  const date=document.createElement("div"); date.className="event-date";
  const strong=document.createElement("strong"); strong.textContent=d ? new Intl.DateTimeFormat("en-GB",{timeZone:"Europe/London",day:"2-digit"}).format(d) : "—";
  const month=document.createElement("span"); month.textContent=d ? new Intl.DateTimeFormat("en-GB",{timeZone:"Europe/London",month:"short"}).format(d).toUpperCase() : "DATE";
  date.append(strong,month);
  const info=document.createElement("div"); info.className="event-info";
  const title=document.createElement("h3"); title.textContent=ukDate(d||key);
  const desc=document.createElement("p"); desc.textContent=`${bouts.length} scheduled ${bouts.length===1?"bout":"bouts"}`;
  info.append(title,desc);
  const tag=document.createElement("div"); tag.className="event-tag"; tag.textContent=bouts[0]?.start_time_utc ? "FIRST BOUT "+ukTime(boutDateTime(bouts[0])) : "TIME TBC";
  card.append(date,info,tag);
  return card;
}
function groupBoutsByUkDate(bouts) {
  const map=new Map();
  bouts.forEach(b=>{const key=ukKey(boutDateTime(b));if(!key)return;if(!map.has(key))map.set(key,[]);map.get(key).push(b);});
  return map;
}
function renderTonight() {
  const key=todayKey();
  const date=new Intl.DateTimeFormat("en-GB",{timeZone:"Europe/London",weekday:"long",day:"numeric",month:"long"}).format(new Date());
  $("today-date-label").textContent=date;
  const matches=allBouts().filter(b=>ukKey(boutDateTime(b))===key);
  const root=$("tonight-bouts"); root.replaceChildren();
  if(!matches.length) root.innerHTML='<div class="muted-note">No fights are listed for today in the current schedule.</div>';
  else matches.forEach(b=>root.append(makeBoutRow(b)));
  const button=$("today-date-button");
  button.setAttribute("aria-expanded",String(!root.hidden));
  button.onclick=()=>{root.hidden=!root.hidden;button.setAttribute("aria-expanded",String(!root.hidden));button.querySelector("strong").textContent=root.hidden?"VIEW FIGHTS ↓":"HIDE FIGHTS ↑";};
}
function renderHome() {
  const nowKey=todayKey();
  const grouped=groupBoutsByUkDate(allBouts());
  const upcoming=[...grouped.entries()].filter(([key])=>key>=nowKey);
  $("event-count").textContent=`${upcoming.length} DATES`;
  const list=$("next-events");list.replaceChildren();
  if(!upcoming.length) list.innerHTML='<div class="empty-state"><span class="empty-icon">🥊</span><h3>No upcoming bouts listed</h3><p>The schedule will update automatically as new bouts are published.</p></div>';
  else upcoming.slice(0,8).forEach(([key,bouts])=>{const card=dateCard(key,bouts);card.addEventListener("click",()=>{state.selected=parseDate(boutDateTime(bouts[0]))||new Date(key+"T12:00:00");state.month=new Date(state.selected.getFullYear(),state.selected.getMonth(),1);showScreen("calendar-screen");renderCalendar();});list.append(card);});
  const headlines=$("headline-bouts");headlines.replaceChildren();
  const upcomingBouts=allBouts().filter(b=>ukKey(boutDateTime(b))>=nowKey).slice(0,5);
  if(!upcomingBouts.length) headlines.innerHTML='<div class="muted-note">Headline bouts will appear here when scheduled fights are available.</div>';
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
  const matches=allBouts().filter(b=>ukKey(boutDateTime(b))===key);
  const root=$("selected-date-events");root.replaceChildren();
  if(!matches.length)root.innerHTML='<div class="muted-note">No fights listed for this date.</div>';
  else matches.forEach(b=>root.append(makeBoutRow(b)));
}
function renderCards() {
  const root=$("full-cards");root.replaceChildren();
  const events=[...state.events].sort((a,b)=>(parseDate(a.date)?.getTime()||0)-(parseDate(b.date)?.getTime()||0));
  if(!events.length){root.innerHTML='<div class="empty-state"><span class="empty-icon">📋</span><h3>No fights loaded</h3><p>Scheduled bouts will appear here as the data provider publishes them.</p></div>';return;}
  for(const event of events){
    const bouts=(event.bouts||event.fights||[]).map(b=>({...b,eventUrl:event.event_url,eventBroadcasters:event.broadcasters||[],eventPromoter:event.promoter}));
    if(!bouts.length) continue;
    const section=document.createElement("section");section.className="fight-date-section";
    const heading=document.createElement("div");heading.className="section-heading compact";
    const title=document.createElement("h2");title.textContent=(event.name||"Boxing event")+" · "+ukDate(event.date||boutDateTime(bouts[0]));
    heading.append(title);section.append(heading);
    if(event.promoter){const promoter=document.createElement("p");promoter.className="muted-note";promoter.textContent="Promoter: "+event.promoter;section.append(promoter);}
    const list=document.createElement("div");list.className="bout-list";bouts.forEach(b=>list.append(makeBoutRow(b)));
    section.append(list);
    if(event.event_url && /^https?:\\/\\//i.test(event.event_url)){const link=document.createElement("a");link.href=event.event_url;link.target="_blank";link.rel="noopener noreferrer";link.className="event-source-link";link.textContent="View event on Boxerbook ↗";section.append(link);}
    root.append(section);
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
