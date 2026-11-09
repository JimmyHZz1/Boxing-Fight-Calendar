(() => {
  const $=id=>document.getElementById(id);
  const order=["f1","darts","boxing","ufc","bkfc"];
  const labels={f1:"FORMULA 1",darts:"PDC DARTS",boxing:"BOXING",ufc:"UFC",bkfc:"BKFC"};
  const dateOf=e=>e?.start_at||e?.main_card_at||e?.start_time_utc||e?.date||e?.event_date||null;
  const dateLabel=v=>{if(!v)return "Date TBC";const d=new Date(/^\d{4}-\d{2}-\d{2}$/.test(String(v))?v+"T12:00:00Z":v);return Number.isNaN(d.getTime())?"Date TBC":new Intl.DateTimeFormat("en-GB",{timeZone:"Europe/London",weekday:"short",day:"numeric",month:"short",year:"numeric"}).format(d);};
  const timeLabel=v=>{if(!v||/^\d{4}-\d{2}-\d{2}$/.test(String(v)))return "Time TBC";const d=new Date(v);return Number.isNaN(d.getTime())?"Time TBC":new Intl.DateTimeFormat("en-GB",{timeZone:"Europe/London",hour:"2-digit",minute:"2-digit"}).format(d)+" UK";};
  let sportFilter="all",records=[],driverRecords=[];
  function collect(){
    const rows=[];
    order.forEach(sport=>{
      const events=sport==="boxing"?(window.BoxingSchedule?.getEvents?.()||[]):(window.SportsData?.getEvents?.(sport,true)||[]);
      events.forEach(event=>{
        const name=event.name||event.title||event.event_name||"Scheduled event";
        const bouts=event.bouts||event.fights||event.card||[];
        rows.push({sport,event,name,people:bouts.flatMap(b=>[b.fighter1,b.fighter2,b.fighter_a,b.fighter_b,b.red_corner,b.blue_corner].map(x=>typeof x==="string"?x:x?.name||x?.full_name||"")).filter(Boolean)});
      });
    });
    return rows.concat(driverRecords);
  }
  async function loadDriverIndex(){
    try{
      const response=await fetch("./data/sports-hub.json?t="+Date.now(),{cache:"no-store"});
      if(!response.ok)return;
      const payload=await response.json();
      const data=payload.sports||payload;
      const drivers=data.f1?.drivers||[];
      driverRecords=drivers.filter(driver=>driver&&driver.name).map(driver=>({
        kind:"driver",sport:"f1",name:driver.name,team:driver.team||"",
        rank:driver.rank??null,points:driver.points??null
      }));
      records=collect();
      if(!$("global-search-dialog")?.hidden)renderSearch();
    }catch(_){}
  }
  function renderSearch(){
    const input=$("global-search-input"),root=$("global-search-results");if(!input||!root)return;
    const q=input.value.trim().toLowerCase();
    if(!q){root.replaceChildren(Object.assign(document.createElement("p"),{textContent:"Start typing to search events, fighters, drivers and teams."}));return;}
    const matches=records.filter(r=>(sportFilter==="all"||r.sport===sportFilter)&&[
      r.name,r.team,r.rank!=null?"rank "+r.rank:"",r.points!=null?String(r.points)+" points":"",
      r.event?.venue,r.event?.location,r.event?.circuit,r.event?.country,...(r.people||[]),JSON.stringify(r.event||{})
    ].join(" ").toLowerCase().includes(q)).slice(0,30);
    root.replaceChildren();
    if(!matches.length){root.append(Object.assign(document.createElement("p"),{textContent:"No matches found. Try another name or choose a different sport."}));return;}
    matches.forEach(r=>{
      const row=document.createElement("button");row.type="button";row.className="global-search-result";
      const sport=document.createElement("span");sport.className="global-search-result-sport";sport.textContent=labels[r.sport];
      const info=document.createElement("span"),name=document.createElement("strong"),meta=document.createElement("small");
      name.textContent=r.name;
      meta.textContent=r.kind==="driver"
        ? ["F1 DRIVER",r.team,r.rank!=null?"RANK #"+r.rank:null,r.points!=null?r.points+" PTS":null].filter(Boolean).join(" · ")
        : [dateLabel(dateOf(r.event)),timeLabel(dateOf(r.event)),r.event.venue||r.event.location||r.event.circuit].filter(Boolean).join(" · ");
      info.append(name,meta);
      const action=document.createElement("span");action.className="global-search-result-action";action.textContent="OPEN →";
      row.append(sport,info,action);row.addEventListener("click",()=>{closeSearch();window.SportPages?.open?.(r.sport);});
      root.append(row);
    });
  }
  function openSearch(){records=collect();$("global-search-dialog").hidden=false;document.body.classList.add("search-open");$("global-search-input").value="";renderSearch();setTimeout(()=>$("global-search-input").focus(),40);}
  function closeSearch(){$("global-search-dialog").hidden=true;document.body.classList.remove("search-open");$("global-search-open")?.focus();}
  $("global-search-open")?.addEventListener("click",openSearch);
  $("global-search-close")?.addEventListener("click",closeSearch);
  $("global-search-dialog")?.addEventListener("click",e=>{if(e.target===$("global-search-dialog"))closeSearch();});
  $("global-search-input")?.addEventListener("input",renderSearch);
  document.addEventListener("keydown",e=>{if(e.key==="Escape"&&!$("global-search-dialog")?.hidden)closeSearch();if((e.key==="/"||((e.metaKey||e.ctrlKey)&&e.key.toLowerCase()==="k"))&&!/input|textarea|select/i.test(document.activeElement?.tagName||"")){e.preventDefault();openSearch();}});
  $("global-search-filters")?.addEventListener("click",e=>{const b=e.target.closest("[data-search-sport]");if(!b)return;sportFilter=b.dataset.searchSport;$("global-search-filters").querySelectorAll("button").forEach(x=>x.setAttribute("aria-pressed",String(x===b)));renderSearch();});
  $("compact-view-toggle")?.addEventListener("click",e=>{const active=document.body.classList.toggle("compact-view");e.currentTarget.setAttribute("aria-pressed",String(active));localStorage.setItem("sportsCompactView",active?"1":"0");});
  if(localStorage.getItem("sportsCompactView")==="1"){$("compact-view-toggle")?.setAttribute("aria-pressed","true");document.body.classList.add("compact-view");}
  const homeSections=[["featured-event-widget","Featured event"],["live-sports-centre","Live Sports Centre"],["sports-carousel-section","Choose a sport"],["sports-hub-banner","Championships & rankings"],["high-profile-title","High profile fights"],["uk-headliners-title","Main UK fights"],["tonight-heading","Tonight’s schedule"],["next-events","Upcoming fight dates"],["headline-bouts","Headline bouts"]];
  function targetFor(id){const node=$(id);return id==="high-profile-title"?node?.closest(".high-profile-section"):id==="uk-headliners-title"?node?.closest(".uk-headliners"):id==="tonight-heading"?node?.closest(".tonight-panel"):node;}
  function buildCustomiser(){
    const tools=document.querySelector(".home-display-tools");if(!tools||$("home-customise-panel"))return;
    const panel=document.createElement("div");panel.id="home-customise-panel";panel.className="home-customise-panel";panel.hidden=true;
    const heading=document.createElement("strong");heading.textContent="SHOW OR HIDE HOME SECTIONS";panel.append(heading);
    const saved=JSON.parse(localStorage.getItem("sportsHomeSections")||"{}");
    homeSections.forEach(([id,label])=>{const target=targetFor(id);if(!target)return;const wrap=document.createElement("label"),input=document.createElement("input");input.type="checkbox";input.checked=saved[id]!==false;input.addEventListener("change",()=>{const next=JSON.parse(localStorage.getItem("sportsHomeSections")||"{}");next[id]=input.checked;localStorage.setItem("sportsHomeSections",JSON.stringify(next));target.dataset.homeHide=String(!input.checked);});wrap.append(input,document.createTextNode(label));panel.append(wrap);target.dataset.homeHide=String(saved[id]===false);});
    tools.after(panel);
  }
  $("home-customise-toggle")?.addEventListener("click",e=>{buildCustomiser();const panel=$("home-customise-panel"),open=panel.hidden;panel.hidden=!open;e.currentTarget.setAttribute("aria-expanded",String(open));});
  buildCustomiser();
  loadDriverIndex();
  document.addEventListener("sports:feeds-updated",()=>{records=collect();if(!$("global-search-dialog")?.hidden)renderSearch();});
  document.addEventListener("sports:boxing-data-updated",()=>{records=collect();if(!$("global-search-dialog")?.hidden)renderSearch();});
  document.addEventListener("DOMContentLoaded",buildCustomiser);
})();