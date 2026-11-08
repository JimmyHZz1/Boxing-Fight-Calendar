(() => {
  const sports=["f1","darts","boxing","ufc","bkfc"];
  const names={f1:"FORMULA 1",darts:"PDC DARTS",boxing:"BOXING",ufc:"UFC",bkfc:"BKFC"};
  const logos={f1:"https://www.formula1.com/assets/home/_next/static/media/f1-logo.43a01c6b.svg",darts:"https://commons.wikimedia.org/wiki/Special:FilePath/Professional%20Darts%20Corporation%20logo.png",ufc:"https://commons.wikimedia.org/wiki/Special:FilePath/UFC%20Logo.svg",bkfc:"https://commons.wikimedia.org/wiki/Special:FilePath/Bkfc-logo.png"};
  const $=id=>document.getElementById(id);
  const today=()=>new Intl.DateTimeFormat("en-CA",{timeZone:"Europe/London"}).format(new Date());
  const dateValue=e=>e?.start_at||e?.start_time_utc||e?.date||e?.event_date||null;
  const dateKey=value=>{
    if(!value)return "";
    const s=String(value);
    if(/^\d{4}-\d{2}-\d{2}$/.test(s))return s;
    const d=new Date(s);
    return Number.isNaN(d.getTime())?"":new Intl.DateTimeFormat("en-CA",{timeZone:"Europe/London"}).format(d);
  };
  const timestamp=e=>{const v=dateValue(e);if(!v)return Number.MAX_SAFE_INTEGER;const d=new Date(v);return Number.isNaN(d.getTime())?Number.MAX_SAFE_INTEGER:d.getTime();};
  const formatDate=e=>{const v=dateValue(e);if(!v)return "Date TBC";const d=new Date(/^\d{4}-\d{2}-\d{2}$/.test(String(v))?v+"T12:00:00Z":v);return Number.isNaN(d.getTime())?"Date TBC":new Intl.DateTimeFormat("en-GB",{timeZone:"Europe/London",weekday:"short",day:"numeric",month:"short"}).format(d);};
  const formatTime=e=>{const v=dateValue(e);if(!v||/^\d{4}-\d{2}-\d{2}$/.test(String(v)))return "Time TBC";const d=new Date(v);return Number.isNaN(d.getTime())?"Time TBC":new Intl.DateTimeFormat("en-GB",{timeZone:"Europe/London",hour:"2-digit",minute:"2-digit"}).format(d)+" UK";};
  const status=e=>String(e?.status||"").toLowerCase().replace(/[ -]/g,"_");
  const isLive=e=>{
    if(["live","in_progress","ongoing","inprogress"].includes(status(e))||e?.is_live===true||e?.live===true||(e?.sessions||[]).some(s=>["live","in_progress","ongoing"].includes(String(s.status||"").toLowerCase().replace(/[ -]/g,"_"))||s.is_live===true))return true;
    if(/^f1-/.test(String(e?.id||"")) && !(e?.results||[]).length){
      const start=new Date(e.start_at||e.date||"").getTime(),elapsed=Date.now()-start;
      return Number.isFinite(start)&&elapsed>=0&&elapsed<4*60*60*1000;
    }
    return false;
  };
  const make=(tag,cls,text)=>{const el=document.createElement(tag);if(cls)el.className=cls;if(text!=null)el.textContent=text;return el;};
  function eventsFor(sport){
    if(sport==="boxing")return window.BoxingSchedule?.getEvents?.()||[];
    return window.SportsData?.getEvents?.(sport,true)||[];
  }
  function renderSummary(sport,event,live=false){
    const row=make("article","live-centre-event");row.dataset.sport=sport;
    const mark=make("span","live-centre-logo");
    if(logos[sport]){const img=make("img");img.src=logos[sport];img.alt="";img.loading="lazy";img.onerror=()=>{mark.textContent=sport==="darts"?"PDC":sport.toUpperCase();};mark.append(img);}else mark.textContent="BOX";
    const info=make("span","live-centre-info");
    info.append(make("strong",null,event.name||event.title||"Event"));
    const meta=[names[sport],formatDate(event),formatTime(event),event.location||event.venue||event.circuit].filter(Boolean);
    info.append(make("small",null,meta.join(" · ")));
    const target=event.start_at||event.main_card_at||event.start_time_utc||event.date||event.event_date;
    const dateOnly=typeof target==="string"&&/^\d{4}-\d{2}-\d{2}$/.test(target);
    if(!live&&target&&(dateOnly||new Date(target).getTime()>Date.now())){
      const timer=make("small","live-centre-countdown",window.SportsCountdown?.text?.(target)||"COUNTDOWN");timer.dataset.countdownTarget=dateOnly?target:new Date(target).toISOString();info.append(timer);
    }
    row.append(mark,info,make("span","live-centre-badge",live?"● LIVE":"UPCOMING"));
    return row;
  }
  function allEvents(){
    return sports.flatMap(sport=>eventsFor(sport).map(event=>({sport,event}))).filter(x=>dateKey(dateValue(x.event)));
  }
  function renderTicker(){
    const root=$("next-event-ticker");if(!root)return;
    root.replaceChildren();
    sports.forEach(sport=>{
      const rows=allEvents().filter(x=>x.sport===sport);
      const live=rows.filter(x=>isLive(x.event)).sort((a,b)=>timestamp(a.event)-timestamp(b.event))[0];
      const next=rows.filter(x=>!isLive(x.event)&&dateKey(dateValue(x.event))>=today()).sort((a,b)=>timestamp(a.event)-timestamp(b.event))[0];
      const chosen=live||next;if(!chosen)return;
      const event=chosen.event,button=make("button","next-event-item");
      button.type="button";button.dataset.sport=sport;
      const sportName=make("small","next-event-sport",names[sport]);
      const title=make("strong","next-event-name",event.name||event.title||"Event");
      const badge=make("span","next-event-state",live?"● LIVE":"UPCOMING");
      const target=event.start_at||event.main_card_at||event.start_time_utc||event.date||event.event_date;
      const info=make("span","next-event-info");
      info.append(sportName,title);
      if(!live&&target){const timer=make("small","next-event-countdown",window.SportsCountdown?.text?.(target)||"DATE TBC");timer.dataset.countdownTarget=/^\d{4}-\d{2}-\d{2}$/.test(String(target))?String(target):new Date(target).toISOString();info.append(timer);}
      button.append(info,badge);
      root.append(button);
    });
    if(!root.childElementCount)root.append(make("span","next-event-loading","No live or upcoming events currently listed."));
    root.querySelectorAll("[data-ticker-clone]").forEach(node=>node.remove());
    const originals=[...root.children].filter(node=>node.classList.contains("next-event-item"));
    if(originals.length>1){
      originals.forEach(node=>{const clone=node.cloneNode(true);clone.dataset.tickerClone="true";clone.setAttribute("aria-hidden","true");clone.tabIndex=-1;clone.querySelectorAll("button,a,[tabindex]").forEach(child=>child.tabIndex=-1);root.append(clone);});
    }
    root.scrollLeft=0;
  }
  let tickerFrame=0,tickerLast=0,tickerPaused=false;
  function stopTicker(){if(tickerFrame)cancelAnimationFrame(tickerFrame);tickerFrame=0;tickerLast=0;}
  function startTicker(){
    stopTicker();
    const root=$("next-event-ticker");
    if(!root||window.matchMedia("(prefers-reduced-motion: reduce)").matches||root.scrollWidth<=root.clientWidth)return;
    const step=now=>{
      if(!tickerLast)tickerLast=now;
      const delta=Math.min(50,now-tickerLast);tickerLast=now;
      if(!tickerPaused){
        const loopWidth=root.scrollWidth/2;
        if(loopWidth>0){root.scrollLeft+=delta*.028;if(root.scrollLeft>=loopWidth)root.scrollLeft-=loopWidth;}
      }
      tickerFrame=requestAnimationFrame(step);
    };
    tickerFrame=requestAnimationFrame(step);
  }
  const tickerRoot=$("next-event-ticker");
  if(tickerRoot){
    tickerRoot.addEventListener("click",event=>{const card=event.target.closest(".next-event-item");if(card&&!card.dataset.tickerClone)window.SportPages?.open?.(card.dataset.sport);});
    tickerRoot.addEventListener("pointerenter",()=>{tickerPaused=true;});
    tickerRoot.addEventListener("pointerleave",()=>{tickerPaused=false;});
    tickerRoot.addEventListener("focusin",()=>{tickerPaused=true;});
    tickerRoot.addEventListener("focusout",()=>{tickerPaused=false;});
    tickerRoot.addEventListener("touchstart",()=>{tickerPaused=true;},{passive:true});
    tickerRoot.addEventListener("touchend",()=>{tickerPaused=false;},{passive:true});
  }
  function render(){
    const liveRoot=$("live-now-events"),upcomingRoot=$("live-upcoming-events");
    if(!liveRoot||!upcomingRoot)return;
    renderTicker();
    const all=allEvents(),live=all.filter(x=>isLive(x.event)).sort((a,b)=>timestamp(a.event)-timestamp(b.event));
    liveRoot.replaceChildren();
    $("live-now-count").textContent=live.length+" LIVE";
    if(live.length)live.forEach(x=>{const row=renderSummary(x.sport,x.event,true);row.tabIndex=0;row.setAttribute("role","button");row.setAttribute("aria-label","Open "+names[x.sport]+" event: "+(x.event.name||x.event.title||"Event"));const open=()=>window.SportPages?.open?.(x.sport);row.addEventListener("click",open);row.addEventListener("keydown",e=>{if(e.key==="Enter"||e.key===" "){e.preventDefault();open();}});liveRoot.append(row);});
    else liveRoot.append(make("p","live-centre-empty","No events are currently marked live in the published feeds. Live indicators appear only when a source explicitly reports an event or session as live."));
    const todayKey=today(),limit=new Date(Date.now()+7*86400000);const limitKey=new Intl.DateTimeFormat("en-CA",{timeZone:"Europe/London"}).format(limit);
    const upcoming=all.filter(x=>dateKey(dateValue(x.event))>=todayKey&&dateKey(dateValue(x.event))<=limitKey&&!isLive(x.event)).sort((a,b)=>timestamp(a.event)-timestamp(b.event)).slice(0,12);
    const upcomingCount=$("live-upcoming-count");if(upcomingCount)upcomingCount.textContent=upcoming.length+" UPCOMING";
    upcomingRoot.replaceChildren();
    if(upcoming.length)upcoming.forEach(x=>{const row=renderSummary(x.sport,x.event,false);row.classList.add("live-centre-upcoming");upcomingRoot.append(row);});
    else upcomingRoot.append(make("p","live-centre-empty","No upcoming events are listed for the next seven days in the currently loaded feeds."));
    startTicker();
  }
  const featuredLabels={f1:"FORMULA 1",darts:"PDC DARTS",boxing:"BOXING",ufc:"UFC",bkfc:"BKFC"};
  const featuredIcons={f1:"🏎️",darts:"🎯",boxing:"🥊",ufc:"🥋",bkfc:"🥊"};
  const headlineNames=["anthony joshua","tyson fury","oleksandr usyk","canelo alvarez","terence crawford","naoya inoue","gervonta davis","dmitry bivol","artur beterbiev","shakur stevenson","devin haney","ryan garcia","jake paul","daniel dubois","fabio wardley","moses itauma","katie taylor","claressa shields","david benavidez"];
  const eventBouts=e=>e?.bouts||e?.fights||e?.card||[];
  const boxerName=f=>typeof f==="string"?f:(f?.name||f?.full_name||"");
  function featuredScore(sport,event){
    const name=String(event.name||event.title||"").toLowerCase();
    if(sport==="f1")return 88;
    if(sport==="darts")return /major|world championship|world matchplay|premier league|grand slam|uk open|world grand prix/i.test(name)||String(event.tier||"").toLowerCase()==="majors"?112:72;
    if(sport==="ufc")return event.is_title_card||event.is_ppv?125:event.number?108:/ufc\s*\d+/i.test(name)?108:75;
    if(sport==="bkfc")return 78;
    if(sport==="boxing"){
      let score=68;
      for(const bout of eventBouts(event)){
        const fighters=[boxerName(bout.fighter1||bout.fighter_a||bout.red_corner),boxerName(bout.fighter2||bout.fighter_b||bout.blue_corner)].map(v=>v.toLowerCase());
        if(fighters.some(v=>headlineNames.includes(v)))score=Math.max(score,118);
        if(bout.title_text||bout.is_title||/world title|championship|world champion/i.test(String(bout.title||"")))score=Math.max(score,105);
      }
      return score;
    }
    return 50;
  }
  function featuredDateValue(event){return event.start_at||event.main_card_at||event.start_time_utc||event.date||event.event_date||null;}
  function featuredDateKey(value){
    if(!value)return "";
    const raw=String(value);
    if(/^\d{4}-\d{2}-\d{2}$/.test(raw))return raw;
    const d=new Date(raw);return Number.isNaN(d.getTime())?"":new Intl.DateTimeFormat("en-CA",{timeZone:"Europe/London"}).format(d);
  }
  function renderFeaturedEvent(){
    const root=$("featured-event-widget");if(!root)return;
    const candidates=sports.flatMap(sport=>eventsFor(sport).map(event=>({sport,event}))).filter(({event})=>{
      const key=featuredDateKey(featuredDateValue(event)),s=String(event.status||"").toLowerCase();
      return key>=today()&&!["completed","complete","finished","ended","cancelled","canceled","postponed"].includes(s);
    }).map(item=>({...item,score:featuredScore(item.sport,item.event)}));
    candidates.sort((a,b)=>b.score-a.score||featuredDateKey(featuredDateValue(a.event)).localeCompare(featuredDateKey(featuredDateValue(b.event)))||timestamp(a.event)-timestamp(b.event));
    const chosen=candidates[0];
    if(!chosen){root.hidden=true;return;}
    const {sport,event}=chosen,target=featuredDateValue(event),rawName=event.name||event.title||"Upcoming event";
    const date=formatDate(event),time=formatTime(event),place=event.location||event.venue||event.circuit||event.country||"Venue to be confirmed";
    const sportLogo=logos[sport];
    $("featured-event-kicker").textContent=chosen.score>=110?"HEADLINE EVENT":"FEATURED EVENT";
    $("featured-event-sport").textContent=featuredLabels[sport];
    $("featured-event-name").textContent=rawName;
    $("featured-event-meta").textContent=[date,time!=="Time TBC"?time:null,place].filter(Boolean).join(" · ");
    $("featured-event-mark").replaceChildren();
    if(sportLogo){const img=make("img");img.src=sportLogo;img.alt="";img.loading="lazy";img.onerror=()=>{$("featured-event-mark").textContent=featuredIcons[sport];};$("featured-event-mark").append(img);}
    else $("featured-event-mark").textContent=featuredIcons[sport];
    const countdown= $("featured-event-countdown");
    countdown.textContent=window.SportsCountdown?.text?.(target)||"DATE TO BE CONFIRMED";
    countdown.dataset.countdownTarget=target?(/^\d{4}-\d{2}-\d{2}$/.test(String(target))?String(target):new Date(target).toISOString()):"";
    $("featured-event-note").textContent=sport==="boxing"?"Headline boxing matchup":sport==="darts"?"Featured televised PDC tournament":sport==="ufc"?(event.is_title_card?"Title-card event":event.is_ppv?"Numbered pay-per-view event":"Featured UFC card"):sport==="f1"?"Next Grand Prix on the Formula 1 calendar":"Featured event across the fight calendar";
    $("featured-event-open").onclick=()=>window.SportPages?.open?.(sport);
    root.hidden=false;
  }
  $("live-centre-calendar")?.addEventListener("click",()=>window.showScreen?.("calendar-screen"));
  $("open-version-history")?.addEventListener("click",e=>{e.preventDefault();window.showScreen?.("version-history-screen");});
  $("version-history-back")?.addEventListener("click",()=>window.showScreen?.("home-screen"));
  document.addEventListener("sports:feeds-updated",()=>{render();renderFeaturedEvent();});
  document.addEventListener("sports:boxing-data-updated",()=>{render();renderFeaturedEvent();});
  document.addEventListener("DOMContentLoaded",()=>{render();renderFeaturedEvent();});
  window.SportsCentreV11={refresh:render};
  render();
  renderFeaturedEvent();
  setInterval(()=>{document.querySelectorAll(".featured-event-countdown[data-countdown-target]").forEach(node=>{const label=window.SportsCountdown?.text?.(node.dataset.countdownTarget);if(label)node.textContent=label;});document.querySelectorAll(".live-centre-countdown[data-countdown-target],.next-event-countdown[data-countdown-target]").forEach(node=>{const label=window.SportsCountdown?.text?.(node.dataset.countdownTarget);if(label)node.textContent=label;});},1000);
})();
