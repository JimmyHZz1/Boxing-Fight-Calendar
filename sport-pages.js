(() => {
  const ORDER=["f1","darts","boxing","ufc","bkfc"];
  const INFO={
    f1:{name:"Formula 1",short:"F1",icon:"🏎️",logo:"https://www.formula1.com/assets/home/_next/static/media/f1-logo.43a01c6b.svg",eyebrow:"WORLD CHAMPIONSHIP MOTORSPORT",intro:"Follow the full Grand Prix season: race weekends, practice, qualifying, sprint sessions, race results and championship tables.",breakdown:["Grand Prix calendar","Practice & qualifying sessions","Sprint weekends","Race and sprint results","Drivers’ & constructors’ standings"],watch:[["Sky Sports F1","https://www.skysports.com/f1","Live coverage"],["NOW","https://www.nowtv.com/watch-sky-sports","Sky Sports streaming"],["Channel 4","https://www.channel4.com/","British GP coverage and highlights"]]},
    darts:{name:"PDC Darts",short:"DARTS",icon:"🎯",logo:"https://commons.wikimedia.org/wiki/Special:FilePath/Professional%20Darts%20Corporation%20logo.png",eyebrow:"PROFESSIONAL DARTS CORPORATION",intro:"Follow the main televised PDC tournaments, with U23, youth and non-televised floor events filtered out.",breakdown:["World Championship & World Matchplay","Premier League, UK Open & Grand Slam","World Series televised events","Tournament dates & venues","PDC Order of Merit"],watch:[["Sky Sports Darts","https://www.skysports.com/darts","Selected events"],["ITV4","https://www.itv.com/watch","Selected events"],["PDC TV / PDCTV","https://video.pdc.tv/","Selected live coverage where UK rights allow"]]},
    boxing:{name:"Boxing",short:"BOXING",icon:"🥊",eyebrow:"THE FIGHT GAME",intro:"A complete view of the boxing schedule, with fight-night details, full cards, headline bouts, British fighters, promoters and confirmed UK broadcast information.",breakdown:["Upcoming fight nights","Full undercards & main events","British fighters & UK cards","Promoters, venues & locations","Confirmed UK broadcasters","Headline bouts & title fights"],watch:[]},
    ufc:{name:"UFC",short:"UFC",icon:"🥋",eyebrow:"ULTIMATE FIGHTING CHAMPIONSHIP",intro:"Explore every upcoming UFC event, including numbered cards, Fight Nights, main cards, prelims, results and division rankings where published.",breakdown:["Numbered events & Fight Nights","Main cards & prelims","Fight results and finishes","Event venues and start times","Division rankings"],watch:[["TNT Sports","https://www.tntsports.co.uk/","UK live coverage"],["UFC Fight Pass","https://ufcfightpass.com/","Selected events and prelims"]]},
    bkfc:{name:"BKFC",short:"BKFC",icon:"🥊",eyebrow:"BARE-KNUCKLE FIGHTING CHAMPIONSHIP",intro:"Follow BKFC bare-knuckle events, fight cards, results, venues and UK viewing options. This section covers BKFC only.",breakdown:["Upcoming BKFC events","Main events & full fight cards","Results and fight outcomes","Venues and event locations","UK viewing information"],watch:[["BKFC+","https://bkfc.live/","Many live events"],["DAZN","https://www.dazn.com/","Selected exclusive events"]]}
  };
  const root=()=>document.getElementById("sport-page-content");
  let current="";
  let hub={};
  const el=(tag,cls,text)=>{const n=document.createElement(tag);if(cls)n.className=cls;if(text!==undefined)n.textContent=text;return n;};
  const safeUrl=value=>/^https?:\/\//i.test(String(value||""));
  const dateValue=e=>e?.start_at||e?.start_time_utc||e?.date||e?.event_date||null;
  const dateKey=value=>{if(!value)return "";const s=String(value);if(/^\d{4}-\d{2}-\d{2}$/.test(s))return s;const d=new Date(s);return Number.isNaN(d.getTime())?"":new Intl.DateTimeFormat("en-CA",{timeZone:"Europe/London"}).format(d);};
  const dateLabel=value=>{const d=new Date(/^\d{4}-\d{2}-\d{2}$/.test(String(value||""))?String(value)+"T12:00:00Z":value);return !value||Number.isNaN(d.getTime())?"Date TBC":new Intl.DateTimeFormat("en-GB",{timeZone:"Europe/London",weekday:"short",day:"numeric",month:"short",year:"numeric"}).format(d);};
  const today=()=>new Intl.DateTimeFormat("en-CA",{timeZone:"Europe/London"}).format(new Date());
  const eventName=e=>e?.name||e?.title||e?.event_name||"Event details to be confirmed";
  const fights=e=>e?.fights||e?.bouts||e?.card||[];
  function eventsFor(sport){
    if(sport==="boxing")return window.BoxingSchedule?.getEvents?.()||[];
    return window.SportsData?.getEvents?.(sport,true)||[];
  }
  function renderEvent(sport,event){
    if(sport==="boxing")return window.BoxingSchedule?.renderEventCard?.(event,false)||null;
    return window.SportsData?.renderEventCard?.(sport,event)||null;
  }
  function section(title,kicker){
    const s=el("section","sport-page-section");
    const h=el("div","sport-page-section-heading");
    const left=el("div");
    if(kicker)left.append(el("span","eyebrow",kicker));
    left.append(el("h2",null,title));
    h.append(left);s.append(h);return s;
  }
  function empty(message){return el("div","sport-page-empty",message);}
  const BROADCASTER_BRANDS=[
    [/sky/i,"skysports.com","SKY"],[/^now$/i,"nowtv.com","NOW"],[/channel\s*4/i,"channel4.com","C4"],
    [/itv/i,"itv.com","ITV"],[/pdc\s*tv/i,"video.pdc.tv","PDC"],[/tnt/i,"tntsports.co.uk","TNT"],
    [/ufc/i,"ufcfightpass.com","UFC"],[/bkfc/i,"bkfc.com","BKFC"],[/dazn/i,"dazn.com","DAZN"]
  ];
  function watchBrand(item,name){
    const match=BROADCASTER_BRANDS.find(([pattern])=>pattern.test(name));
    if(!match)return;
    const [,domain,mark]=match;
    const badge=el("span","sport-watch-guide-brand-mark",mark);
    badge.setAttribute("aria-hidden","true");
    const img=el("img","sport-watch-guide-logo");
    img.alt=name+" logo";img.loading="lazy";img.decoding="async";
    img.src="https://www.google.com/s2/favicons?domain="+encodeURIComponent(domain)+"&sz=128";
    img.onerror=()=>{
      if(img.dataset.retry!=="1"){
        img.dataset.retry="1";
        img.src="https://icons.duckduckgo.com/ip3/"+domain+".ico";
      }else img.remove();
    };
    const visual=el("div","sport-watch-guide-brand");
    visual.append(badge,img);item.append(visual);
  }
  function watchGuide(sport,events){
    const s=section("Where to watch","UK BROADCAST GUIDE");
    if(sport==="boxing"){
      const providers=new Map();
      events.forEach(event=>(event.broadcasters||[]).forEach(item=>{
        if(!item||typeof item!=="object")return;
        const region=String(item.region||item.country||item.market||"").toLowerCase();
        if(!/(uk|gb|united kingdom|great britain|worldwide|global)/.test(region))return;
        const name=item.name||item.broadcaster||item.platform||item.service;
        if(name)providers.set(name,item.url||item.href||null);
      }));
      if(!providers.size)s.append(empty("Boxing broadcast rights are event-specific. Confirmed UK broadcasters will be shown on each fight card when announced."));
      else{
        const grid=el("div","sport-watch-guide-grid");
        providers.forEach((href,name)=>{const item=el("div","sport-watch-guide-item");watchBrand(item,name);item.append(el("strong",null,name),el("small",null,"Listed on one or more upcoming event feeds"));if(safeUrl(href)){const a=el("a",null,"Watch details ↗");a.href=href;a.target="_blank";a.rel="noopener noreferrer";item.append(a);}grid.append(item);});s.append(grid);
      }
      return s;
    }
    const grid=el("div","sport-watch-guide-grid");
    INFO[sport].watch.forEach(([name,href,note])=>{const item=el("div","sport-watch-guide-item");watchBrand(item,name);item.append(el("strong",null,name),el("small",null,note));const a=el("a",null,"Official site ↗");a.href=href;a.target="_blank";a.rel="noopener noreferrer";item.append(a);grid.append(item);});
    s.append(grid);
    const note=sport==="bkfc"?"Availability varies by event: BKFC+ carries many live events, while DAZN carries selected exclusives.":sport==="ufc"?"Check the individual event listing for the applicable UK broadcast and start time.":sport==="darts"?"Coverage varies by tournament and UK rights.": "Coverage varies by session and event.";
    s.append(el("p","sport-page-note",note));return s;
  }
  function breakdown(sport,events){
    const s=section("What you’ll find here","SPORT BREAKDOWN");
    const grid=el("div","sport-breakdown-grid");
    INFO[sport].breakdown.forEach((item,i)=>{const card=el("div","sport-breakdown-item");card.append(el("span","sport-breakdown-number",String(i+1).padStart(2,"0")),el("strong",null,item));grid.append(card);});
    s.append(grid);
    if(sport==="f1"){
      const sessions=events.reduce((n,e)=>n+(e.sessions||[]).length,0);
      s.append(el("p","sport-page-note",sessions?sessions+" session entries are currently included across the loaded race weekends.":"Practice, qualifying and sprint timetables will appear inside each Grand Prix when published."));
    } else if(sport==="darts"){
      const tiers=[...new Set(events.map(e=>String(e.tier||"").replaceAll("_"," ").trim()).filter(Boolean))];
      s.append(el("p","sport-page-note",tiers.length?"Tournament categories in the current feed: "+tiers.join(" · "):"Tournament categories and match-level information will be shown when included in the published PDC schedule."));
    } else if(sport==="boxing"){
      const boutCount=events.reduce((n,e)=>n+fights(e).length,0);
      s.append(el("p","sport-page-note",boutCount?boutCount+" individual bouts are currently listed across the loaded event cards.":"Full bout lists will appear as promoters and data providers confirm each card."));
    } else {
      const boutCount=events.reduce((n,e)=>n+fights(e).length,0);
      s.append(el("p","sport-page-note",boutCount?boutCount+" individual fights are currently listed across the loaded events.":"Fight-by-fight details and results will appear as the event data feed publishes them."));
    }
    return s;
  }
  function constructorFallback(name){
    const marks={"Mercedes":"★","Ferrari":"SF","Red Bull":"RBR","McLaren":"MCL","RB F1 Team":"VCARB","Alpine F1 Team":"ALP","Haas F1 Team":"HAAS","Audi":"AUDI","Williams":"W","Aston Martin":"AM","Cadillac F1 Team":"CAD"};
    const colours={"Mercedes":"#00d2be","Ferrari":"#ef1a2d","Red Bull":"#4776d0","McLaren":"#ff8700","RB F1 Team":"#6c9bd2","Alpine F1 Team":"#168bd2","Haas F1 Team":"#c7cbd1","Audi":"#f02b32","Williams":"#39a9df","Aston Martin":"#00a58b","Cadillac F1 Team":"#e5e5e5"};
    const mark=el("span","sport-ranking-image-fallback constructor-mark",marks[name]||String(name||"F1").slice(0,4).toUpperCase());
    mark.style.setProperty("--team-color",colours[name]||"#e2b45b");
    mark.setAttribute("aria-label",name+" mark");
    return mark;
  }
  function rankingRow(item,rank,kind="person"){
    const row=el("div","sport-ranking-row has-image"+(kind==="constructor"?" is-constructor":""));
    row.append(el("span","sport-ranking-position",rank==="C"?"C":"#"+rank));
    const name=item.name||item.driver||item.team||"TBC";
    if(item.image_url && kind!=="constructor"){
      const img=el("img","sport-ranking-image");
      const localSource=item.image_url.startsWith("./assets/")?"https://raw.githubusercontent.com/JimmyHZz1/Boxing-Fight-Calendar/main/"+item.image_url.slice(2):item.image_url;
      img.src=localSource;img.alt=name+(kind==="constructor"?" logo":" portrait");img.loading="lazy";img.decoding="async";
      img.onerror=()=>{
        if(item.image_url.startsWith("./assets/")&&!img.dataset.remoteRetry){
          img.dataset.remoteRetry="1";
          img.src="https://raw.githubusercontent.com/JimmyHZz1/Boxing-Fight-Calendar/main/"+item.image_url.slice(2);
          return;
        }
        img.replaceWith((kind==="constructor"?constructorFallback(name):el("span","sport-ranking-image-fallback",name.split(/\s+/).map(x=>x[0]||"").slice(0,2).join("").toUpperCase())));
      };
      row.append(img);
    }else row.append((kind==="constructor"?constructorFallback(name):el("span","sport-ranking-image-fallback",name.split(/\s+/).map(x=>x[0]||"").slice(0,2).join("").toUpperCase())));
    row.append(el("strong",null,name));
    return row;
  }
  let f1TableChoice="drivers";
  function standings(sport){
    const d=hub[sport]||{};
    const s=section(sport==="darts"?"PDC Order of Merit":sport==="boxing"?"World champions":sport==="f1"?"Championship standings":"Championships & rankings",sport==="f1"?"LIVE CHAMPIONSHIP":"CURRENT STANDINGS");
    if(sport==="f1"){
      const tabs=el("div","f1-standings-tabs");
      [["drivers","DRIVERS"],["constructors","CONSTRUCTORS"]].forEach(([key,label])=>{
        const button=el("button","f1-standings-tab"+(f1TableChoice===key?" active":""),label);
        button.type="button";button.setAttribute("aria-pressed",String(f1TableChoice===key));
        button.addEventListener("click",()=>{f1TableChoice=key;const refreshed=standings("f1");s.replaceWith(refreshed);});
        tabs.append(button);
      });
      s.append(tabs);
      const items=f1TableChoice==="drivers"?d.drivers:d.constructors;
      if(!Array.isArray(items)||!items.length){s.append(empty(d.sync_warning||"Live championship standings are temporarily unavailable. The page will retry when reopened."));return s;}
      const group=el("div","sport-ranking-group");
      group.append(el("h3",null,f1TableChoice==="drivers"?"Drivers’ championship":"Constructors’ championship"));
      items.forEach((item,index)=>{
        const row=rankingRow(item,item.rank||index+1,f1TableChoice==="constructors"?"constructor":"person");
        const extra=[item.team,item.points!=null?item.points+" pts":null].filter(Boolean).join(" · ");
        if(extra)row.append(el("small",null,extra));group.append(row);
      });
      s.append(group);
      const updated=d.last_updated?new Date(d.last_updated).toLocaleString("en-GB",{timeZone:"Europe/London",dateStyle:"medium",timeStyle:"short"}):null;
      if(updated)s.append(el("p","sport-page-note","Standings refreshed "+updated+" UK · "+(d.season||new Date().getFullYear())+" season."));
      s.append(el("p","sport-page-note","Live table from Jolpica F1; refreshes when this page is opened."));
      return s;
    }
    const candidates=sport==="darts"?[["PDC Order of Merit",d.rankings,20]]:sport==="ufc"?(d.divisions||[]).map(x=>[x.name||x.division,x.entries]):sport==="boxing"?(d.divisions||[]).map(x=>[x.name,x.champions]):[];
    const valid=candidates.filter(x=>Array.isArray(x[1])&&x[1].length);
    if(!valid.length){s.append(empty(d.sync_warning||"The latest standings have not been published yet. They will appear after the next successful data sync."));return s;}
    valid.forEach(([title,items,limit])=>{
      const group=el("div","sport-ranking-group");group.append(el("h3",null,title));
      items.slice(0,limit||8).forEach((item,index)=>{
        const row=rankingRow(item,item.rank!=null?(item.rank===0?"C":item.rank):index+1);
        const extra=[item.org,item.team,item.points!=null?item.points+" pts":null,item.prize_money? "£"+item.prize_money:null].filter(Boolean).join(" · ");
        if(extra)row.append(el("small",null,extra));group.append(row);
      });
      s.append(group);
    });
    const updated=d.last_updated?new Date(d.last_updated).toLocaleString("en-GB",{timeZone:"Europe/London",dateStyle:"medium",timeStyle:"short"}):null;
    if(updated)s.append(el("p","sport-page-note","Standings updated "+updated+" UK."));
    if(d.notice||d.sync_warning)s.append(el("p","sport-page-note",d.notice||d.sync_warning));
    return s;
  }
  function render(sport){
    const target=root();if(!target)return;
    current=sport;
    const info=INFO[sport];if(!info)return;
    target.replaceChildren();
    const events=eventsFor(sport);
    const now=today();
    const upcoming=events.filter(e=>dateKey(dateValue(e))>=now).sort((a,b)=>dateKey(dateValue(a)).localeCompare(dateKey(dateValue(b))));
    const past=events.filter(e=>dateKey(dateValue(e))&&dateKey(dateValue(e))<now).sort((a,b)=>dateKey(dateValue(b)).localeCompare(dateKey(dateValue(a))));
    const next=upcoming[0]||null;
    const totalFights=events.reduce((n,e)=>n+fights(e).length,0);
    const sessionCount=events.reduce((n,e)=>n+(Array.isArray(e.sessions)?e.sessions.length:0),0);
    const matchCount=events.reduce((n,e)=>n+(Number(e.matches)||0),0);
    const hero=el("section","sport-detail-hero sport-detail-"+sport);
    const top=el("div","sport-detail-hero-top");
    if(info.logo){const logo=el("img","sport-detail-logo");logo.src=info.logo;logo.alt=info.name+" logo";logo.onerror=()=>{logo.replaceWith(el("span","sport-detail-icon",info.icon));};top.append(logo);}
    else top.append(el("span","sport-detail-icon",info.icon));
    top.append(el("span","eyebrow",info.eyebrow));
    const title=el("h1",null,info.name);title.id="sport-detail-title";const desc=el("p",null,info.intro);
    const meta=el("div","sport-detail-meta");meta.append(el("span",null,"UK LOCAL TIME"),el("span",null,upcoming.length+" UPCOMING"),el("span",null,events.length+" EVENTS IN FEED"));
    hero.append(top,title,desc,meta);target.append(hero);
    const stats=el("div","sport-detail-stats");
    const third=sport==="f1"?[String(sessionCount),"RACE SESSIONS"]:sport==="darts"?[String(matchCount),"MATCHES SCHEDULED"]:[String(totalFights),"FIGHTS / BOUTS LISTED"];
    [[String(upcoming.length),"UPCOMING EVENTS"],[String(past.length),"PAST EVENTS"],third].forEach(([n,l])=>{const c=el("div","sport-detail-stat");c.append(el("strong",null,n),el("small",null,l));stats.append(c);});
    target.append(stats);
    if(next){
      const s=section("Next up","YOUR NEXT EVENT");
      const card=renderEvent(sport,next);if(card)s.append(card);else s.append(empty(eventName(next)));
      target.append(s);
    }else{
      const s=section("Next up","YOUR NEXT EVENT");s.append(empty("No upcoming "+info.name+" events are currently listed. The page will fill automatically when the next schedule sync publishes fixtures."));target.append(s);
    }
    const up=section(sport==="boxing"?"Upcoming fight nights":"Upcoming schedule",sport==="darts"?"PDC TOUR DATES":"WHAT’S COMING UP");
    if(upcoming.length)upcoming.forEach(event=>{const card=renderEvent(sport,event);if(card)up.append(card);});
    else up.append(empty("No upcoming events are available in the current published feed."));
    target.append(up);
    if(past.length){
      const recent=section(sport==="boxing"?"Recent fight cards":"Recent events & results","LATEST RESULTS");
      past.slice(0,6).forEach(event=>{const card=renderEvent(sport,event);if(card)recent.append(card);});
      target.append(recent);
    }
    target.append(breakdown(sport,events));
    const table=standings(sport);if(table)target.append(table);
    target.append(watchGuide(sport,events));
    const footer=el("div","sport-detail-footer");const back=el("button","secondary-button","← BACK TO ALL SPORTS");back.type="button";back.addEventListener("click",()=>window.showScreen?.("home-screen"));footer.append(back);target.append(footer);
  }
  function open(sport){
    if(!INFO[sport])return;
    window.SportsSelector?.setActive?.(sport);
    window.showScreen?.("sport-detail-screen");
    render(sport);
    document.dispatchEvent(new CustomEvent("sports:page-opened",{detail:{sport}}));
  }
  async function loadHub(){
    try{const r=await fetch("./data/sports-hub.json?t="+Date.now(),{cache:"no-store"});if(r.ok){const data=await r.json();hub=data.sports||data;if(current)render(current);}}catch(_){}
    // Request the current season directly so the F1 championship is not
    // limited to the age of the last four-hour static data sync.
    try{
      const base="https://api.jolpi.ca/ergast/f1/current";
      const [driverResponse,constructorResponse]=await Promise.all([
        fetch(base+"/driverStandings.json?limit=100",{cache:"no-store"}),
        fetch(base+"/constructorStandings.json?limit=100",{cache:"no-store"})
      ]);
      if(!driverResponse.ok||!constructorResponse.ok)throw new Error("Live F1 standings unavailable");
      const [driverPayload,constructorPayload]=await Promise.all([driverResponse.json(),constructorResponse.json()]);
      const driverRows=driverPayload?.MRData?.StandingsTable?.StandingsLists?.[0]?.DriverStandings||[];
      const constructorRows=constructorPayload?.MRData?.StandingsTable?.StandingsLists?.[0]?.ConstructorStandings||[];
      if(!driverRows.length||!constructorRows.length)throw new Error("No current F1 standings returned");
      // Live standings contain positions and points, but not our licensed image
      // metadata. Merge those fields with the published image records instead
      // of replacing the records and silently dropping every portrait/logo.
      const savedF1=hub.f1||{};
      const normaliseName=value=>String(value||"").normalize("NFKD").replace(/[̀-ͯ]/g,"").toLowerCase().replace(/[^a-z0-9]+/g," ").trim();
      const imageFields=["image_url","image_page_url","image_credit","image_license","image_license_url","image_source","image_match_score","image_match_method","image_verified_at","image_local_path"];
      const savedByName=rows=>new Map((Array.isArray(rows)?rows:[]).map(item=>[normaliseName(item.name||item.team||item.driver),item]));
      const mergeSavedImages=(liveRows,savedRows)=>{
        const saved=savedByName(savedRows);
        return liveRows.map(item=>{
          const key=normaliseName(item.name);
          let previous=saved.get(key);
          if(!previous&&/^(rb|visa cash app rb|racing bulls)$/.test(key))previous=saved.get("rb f1 team");
          const merged={...previous,...item};
          if(previous)for(const field of imageFields)if(previous[field]&&!merged[field])merged[field]=previous[field];
          return merged;
        });
      };
      hub.f1={
        drivers:mergeSavedImages(driverRows.map(row=>({rank:Number(row.position),name:[row.Driver?.givenName,row.Driver?.familyName].filter(Boolean).join(" "),team:(row.Constructors||[]).map(team=>team.name).join(", "),points:row.points})),savedF1.drivers),
        constructors:mergeSavedImages(constructorRows.map(row=>({rank:Number(row.position),name:row.Constructor?.name,points:row.points})),savedF1.constructors),
        season:driverPayload?.MRData?.StandingsTable?.StandingsLists?.[0]?.season||driverPayload?.MRData?.StandingsTable?.season||new Date().getFullYear(),
        last_updated:new Date().toISOString(),
        notice:"Live championship data from Jolpica F1."
      };
      if(current==="f1")render("f1");
    }catch(_){/* Keep the most recent successfully synced standings as fallback. */}
  }
  document.getElementById("sport-detail-back")?.addEventListener("click",()=>window.showScreen?.("home-screen"));
  window.SportPages={open,render,getCurrent:()=>current,refresh:()=>current&&render(current)};
  document.addEventListener("sports:feeds-updated",()=>{if(current)render(current);});
  document.addEventListener("sports:boxing-data-updated",()=>{if(current==="boxing")render("boxing");});
  loadHub();
})();