const DATA_URL = "./data/fights.json";
const state = { events: [], fighterImages: {}, lastUpdated: null, lastChecked: null, month: new Date(new Date().getFullYear(), new Date().getMonth(), 1), selected: new Date() };
const $ = id => document.getElementById(id);
function formatAge(date) {
  if(!date)return "unavailable";
  const elapsed=Math.max(0,Date.now()-date.getTime());
  const minutes=Math.floor(elapsed/60000);
  if(minutes<1)return "just now";
  if(minutes<60)return minutes+"m ago";
  const hours=Math.floor(minutes/60),remaining=minutes%60;
  if(hours<24)return hours+"h"+(remaining?" "+remaining+"m":"")+" ago";
  const days=Math.floor(hours/24),left=hours%24;
  return days+"d"+(left?" "+left+"h":"")+" ago";
}
function syncAgeLabel() {
  const button=$("manual-refresh");
  if(!button)return;
  const age=formatAge(state.lastChecked);
  button.textContent="CHECKED: "+age;
  const lastSync=state.lastUpdated?new Intl.DateTimeFormat("en-GB",{timeZone:"Europe/London",dateStyle:"medium",timeStyle:"short"}).format(state.lastUpdated):"not available";
  button.setAttribute("aria-label","Last checked "+age+". Last successful data sync: "+lastSync+". Tap to check for newly published data.");
}
function refreshHelpMessage() {
  const checked=state.lastChecked?new Intl.DateTimeFormat("en-GB",{timeZone:"Europe/London",hour:"2-digit",minute:"2-digit"}).format(state.lastChecked):"—";
  const synced=state.lastUpdated?new Intl.DateTimeFormat("en-GB",{timeZone:"Europe/London",dateStyle:"medium",timeStyle:"short"}).format(state.lastUpdated):"not available";
  $("refresh-help").textContent="Checked "+checked+" UK time · Last data sync: "+synced+". New data is published automatically every 4 hours.";
}

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
  document.querySelectorAll(".nav-item").forEach(b => b.classList.toggle("active",b.dataset.screen===id || (id==="sport-detail-screen"&&b.dataset.screen==="home-screen")));
  window.scrollTo({top:0,behavior:window.matchMedia("(prefers-reduced-motion: reduce)").matches?"auto":"smooth"});
}
window.showScreen=showScreen;
document.querySelectorAll(".nav-item").forEach(b => b.addEventListener("click",()=>showScreen(b.dataset.screen)));
function fighterNames(b) {
  return [b.fighter1||b.fighter_a||b.red_corner||b.boxer1||"TBC", b.fighter2||b.fighter_b||b.blue_corner||b.boxer2||"TBC"];
}
function isUkRegion(region) {
  const value=String(region||"").trim().toLowerCase().replace(/[_-]/g," ");
  return /^(uk|gb|great britain|united kingdom|worldwide|world|global|all markets)$/.test(value)
    || /(?:^|[^a-z])(united kingdom|great britain|uk)(?:$|[^a-z])/i.test(value);
}
function ukBroadcasters(items) {
  const seen=new Set();
  return (items||[]).filter(item=>item&&typeof item==="object"&&isUkRegion(item.region||item.country||item.market))
    .map(item=>item.name||item.broadcaster||item.platform||item.service||"")
    .filter(name=>name&&!seen.has(name)&&(seen.add(name),true));
}

function ukBroadcasterLogos(items) {
  const names=ukBroadcasters(items);
  const seen=new Set();
  const registry=[
    {id:"dazn",match:/\bdazn\b/i,file:"DAZN_LOGO_SVG.svg",page:"https://commons.wikimedia.org/wiki/File:DAZN_LOGO_SVG.svg"},
    {id:"sky-sports",match:/\bsky\b/i,file:"Sky_Sports_2026.svg",page:"https://commons.wikimedia.org/wiki/File:Sky_Sports_2026.svg"},
    {id:"tnt-sports",match:/\btnt\s*sports\b/i,file:"TNT_Sports_(2023).svg",page:"https://commons.wikimedia.org/wiki/File:TNT_Sports_(2023).svg"},
    {id:"espn",match:/\bespn(?:\+|\b)/i,file:"ESPN_wordmark.svg",page:"https://commons.wikimedia.org/wiki/File:ESPN_wordmark.svg"},
    {id:"paramount",match:/\bparamount\s*\+/i,file:"Paramount%2B_logo.svg",page:"https://commons.wikimedia.org/wiki/File:Paramount%2B_logo.svg"},
    {id:"bbc",match:/\bbbc(?:\s*(?:one|two|three|four|iplayer))?\b/i,file:"BBC_Logo_2021.svg",page:"https://commons.wikimedia.org/wiki/File:BBC_Logo_2021.svg"},
    {id:"itv",match:/\bitv\b/i,file:"ITV_logo.svg",page:"https://commons.wikimedia.org/wiki/File:ITV_logo.svg"},
    {id:"youtube",match:/\byoutube\b/i,file:"YouTube_full-color_icon_(2017).svg",page:"https://commons.wikimedia.org/wiki/File:YouTube_full-color_icon_(2017).svg"},
    {id:"channel-4",match:/\bchannel\s*4\b/i,file:"Channel_4_2022.svg",page:"https://commons.wikimedia.org/wiki/File:Channel_4_2022.svg"}
  ];
  const group=document.createElement("div");
  group.className="uk-broadcaster-logos";
  group.setAttribute("aria-label","Confirmed UK broadcasters");
  names.forEach(name=>{
    const value=String(name).trim();
    const entry=registry.find(item=>item.match.test(value));
    const key=entry?entry.id:value.toLowerCase();
    if(seen.has(key))return;
    seen.add(key);
    if(entry){
      const link=document.createElement("a");
      link.className="uk-broadcaster-logo";
      link.href=entry.page;link.target="_blank";link.rel="noopener noreferrer";
      link.title=value+" — logo source and details";
      link.setAttribute("aria-label",value);
      const img=document.createElement("img");
      img.src="https://commons.wikimedia.org/wiki/Special:Redirect/file/"+entry.file;
      img.alt=value+" logo";img.loading="lazy";img.decoding="async";
      img.onerror=()=>{link.replaceWith(document.createTextNode(value));};
      link.append(img);group.append(link);
    } else {
      const label=document.createElement("span");
      label.className="uk-broadcaster-text";
      label.textContent=value;label.title=value;
      group.append(label);
    }
  });
  return group.childNodes.length?group:null;
}

function normaliseFighterKey(value) {
  return String(value||"").normalize("NFKD").replace(/\p{Diacritic}/gu,"").toLowerCase().replace(/[^a-z0-9]+/g," ").trim();
}
function fighterPortrait(name, imageUrl) {
  const wrap=document.createElement("div");wrap.className="fighter-portrait";
  const initials=String(name||"?").trim().split(/\s+/).slice(0,2).map(part=>part[0]||"").join("").toUpperCase();
  const fallback=document.createElement("span");fallback.className="portrait-fallback";fallback.textContent=initials||"?";
  wrap.append(fallback);
  const photo=state.fighterImages[normaliseFighterKey(name)]||{};
  const src=imageUrl||photo.url;
  if(src && (/^https:\/\//i.test(src) || String(src).startsWith("./assets/images/"))){
    const img=document.createElement("img");img.src=src;img.alt=name+" portrait";img.loading="lazy";
    img.onerror=()=>{img.remove();const credit=wrap.querySelector(".portrait-credit");if(credit)credit.remove();};
    wrap.append(img);
    if(photo.page_url){
      const credit=document.createElement("a");credit.className="portrait-credit";credit.href=photo.page_url;credit.target="_blank";credit.rel="noopener noreferrer";
      credit.textContent="©";credit.setAttribute("aria-label","Photo credit: "+(photo.artist||"See source file")+". Licence: "+(photo.license||"see source file"));
      credit.title="Photo: "+(photo.artist||"See source file")+" · "+(photo.license||"Licence details")+" — open source and licence";
      wrap.append(credit);
    }
  }
  return wrap;
}
function countryCode(value) {
  const raw=String(value||"").trim().toLowerCase();
  const map={"united kingdom":"GB","great britain":"GB","britain":"GB","british":"GB","england":"GB","scotland":"GB","wales":"GB","northern ireland":"GB","gb":"GB","gbr":"GB","uk":"GB","united kingdom of great britain and northern ireland":"GB"};
  return map[raw]||String(value||"").trim().toUpperCase();
}

function nationalityFlag(value) {
  const raw=String(value||"").trim();
  if(!raw)return null;
  const key=raw.toLowerCase().replace(/[._-]/g," ").replace(/\s+/g," ").trim();
  const names={
    "united kingdom":"GB","great britain":"GB","britain":"GB","british":"GB","england":"GB","scotland":"GB","wales":"GB","northern ireland":"GB","uk":"GB","gbr":"GB",
    "united states":"US","united states of america":"US","usa":"US","america":"US","u s a":"US",
    "mexico":"MX","japan":"JP","venezuela":"VE","turkey":"TR","türkiye":"TR","canada":"CA","spain":"ES","france":"FR","australia":"AU","germany":"DE","ireland":"IE","italy":"IT","ukraine":"UA","russia":"RU","poland":"PL","kazakhstan":"KZ","uzbekistan":"UZ","philippines":"PH","thailand":"TH","south korea":"KR","korea":"KR","china":"CN","cuba":"CU","puerto rico":"PR","dominican republic":"DO","argentina":"AR","brazil":"BR","colombia":"CO","nicaragua":"NI","panama":"PA","south africa":"ZA","nigeria":"NG","ghana":"GH","cameroon":"CM","morocco":"MA","sweden":"SE","denmark":"DK","netherlands":"NL","belgium":"BE","switzerland":"CH","new zealand":"NZ","portugal":"PT","romania":"RO","serbia":"RS","croatia":"HR","czech republic":"CZ","czechia":"CZ","hungary":"HU","greece":"GR","israel":"IL","armenia":"AM","georgia":"GE","azerbaijan":"AZ","mongolia":"MN","indonesia":"ID","india":"IN","peru":"PE","chile":"CL","ecuador":"EC","haiti":"HT","jamaica":"JM"
  };
  const alpha3={GBR:"GB",USA:"US",MEX:"MX",JPN:"JP",VEN:"VE",TUR:"TR",CAN:"CA",ESP:"ES",FRA:"FR",AUS:"AU",DEU:"DE",IRL:"IE",ITA:"IT",UKR:"UA",RUS:"RU",POL:"PL",KAZ:"KZ",UZB:"UZ",PHL:"PH",THA:"TH",KOR:"KR",CHN:"CN",CUB:"CU",PRI:"PR",DOM:"DO",ARG:"AR",BRA:"BR",COL:"CO",NIC:"NI",PAN:"PA",ZAF:"ZA",NGA:"NG",GHA:"GH",CMR:"CM",MAR:"MA",SWE:"SE",DNK:"DK",NLD:"NL",BEL:"BE",CHE:"CH",NZL:"NZ",PRT:"PT",ROU:"RO",SRB:"RS",HRV:"HR",CZE:"CZ",HUN:"HU",GRC:"GR",ISR:"IL",ARM:"AM",GEO:"GE",AZE:"AZ",MNG:"MN",IDN:"ID",IND:"IN",PER:"PE",CHL:"CL",ECU:"EC",HTI:"HT",JAM:"JM"};
  const code=names[key]||alpha3[raw.toUpperCase()]||( /^[A-Za-z]{2}$/.test(raw) ? raw.toUpperCase() : null);
  if(!code||!/^[A-Z]{2}$/.test(code))return null;
  return {code,emoji:String.fromCodePoint(...[...code].map(ch=>127397+ch.charCodeAt(0)))};
}
function appendFighterName(container,name,nationality) {
  container.replaceChildren();
  const flag=nationalityFlag(nationality);
  if(flag){const icon=document.createElement("span");icon.className="nationality-flag";icon.textContent=flag.emoji;icon.title=countryName(flag.code)||flag.code;icon.setAttribute("aria-label",icon.title+" flag");container.append(icon);}
  container.append(fighterPortrait(name));
  const label=document.createElement("span");label.className="fighter-name";label.textContent=name;container.append(label);
}

function isUkFighter(bout,side) {
  const value=bout[side+"_nationality"]||bout[side+"_country"]||bout[side+"_country_code"];
  return countryCode(value)==="GB";
}
function ukFighterNames(bout) {
  const names=[];
  const [one,two]=fighterNames(bout);
  if(isUkFighter(bout,"fighter1"))names.push(one);
  if(isUkFighter(bout,"fighter2"))names.push(two);
  return names;
}

const HIGH_PROFILE_BOXERS = ["anthony joshua","tyson fury","oleksandr usyk","canelo alvarez","saul alvarez","terence crawford","naoya inoue","gervonta davis","dmitry bivol","artur beterbiev","shakur stevenson","devin haney","ryan garcia","teofimo lopez","jaron ennis","jake paul","manny pacquiao","floyd mayweather","derek chisora","daniel dubois","fabio wardley","moses itauma","hamzah she raz","conor benn","katie taylor","claressa shields","david benavidez","gilberto ramirez","zhanibek alimkhanuly"];
function isHighProfileBout(bout) {
 const [one,two]=fighterNames(bout);
 const names=[one,two].map(n=>String(n||"").toLowerCase().replace(/\s+/g," ").trim());
 return names.some(n=>HIGH_PROFILE_BOXERS.includes(n));
}
function renderHighProfileFights() {
 const root=$("high-profile-list");if(!root)return;root.replaceChildren();
 const featured=[];
 state.events.forEach(event=>eventBouts(event).filter(isHighProfileBout).forEach(bout=>featured.push({event,bout})));
 const upcoming=featured.filter(x=>eventDateKey(x.event)>=todayKey()).sort((a,b)=>compareEvents(a.event,b.event)).slice(0,8);
 if(!upcoming.length){root.innerHTML='<div class="muted-note">No upcoming high-profile matchups are currently confirmed in the schedule. This section will update as major fights are announced.</div>';return;}
 upcoming.forEach(({event,bout})=>{
  const [one,two]=fighterNames(bout),card=document.createElement("article");card.className="high-profile-card";
  const matchup=document.createElement("div");matchup.className="high-profile-matchup";
  const f1=document.createElement("div");f1.className="high-profile-fighter";f1.append(fighterPortrait(one,bout.fighter1_image||bout.image1||bout.fighter1_photo));const n1=document.createElement("strong");n1.textContent=one;f1.append(n1);
  const vs=document.createElement("span");vs.className="high-profile-vs";vs.textContent="VS";
  const f2=document.createElement("div");f2.className="high-profile-fighter";f2.append(fighterPortrait(two,bout.fighter2_image||bout.image2||bout.fighter2_photo));const n2=document.createElement("strong");n2.textContent=two;f2.append(n2);
  matchup.append(f1,vs,f2);
  const info=document.createElement("div");info.className="high-profile-info";const title=document.createElement("strong");title.textContent=eventTitle(event,eventBouts(event));info.append(title);
  const meta=document.createElement("span");meta.textContent=[ukDate(event.date),bout.weight_class||bout.division,bout.rounds?bout.rounds+" rounds":null,cardStartLabel(event)?"CARD START "+cardStartLabel(event):null].filter(Boolean).join(" · ");info.append(meta);
  const details=document.createElement("details");details.className="high-profile-card-details";const summary=document.createElement("summary");summary.textContent="VIEW EVENT CARD";
  const panel=document.createElement("div");panel.className="bout-list";eventBouts(event).forEach(b=>panel.append(makeBoutRow(b)));details.append(summary,panel);
  card.append(matchup,info,details);root.append(card);
 });
}

function renderUkHeadliners() {
  const root=$("uk-headliners-list");root.replaceChildren();
  const featured=[];
  state.events.forEach(event=>{
    const bouts=eventBouts(event);
    const ukBouts=bouts.filter(isUkBout);
    if(!ukBouts.length)return;
    const headline=ukBouts.find(b=>b.title_text)||ukBouts.slice().sort((a,b)=>(Number(b.rounds)||0)-(Number(a.rounds)||0))[0];
    featured.push({event,bout:headline});
  });
  featured.sort((a,b)=>compareEvents(a.event,b.event));
  const upcoming=featured.filter(({event})=>eventDateKey(event)>=todayKey()).slice(0,6);
  if(!upcoming.length){
    root.innerHTML='<div class="muted-note">No upcoming fights featuring a confirmed UK boxer nationality are currently listed. This section will populate as nationality data is supplied by the boxing data providers.</div>';
    return;
  }
  upcoming.forEach(({event,bout})=>{
    const [one,two]=fighterNames(bout);
    const accordion=document.createElement("details");accordion.className="uk-headliner-accordion";
    const summary=document.createElement("summary");summary.className="uk-headliner-summary";
    const card=document.createElement("div");card.className="uk-headliner-card";
    const broadcasterLogos=ukBroadcasterLogos(event.broadcasters);if(broadcasterLogos){card.classList.add("has-broadcaster-logos");card.append(broadcasterLogos);}
    const matchup=document.createElement("div");matchup.className="uk-headliner-matchup";
    const f1=document.createElement("div");f1.className="uk-headliner-fighter";f1.append(fighterPortrait(one,bout.fighter1_image||bout.image1||bout.fighter1_photo),document.createElement("strong"));
    f1.querySelector("strong").textContent=one;
    const vs=document.createElement("span");vs.className="uk-headliner-vs";vs.textContent="VS";
    const f2=document.createElement("div");f2.className="uk-headliner-fighter";f2.append(fighterPortrait(two,bout.fighter2_image||bout.image2||bout.fighter2_photo),document.createElement("strong"));
    f2.querySelector("strong").textContent=two;
    matchup.append(f1,vs,f2);
    const details=document.createElement("div");details.className="uk-headliner-details";
    const eventName=document.createElement("strong");eventName.textContent=eventTitle(event,bouts);
    const ukNames=ukFighterNames(bout);
    const meta=document.createElement("span");meta.textContent=[ukDate(event.date),bout.weight_class||bout.division,bout.rounds?bout.rounds+" rounds":null,cardStartLabel(event)?"CARD START "+cardStartLabel(event):null,"UK boxer: "+ukNames.join(", ")].filter(Boolean).join(" · ");
    details.append(eventName,meta);
    const status=cardLiveState(event);
    if(status!=="upcoming"){const badge=document.createElement("span");badge.className=status==="live"?"live-badge":"ended-badge";badge.textContent=status==="live"?"● IN PROGRESS":status==="ended"?"EVENT ENDED":status==="cancelled"?"CANCELLED":"POSTPONED";details.append(badge);}
    if(bout.title_text){const title=document.createElement("span");title.className="uk-title-badge";title.textContent=bout.title_text;details.append(title);}
    card.append(matchup,details);summary.append(card);
    const panel=document.createElement("div");panel.className="uk-headliner-expanded";
    const panelMeta=document.createElement("div");panelMeta.className="fight-card-meta";
    const channels=ukBroadcasters(event.broadcasters);
    panelMeta.textContent=[event.promoter?"PROMOTER: "+event.promoter:null,cardStartLabel(event)?"CARD START: "+cardStartLabel(event):null,channels.length?"UK WATCH: "+channels.join(", "):"UK BROADCAST: NOT ANNOUNCED"].filter(Boolean).join(" · ");
    panel.append(panelMeta);
    const list=document.createElement("div");list.className="bout-list";
    bouts.forEach(b=>list.append(makeBoutRow({...b,eventCountry:event.country,eventBroadcasters:event.broadcasters||[],eventUrl:event.event_url||event.url,eventStartTime:event.start_time_utc,eventDate:event.date})));
    panel.append(list);
    const sourceUrl=event.event_url||event.url;
    if(sourceUrl&&/^https?:\/\//i.test(sourceUrl)){const link=document.createElement("a");link.href=sourceUrl;link.target="_blank";link.rel="noopener noreferrer";link.className="event-source-link";link.textContent="View original event details ↗";panel.append(link);}
    accordion.append(summary,panel);root.append(accordion);
  });
}
function isUkBout(bout) {
  return isUkFighter(bout,"fighter1")||isUkFighter(bout,"fighter2");
}
function makeBoutRow(b) {
  const row=document.createElement("article");
  row.className="bout-row";
  const [a,c]=fighterNames(b);
  const left=document.createElement("div"); left.className="fighter"; appendFighterName(left,a,b.fighter1_nationality||b.fighter1_country||b.fighter1_country_code);
  const vs=document.createElement("div"); vs.className="vs"; vs.textContent="VS";
  const right=document.createElement("div"); right.className="fighter"; appendFighterName(right,c,b.fighter2_nationality||b.fighter2_country||b.fighter2_country_code);
  const meta=document.createElement("div"); meta.className="bout-meta";
  const boutTime=b.displayFightTime||b.start_datetime_utc||b.start_time_utc||b.ring_walk_time_utc||b.scheduled_start_utc||b.fight_time_utc||b.start_time||b.ring_walk_time||b.scheduled_time||null;
  const timeLabel=(b.fightTimeEstimated?"EST. FIGHT TIME ":"FIGHT TIME ")+(boutTime?(formatTime(boutTime,b.date)||"TBC"):"TBC");
  const cardTime=b.eventStartTime?"CARD START "+(formatTime(b.eventStartTime,b.eventDate)||"TBC"):null;
  const details=[b.weight_class||b.division,b.rounds ? b.rounds+" rounds" : null,b.title_text,b.eventCountry ? "COUNTRY "+b.eventCountry : null,timeLabel,cardTime].filter(Boolean);
  const detailLine=document.createElement("span");
  detailLine.textContent=details.length ? details.join(" · ") : "Weight division not supplied";
  meta.append(detailLine);
  const broadcast=document.createElement("div"); broadcast.className="broadcast-line";
  const label=document.createElement("span"); label.textContent="UK WATCH: ";
  broadcast.append(label);
  const channels=ukBroadcasters(b.eventBroadcasters);
  const boutChannel=b.broadcaster||b.broadcast||b.tv_channel||null;
  const boutRegion=b.broadcaster_region||b.broadcast_region||(boutChannel&&typeof boutChannel==="object"?(boutChannel.region||boutChannel.country||boutChannel.market):null);
  const boutName=boutChannel&&typeof boutChannel==="object"?(boutChannel.name||boutChannel.broadcaster||boutChannel.platform||null):null;
  const channel=(boutName&&isUkRegion(boutRegion)?boutName:null)||channels.join(", ")||null;
  const url=channel?(b.broadcast_url||b.broadcaster_url||b.watch_url||null):null;
  if(channel && url && /^https?:\/\//i.test(url)) {
    const link=document.createElement("a"); link.href=url; link.target="_blank"; link.rel="noopener noreferrer"; link.textContent=channel; broadcast.append(link);
  } else {
    const text=document.createElement("span"); text.textContent=channel || "UK broadcaster not announced"; broadcast.append(text);
    if(channel && url && /^https?:\/\//i.test(url)) { const link=document.createElement("a"); link.href=url; link.target="_blank"; link.rel="noopener noreferrer"; link.textContent="Watch details"; broadcast.append(" · ",link); }
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
    eventLocation:event.location,
    fighter1_nationality:b.fighter1_nationality||b.fighter1_country||b.fighter1_country_code,
    fighter2_nationality:b.fighter2_nationality||b.fighter2_country||b.fighter2_country_code
  }));
  bouts.forEach(b=>{
    const [one,two]=fighterNames(b);
    if(/willy hutchinson/i.test(one)&&/joshua buatsi/i.test(two)){
      const first=b.fighter1; b.fighter1=b.fighter2; b.fighter2=first;
      const record=b.record1; b.record1=b.record2; b.record2=record;
    }
  });
  const ordered=bouts.sort((x,y)=>{
    const xt=x.title_text?1:0, yt=y.title_text?1:0;
    if(xt!==yt)return yt-xt;
    return (Number(y.rounds)||0)-(Number(x.rounds)||0);
  });
  // Individual ring-walk times are rarely supplied by the event feed. Where
  // only a card start is known, publish clearly-labelled estimates based on
  // bout order, scheduled rounds and typical between-bout intervals.
  const cardStart=parseDate(event.start_time_utc||event.card_start_time_utc||event.event_start_time_utc);
  let elapsedMinutes=15;
  ordered.forEach(b=>{
    const supplied=b.start_datetime_utc||b.start_time_utc||b.ring_walk_time_utc||b.scheduled_start_utc||b.fight_time_utc||b.start_time||b.ring_walk_time||b.scheduled_time;
    if(supplied){b.displayFightTime=supplied;b.fightTimeEstimated=false;}
    else if(cardStart){b.displayFightTime=new Date(cardStart.getTime()+elapsedMinutes*60000).toISOString();b.fightTimeEstimated=true;}
    else {b.displayFightTime=null;b.fightTimeEstimated=false;}
    elapsedMinutes+=(Math.max(4,Number(b.rounds)||6)*3)+8;
  });
  return ordered;
}
function countryName(value) {
  if (!value) return null;
  const map={GB:"United Kingdom",UK:"United Kingdom",US:"United States",JP:"Japan",VE:"Venezuela",TR:"Türkiye",MX:"Mexico",SA:"Saudi Arabia",CA:"Canada",ES:"Spain",FR:"France",AU:"Australia",DE:"Germany"};
  return map[String(value).toUpperCase()]||value;
}
function eventTitle(event,bouts) {
  if (event.name && !/boxing event/i.test(event.name) && !/^mr event$/i.test(event.name)) return event.name;
  const headline=bouts.find(b=>b.title_text)||bouts[0];
  if (headline) return fighterNames(headline).join(" vs ");
  return event.city ? event.city+" boxing event" : "Boxing event";
}
function cardLiveState(event) {
  const explicit=String(event.status||event.event_status||"").toLowerCase().replace(/[ -]/g,"_");
  if(["live","in_progress","ongoing","started"].includes(explicit))return "live";
  if(["cancelled","canceled"].includes(explicit))return "cancelled";
  if(["postponed"].includes(explicit))return "postponed";
  if(["complete","completed","finished","ended"].includes(explicit))return "ended";
  const start=parseDate(event.start_time_utc||event.card_start_time_utc||event.event_start_time_utc);
  if(!start)return "upcoming";
  const elapsed=Date.now()-start.getTime();
  // The schedule feed does not provide reliable live status, so use a five-hour
  // estimated card window. After five hours, mark the event as ended.
  if(elapsed>=0&&elapsed<=5*60*60*1000)return "live";
  return elapsed>5*60*60*1000?"ended":"upcoming";
}
function eventStatusRank(event) {
  return ({live:0,upcoming:1,ended:2,cancelled:3,postponed:4})[cardLiveState(event)] ?? 1;
}
function compareEvents(a,b) {
  const statusOrder=eventStatusRank(a)-eventStatusRank(b);
  if(statusOrder)return statusOrder;
  const dateOrder=eventDateKey(a).localeCompare(eventDateKey(b));
  if(dateOrder)return dateOrder;
  const aUk=/^(GB|UK)$/i.test(a.country||a.country_code||"")?0:1;
  const bUk=/^(GB|UK)$/i.test(b.country||b.country_code||"")?0:1;
  if(aUk!==bUk)return aUk-bUk;
  return String(a.name||"").localeCompare(String(b.name||""));
}
function cardStartLabel(event) {
  const start=event.start_time_utc||event.card_start_time_utc||event.event_start_time_utc;
  return start?formatTime(start,event.date):null;
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
  const cardStart=cardStartLabel(event);
  const liveState=cardLiveState(event);
  const time=document.createElement("span");time.className="card-start-time";time.textContent=cardStart?"CARD START "+cardStart:(bouts.find(x=>x.start_time_utc)?"FIRST BOUT "+formatTime(bouts.find(x=>x.start_time_utc).start_time_utc,bouts.find(x=>x.start_time_utc).date):"START TIME TBC");
  tag.append(time);
  if(liveState!=="upcoming"){const badge=document.createElement("span");badge.className=liveState==="live"?"live-badge":"ended-badge";badge.textContent=liveState==="live"?"● IN PROGRESS":liveState==="ended"?"EVENT ENDED":liveState==="cancelled"?"CANCELLED":"POSTPONED";tag.append(badge);}
  summary.append(dateBox,info,tag);
  details.append(summary);
  const panel=document.createElement("div");panel.className="fight-card-details";
  const meta=document.createElement("div");meta.className="fight-card-meta";
  const metaBits=[];
  if(country)metaBits.push("COUNTRY: "+country);
  if(event.promoter)metaBits.push("PROMOTER: "+event.promoter);
  if(cardStart)metaBits.push("CARD START: "+cardStart);
  const channels=ukBroadcasters(event.broadcasters);
  metaBits.push(channels.length?"UK WATCH: "+channels.join(", "):"UK BROADCAST: NOT ANNOUNCED");
  meta.textContent=metaBits.join(" · ")||"Full card details below";
  panel.append(meta);
  const broadcasterLogos=ukBroadcasterLogos(event.broadcasters);if(broadcasterLogos)panel.append(broadcasterLogos);
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
  return state.events.filter(e=>eventDateKey(e)===key && (e.bouts||e.fights||[]).length).sort(compareEvents);
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
  const upcoming=state.events.filter(e=>eventDateKey(e)>=nowKey&&(e.bouts||e.fights||[]).length).sort(compareEvents);
  $("event-count").textContent=upcoming.length+" CARDS";
  const list=$("next-events");list.replaceChildren();
  if(!upcoming.length)list.innerHTML='<div class="empty-state"><span class="empty-icon">🥊</span><h3>No upcoming cards listed</h3><p>The schedule will update automatically as new fights are published.</p></div>';
  else upcoming.slice(0,8).forEach(event=>{const card=renderEventCard(event,false);list.append(card);});
  const headlines=$("headline-bouts");headlines.replaceChildren();
  const upcomingBouts=allBouts().filter(b=>ukKey(boutDateTime(b))>=nowKey&&b.title_text).slice(0,5);
  if(!upcomingBouts.length)headlines.innerHTML='<div class="muted-note">Headline bouts will appear here when confirmed title-fight details are available.</div>';
  else upcomingBouts.forEach(b=>headlines.append(makeBoutRow(b)));
  renderHighProfileFights();
  renderUkHeadliners();
  renderTonight();
  document.dispatchEvent(new CustomEvent("sports:boxing-data-updated"));
}
function groupBoutsByUkDate(bouts) {
  const groups=new Map();
  for(const bout of bouts||[]){
    const raw=String(bout.date||"");
    const key=/^\d{4}-\d{2}-\d{2}$/.test(raw)?raw:(ukKey(boutDateTime(bout))||"");
    if(!key)continue;
    if(!groups.has(key))groups.set(key,[]);
    groups.get(key).push(bout);
  }
  return groups;
}
function renderCalendar() {
  const y=state.month.getFullYear(),m=state.month.getMonth();
  $("month-label").textContent=state.month.toLocaleDateString("en-GB",{month:"long",year:"numeric"});
  const first=new Date(y,m,1),offset=(first.getDay()+6)%7,start=new Date(y,m,1-offset);
  const grid=$("calendar-grid");grid.replaceChildren();
  const filter=window.SportsData?.getCalendarFilter?.()||"all";
  const today=todayKey(),fightDates=new Set(filter==="all"||filter==="boxing"?groupBoutsByUkDate(allBouts()).keys():[]);
  for(let i=0;i<42;i++){
    const d=new Date(start);d.setDate(start.getDate()+i);const key=dateKey(d);
    const btn=document.createElement("button");btn.className="day";btn.textContent=d.getDate();
    if(d.getMonth()!==m)btn.classList.add("outside");if(key===today)btn.classList.add("today");
    if(fightDates.has(key))btn.classList.add("has-event");if(key===ukKey(state.selected))btn.classList.add("selected");
    btn.addEventListener("click",()=>{state.selected=d;renderCalendar();renderSelectedDate();});grid.append(btn);
  }
  if(window.SportsData?.markCalendarDays)window.SportsData.markCalendarDays(grid,start);
  renderSelectedDate();
}
function renderSelectedDate() {
  const key=dateKey(state.selected);
  $("selected-date-label").textContent=state.selected.toLocaleDateString("en-GB",{weekday:"long",day:"numeric",month:"long"});
  const root=$("selected-date-events");root.replaceChildren();
  const filter=window.SportsData?.getCalendarFilter?.()||"all";
  const events=(filter==="all"||filter==="boxing")?eventsForDate(key):[];
  if(!events.length)root.innerHTML=(filter==="all"||filter==="boxing")?'<div class="muted-note">No boxing cards listed for this date.</div>':"";
  else events.forEach(e=>root.append(renderEventCard(e,false)));
  if(window.SportsData?.renderSelectedDate)window.SportsData.renderSelectedDate(key);
}
function renderCards() {
  const root=$("full-cards");root.replaceChildren();
  const events=[...state.events].filter(e=>(e.bouts||e.fights||[]).length).sort(compareEvents);
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
  if(window.SportsData?.renderEventCards)window.SportsData.renderEventCards();
}
async function loadData() {
  try {
    const res=await fetch(DATA_URL+"?t="+Date.now(),{cache:"no-store"});
    if(!res.ok)throw new Error("Data feed unavailable");
    const data=await res.json();state.events=Array.isArray(data.events)?data.events:[];
    state.lastUpdated=data.last_updated?parseDate(data.last_updated):null;
    syncAgeLabel();
    try { const photos=await fetch("./data/fighter-images.json?t="+Date.now(),{cache:"no-store"}); if(photos.ok){const photoData=await photos.json();state.fighterImages=photoData.images||{};} } catch(_) { state.fighterImages={}; }
    if(data.last_updated)$("home-updated").textContent="LAST DATA SYNC "+new Intl.DateTimeFormat("en-GB",{timeZone:"Europe/London",dateStyle:"medium",timeStyle:"short"}).format(new Date(data.last_updated));
    else $("home-updated").textContent="AWAITING DATA SYNC";
    state.lastChecked=new Date();
    refreshHelpMessage();
  } catch(e) {
    $("home-updated").textContent="DATA FEED NOT CONNECTED";
    state.lastUpdated=null;syncAgeLabel();
    state.lastChecked=new Date();
    $("refresh-help").textContent="Check failed. Could not load the latest published schedule; check your connection and try again.";
  }
  renderHome();renderCalendar();renderCards();
  if(window.SportsData?.renderAll)window.SportsData.renderAll();
}
$("manual-refresh").addEventListener("click",async()=>{
  const button=$("manual-refresh");
  button.disabled=true;
  button.textContent="SYNC: checking…";
  $("refresh-help").textContent="Checking the latest published schedules…";
  await loadData();
  if(window.SportsData?.load)await window.SportsData.load();
  state.lastChecked=new Date();
  refreshHelpMessage();
  button.disabled=false;
  syncAgeLabel();
});
$("prev-month").addEventListener("click",()=>{state.month.setMonth(state.month.getMonth()-1);renderCalendar();});
$("next-month").addEventListener("click",()=>{state.month.setMonth(state.month.getMonth()+1);renderCalendar();});
window.BoxingSchedule={getNextEvent:()=>state.events.filter(e=>eventDateKey(e)>=todayKey()).sort(compareEvents)[0]||null,getEvents:()=>state.events.slice().sort(compareEvents),renderEventCard:(event,expanded=false)=>renderEventCard(event,expanded),getAllBouts:()=>allBouts()};
loadData();setInterval(async()=>{await loadData();if(window.SportsData?.load)await window.SportsData.load();state.lastChecked=new Date();refreshHelpMessage();syncAgeLabel();},5*60*1000);
if("serviceWorker" in navigator && location.protocol.startsWith("http"))navigator.serviceWorker.register("./sw.js").catch(()=>{});

setInterval(()=>{syncAgeLabel();if(document.visibilityState==="visible")renderHome();},60000);
