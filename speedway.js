(() => {
  "use strict";
  const root=()=>document.getElementById("speedway-page-content");
  const state={data:null,tab:"sgp",selectedRider:null,loading:false,error:""};
  const el=(tag,cls,text)=>{const n=document.createElement(tag);if(cls)n.className=cls;if(text!==undefined&&text!==null)n.textContent=text;return n;};
  const todayKey=()=>new Intl.DateTimeFormat("en-CA",{timeZone:"Europe/London"}).format(new Date());
  const dateKey=v=>/^\d{4}-\d{2}-\d{2}$/.test(String(v||""))?String(v):"";
  const dateLabel=v=>{if(!dateKey(v))return "Date TBC";const d=new Date(v+"T12:00:00Z");return new Intl.DateTimeFormat("en-GB",{timeZone:"Europe/London",weekday:"short",day:"numeric",month:"short",year:"numeric"}).format(d);};
  const link=(label,url)=>{const a=el("a","speedway-source-link",label+" ↗");a.href=url;a.target="_blank";a.rel="noopener noreferrer";return a;};
  function panel(title,kicker){const s=el("section","speedway-panel");const h=el("div","speedway-panel-heading");const copy=el("div");if(kicker)copy.append(el("span","eyebrow",kicker));copy.append(el("h2","",title));h.append(copy);s.append(h);return s;}
  function eventCard(event,highlight=false){
    const card=el("article","speedway-event-card"+(highlight?" is-british-gp":""));
    const date=el("div","speedway-event-date");date.append(el("strong","",dateKey(event.date)?String(new Date(event.date+"T12:00:00Z").getUTCDate()).padStart(2,"0"):"TBC"),el("small","",dateKey(event.date)?new Intl.DateTimeFormat("en-GB",{month:"short",timeZone:"UTC"}).format(new Date(event.date+"T12:00:00Z")).toUpperCase():"DATE TBC"));
    const copy=el("div","speedway-event-copy");copy.append(el("small","speedway-event-kicker",event.round?"ROUND "+event.round:event.note||"WORLD TEAM CHAMPIONSHIP"),el("h3","",event.name),el("p","",[event.venue,event.country].filter(Boolean).join(" · ")),el("span","speedway-event-full-date",dateLabel(event.date)));
    if(highlight)copy.append(el("span","speedway-feature-label","BRITISH SPEEDWAY GP"));
    const source=link("FIM event details",event.source_url||"https://fimspeedway.com/");
    card.append(date,copy,source);return card;
  }
  function tabs(){
    const nav=el("div","speedway-tabs");nav.setAttribute("role","tablist");nav.setAttribute("aria-label","Speedway competitions");
    [["sgp","GRAND PRIX"],["son","SPEEDWAY OF NATIONS"],["swc","WORLD CUP"],["riders","RIDERS"]].forEach(([id,label])=>{const b=el("button","speedway-tab"+(state.tab===id?" is-active":""),label);b.type="button";b.setAttribute("role","tab");b.setAttribute("aria-selected",String(state.tab===id));b.setAttribute("aria-controls","speedway-tab-content");b.addEventListener("click",()=>{state.tab=id;state.selectedRider=null;render();});nav.append(b);});
    return nav;
  }
  function renderSgp(target){
    const c=state.data.competitions.sgp,events=c.events||[];
    const hero=panel("2027 Speedway Grand Prix","INDIVIDUAL WORLD CHAMPIONSHIP");
    hero.append(el("p","speedway-section-intro","The main individual world championship, with every published round, results archive and the current world-title standings."));
    const next=events.filter(e=>dateKey(e.date)&&e.date>=todayKey()).sort((a,b)=>a.date.localeCompare(b.date))[0];
    const nextCard=el("div","speedway-next-card");nextCard.append(el("small","eyebrow","NEXT PUBLISHED ROUND"),el("strong","",next?next.name:"2027 season"),el("span","",next?dateLabel(next.date)+" · "+next.venue:"The 2027 calendar is published; event dates are listed below."));hero.append(nextCard);
    target.append(hero);
    const british=events.find(e=>e.british_gp);
    if(british){const feature=panel("British Speedway GP","FEATURED ROUND");feature.append(eventCard(british,true),el("p","speedway-section-note","The 2027 British Grand Prix moves to Foxhall Stadium in Ipswich on 14 August. The British round is highlighted here and remains part of the main SGP championship."));target.append(feature);}
    const list=panel("2027 race calendar","11 ROUNDS · OFFICIAL FIM CALENDAR");
    events.forEach(e=>list.append(eventCard(e,!!e.british_gp)));target.append(list);
    const standings=panel("2026 world championship","FINAL RIDER STANDINGS");
    const top=c.previousSeason;const summary=el("div","speedway-champion-summary");summary.append(el("strong","",top.champion),el("span","",top.champion_points+" points · World Champion"),el("small","",top.runner_up+" · "+top.runner_up_points+" pts  |  "+top.third+" · "+top.third_points+" pts"));standings.append(summary,link("Full official FIM standings",state.data.riderStandings.source_url));target.append(standings);
    target.append(link("Official Speedway GP calendar & results",state.data.sources.grandPrix));
  }
  function renderSon(target){
    const c=state.data.competitions.son,s=panel("Speedway of Nations","NATIONAL TEAM WORLD CHAMPIONSHIP");
    s.append(el("p","speedway-section-intro","The senior Speedway of Nations final and the under-21 SON2 event. Team line-ups will appear here once the FIM publishes them."));
    (c.events||[]).forEach(e=>s.append(eventCard(e)));
    s.append(el("div","speedway-status-note", "2027 team line-ups: "+c.lineups_status+"."));
    s.append(link("Official FIM Speedway of Nations",state.data.sources.nations));target.append(s);
  }
  function renderSwc(target){
    const c=state.data.competitions.swc,s=panel("Speedway World Cup","NATIONAL TEAM WORLD CHAMPIONSHIP");
    s.append(el("p","speedway-section-intro",c.note));
    const p=c.previousSeason,summary=el("div","speedway-worldcup-result");
    summary.append(el("span","eyebrow","2026 FINAL · WARSAW"),el("h3","",p.champion+" — World Cup winners"),el("p","", "Silver: "+p.runner_up+" · Bronze: "+p.third+" · "+p.fourth+" finished fourth"));
    s.append(summary,link("2026 official World Cup results",p.source_url),link("FIM Speedway World Cup",state.data.sources.worldCup));target.append(s);
  }
  function riderRow(r,seasonLabel,showPoints=true){
    const b=el("button","speedway-rider-row");b.type="button";b.setAttribute("aria-label","View rider profile: "+r.name);
    b.append(el("span","speedway-rider-rank",String(r.rank||"—").padStart(2,"0")),el("span","speedway-rider-number","#"+r.number),el("span","speedway-rider-name",r.name),el("span","speedway-rider-country",r.nationality),el("strong","speedway-rider-points",showPoints?(r.points+" pts"):"CONFIRMED"));
    b.addEventListener("click",()=>{state.selectedRider={...r,seasonLabel,points:r.points??null};render();});return b;
  }
  function renderRiders(target){
    const lineup=state.data.championship2027;
    if(lineup?.riders?.length){
      const current=panel("2027 permanent rider line-up","ALL "+lineup.riders.length+" CONFIRMED SGP RIDERS");
      current.append(el("p","speedway-section-intro","The complete permanent rider line-up published by FIM for the 2027 Speedway Grand Prix World Championship. Championship points and final grid positions will populate when the season begins."));
      const currentList=el("div","speedway-rider-list");lineup.riders.forEach(r=>currentList.append(riderRow(r,"2027 Speedway GP",false)));current.append(currentList,link("Official FIM 2027 rider line-up",lineup.source_url));target.append(current);
    }
    const s=panel("2026 final rider standings","PREVIOUS SEASON · WORLD CHAMPIONSHIP TABLE");
    s.append(el("p","speedway-section-intro","The previous season’s final standings remain available as an archive. Select any rider for their profile summary."));
    const list=el("div","speedway-rider-list");state.data.riderStandings.riders.forEach(r=>list.append(riderRow(r,"2026 Speedway GP",true)));s.append(list,link("Official FIM 2026 rider standings",state.data.riderStandings.source_url));target.append(s);
    if(state.selectedRider){
      const r=state.selectedRider,profile=panel(r.name,"RIDER PROFILE");
      profile.append(el("div","speedway-rider-profile-number","#"+r.number),el("p","speedway-section-intro",r.nationality+" · "+(r.seasonLabel||"Speedway GP")),el("div","speedway-profile-stats",[[String(r.rank||"—"),"FINAL RANK"],[String(r.points??"TBC"),"CHAMPIONSHIP POINTS"],[String(r.number),"RACE NUMBER"]].map(([n,l])=>{const x=el("div","speedway-profile-stat");x.append(el("strong","",n),el("small","",l));return x;})));
      profile.append(el("p","speedway-section-note","Team and club affiliations, career records and rider photographs will be added only when verified against an official rider profile. This profile currently uses the official FIM championship standings and rider number."));
      profile.append(link("View official FIM rider standings",state.data.riderStandings.source_url));
      const close=el("button","secondary-button","CLOSE RIDER PROFILE");close.type="button";close.addEventListener("click",()=>{state.selectedRider=null;render();});profile.append(close);target.append(profile);
    }
  }
  function render(){
    const target=root();if(!target)return;target.replaceChildren();
    if(state.loading){target.append(el("p","speedway-loading","Loading official Speedway data…"));return;}
    if(state.error){target.append(el("p","speedway-loading",state.error));return;}
    const hero=el("section","speedway-hero");
    const pageTitle=el("h1","","Speedway");pageTitle.id="speedway-title";hero.append(el("span","speedway-wordmark","FIM SPEEDWAY"),el("span","eyebrow","WORLD CHAMPIONSHIPS · UK LOCAL TIME"),pageTitle); 
    hero.append(el("p","","The Speedway Grand Prix, Speedway of Nations and Speedway World Cup — with a dedicated British Grand Prix feature and rider directory."));
    const meta=el("div","speedway-hero-meta");meta.append(el("span","","2027 CALENDAR"),el("span","","2026 RESULTS & STANDINGS"),el("span","","OFFICIAL FIM SOURCES"));hero.append(meta);target.append(hero,tabs());
    const body=el("div","speedway-tab-content");body.id="speedway-tab-content";
    if(state.tab==="sgp")renderSgp(body);else if(state.tab==="son")renderSon(body);else if(state.tab==="swc")renderSwc(body);else renderRiders(body);
    target.append(body);
    const footer=el("div","speedway-footer");footer.append(el("span","","FIM DATA SNAPSHOT · UPDATED "+(state.data.last_updated||"DATE NOT PUBLISHED")),link("FIM SPEEDWAY OFFICIAL WEBSITE","https://fimspeedway.com/"));target.append(footer);
  }
  async function load(){
    state.loading=true;state.error="";render();
    try{const r=await fetch("./data/speedway.json?t="+Date.now(),{cache:"no-store"});if(!r.ok)throw new Error("HTTP "+r.status);const d=await r.json();if(!d.competitions?.sgp?.events?.length||!d.riderStandings?.riders?.length)throw new Error("The published Speedway data is incomplete.");state.data=d;}
    catch(e){state.error="Speedway data could not be loaded. Please try again later. ("+(e.message||"feed unavailable")+")";}
    finally{state.loading=false;render();document.dispatchEvent(new CustomEvent("sports:feeds-updated"));}
  }
  function open(){window.SportsSelector?.setActive?.("speedway");window.showScreen?.("speedway-screen");state.tab="sgp";state.selectedRider=null;render();document.dispatchEvent(new CustomEvent("sports:page-opened",{detail:{sport:"speedway"}}));}
  document.getElementById("speedway-back")?.addEventListener("click",()=>window.showScreen?.("home-screen"));
  window.SpeedwayPage={open,refresh:load,getEvents:()=>Object.values(state.data?.competitions||{}).flatMap(competition=>(competition.events||[]).map(event=>({...event,sport:"speedway"})))};
  load();
})();