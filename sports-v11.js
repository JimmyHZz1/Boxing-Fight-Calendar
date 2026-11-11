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
    // F1 sessions can finish well before the race weekend's four-hour window.
    // Never infer LIVE from a passed scheduled start; require explicit feed status.
    return false;
  };
  const isUpcoming=e=>{
    const s=status(e),finished=["completed","complete","finished","ended","cancelled","canceled","postponed","abandoned"];
    if(finished.includes(s))return false;
    const value=dateValue(e),key=dateKey(value);
    if(!value||key<today())return false;
    if(/^\d{4}-\d{2}-\d{2}$/.test(String(value)))return true;
    return timestamp(e)>Date.now();
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
  let tickerSignature = "";
  let tickerLoopDistance = 0;
  function measureTicker(){
    const root=$("next-event-ticker"),track=root?.querySelector(".next-event-track");
    const group=track?.querySelector(".next-event-group");
    if(!root||!track||!group)return;
    const rootWidth=root.clientWidth,groupWidth=group.getBoundingClientRect().width;
    if(!rootWidth||!groupWidth)return;
    const trackGap=parseFloat(getComputedStyle(track).columnGap||getComputedStyle(track).gap)||12;
    tickerLoopDistance=groupWidth+trackGap;
    track.querySelectorAll("[data-ticker-clone]").forEach(node=>node.remove());
    let copies=1;
    while(track.scrollWidth<rootWidth+tickerLoopDistance+2&&copies<12){
      const clone=group.cloneNode(true);
      clone.dataset.tickerClone="true";clone.setAttribute("aria-hidden","true");
      clone.querySelectorAll("button").forEach(button=>{button.tabIndex=-1;});
      track.append(clone);copies++;
    }
    root.classList.toggle("is-auto-scrolling",track.scrollWidth>rootWidth+2&&tickerLoopDistance>12);
  }
  function renderTicker(){
    const root=$("next-event-ticker");if(!root)return;
    const selected=[];
    sports.forEach(sport=>{
      const rows=allEvents().filter(x=>x.sport===sport&&!(sport==="boxing"&&(x.event.data_source==="Boxing Data API"||/^Additional scheduled bouts\\b/i.test(String(x.event.name||x.event.title||"")))));
      const live=rows.filter(x=>isLive(x.event)).sort((a,b)=>timestamp(a.event)-timestamp(b.event))[0];
      const next=rows.filter(x=>!isLive(x.event)&&isUpcoming(x.event)).sort((a,b)=>timestamp(a.event)-timestamp(b.event))[0];
      const chosen=live||next;if(chosen)selected.push({sport,event:chosen.event,live:!!live});
    });
    const signature=selected.map(x=>x.sport+":"+String(x.event.id||x.event.event_id||x.event.name||x.event.title||"")+":"+String(x.event.start_at||x.event.main_card_at||x.event.start_time_utc||x.event.date||x.event.event_date||"")+":"+x.live).join("|");
    if(signature===tickerSignature&&root.querySelector(".next-event-track")){requestAnimationFrame(measureTicker);return;}
    tickerSignature=signature;root.classList.remove("is-auto-scrolling","is-paused");root.scrollLeft=0;root.replaceChildren();
    if(!selected.length){tickerLoopDistance=0;root.append(make("span","next-event-loading","No live or upcoming events currently listed."));return;}
    const track=make("div","next-event-track"),group=make("div","next-event-group");
    selected.forEach(({sport,event,live})=>{
      const button=make("button","next-event-item");button.type="button";button.dataset.sport=sport;
      const info=make("span","next-event-info");
      info.append(make("small","next-event-sport",names[sport]),make("strong","next-event-name",event.name||event.title||"Event"));
      const target=event.start_at||event.main_card_at||event.start_time_utc||event.date||event.event_date;
      if(!live&&target){
        const timer=make("small","next-event-countdown",window.SportsCountdown?.text?.(target)||"DATE TBC");
        timer.dataset.countdownTarget=/^\\d{4}-\\d{2}-\\d{2}$/.test(String(target))?String(target):new Date(target).toISOString();info.append(timer);
      }
      const badge=make("span","next-event-state "+(live?"is-live":"is-upcoming"));
      badge.append(make("i","next-event-state-icon",live?"●":"▣"),make("b",null,live?"LIVE":"UPCOMING"));
      button.append(info,badge);group.append(button);
    });
    track.append(group);root.append(track);requestAnimationFrame(measureTicker);
  }
  let tickerResizeTimer;
  window.addEventListener("resize",()=>{clearTimeout(tickerResizeTimer);tickerResizeTimer=setTimeout(measureTicker,140);});
  const tickerRoot=$("next-event-ticker");
  if(tickerRoot){
    if("ResizeObserver" in window){
      const tickerObserver=new ResizeObserver(()=>requestAnimationFrame(measureTicker));
      tickerObserver.observe(tickerRoot);
    }
    let tickerResumeTimer, tickerFrame=0, tickerLast=0;
    const reducedMotion=window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const pauseTicker=()=>{clearTimeout(tickerResumeTimer);tickerRoot.classList.add("is-paused");};
    const resumeTicker=()=>{clearTimeout(tickerResumeTimer);tickerResumeTimer=setTimeout(()=>tickerRoot.classList.remove("is-paused"),1400);};
    tickerRoot.addEventListener("click",event=>{
      const card=event.target.closest(".next-event-item");
      if(card)window.SportPages?.open?.(card.dataset.sport);
    });
    tickerRoot.addEventListener("touchstart",pauseTicker,{passive:true});
    tickerRoot.addEventListener("touchmove",pauseTicker,{passive:true});
    tickerRoot.addEventListener("touchend",resumeTicker,{passive:true});
    tickerRoot.addEventListener("touchcancel",resumeTicker,{passive:true});
    tickerRoot.addEventListener("pointerdown",pauseTicker,{passive:true});
    tickerRoot.addEventListener("pointerup",resumeTicker,{passive:true});
    tickerRoot.addEventListener("pointercancel",resumeTicker,{passive:true});
    const animateTicker=now=>{
      if(tickerLast&&!reducedMotion&&!tickerRoot.classList.contains("is-paused")&&!document.hidden&&tickerRoot.classList.contains("is-auto-scrolling")){
        tickerRoot.scrollLeft+=Math.min(50,now-tickerLast)*0.035;
      }
      tickerLast=now;
      if(tickerLoopDistance>0&&tickerRoot.scrollLeft>=tickerLoopDistance){
        tickerRoot.scrollLeft=tickerRoot.scrollLeft%tickerLoopDistance;
      }
      tickerFrame=requestAnimationFrame(animateTicker);
    };
    cancelAnimationFrame(tickerFrame);
    tickerFrame=requestAnimationFrame(animateTicker);
  }
  function render(){
    const liveRoot=$("live-now-events"),upcomingRoot=$("live-upcoming-events");
    if(!liveRoot||!upcomingRoot)return;
    renderTicker();
    const all=allEvents(),live=all.filter(x=>isLive(x.event)).sort((a,b)=>timestamp(a.event)-timestamp(b.event));
    liveRoot.replaceChildren();
    const compact=document.body.classList.contains("compact-view");
    const nextUpcoming=all.filter(x=>!isLive(x.event)&&isUpcoming(x.event)).sort((a,b)=>timestamp(a.event)-timestamp(b.event))[0];
    const centreTitle=$("live-now-title");
    const centreRows=compact?(live.length?live.slice(0,3):(nextUpcoming?[nextUpcoming]:[])):live;
    if(centreTitle)centreTitle.textContent=compact&&!live.length?"NEXT UP":"LIVE NOW";
    $("live-now-count").textContent=compact?(live.length?live.length+" LIVE":nextUpcoming?"NEXT EVENT":"NO EVENTS"):live.length+" LIVE";
    if(centreRows.length)centreRows.forEach(x=>{const row=renderSummary(x.sport,x.event,isLive(x.event));row.tabIndex=0;row.setAttribute("role","button");row.setAttribute("aria-label","Open "+names[x.sport]+" event: "+(x.event.name||x.event.title||"Event"));const open=()=>window.SportPages?.open?.(x.sport);row.addEventListener("click",open);row.addEventListener("keydown",e=>{if(e.key==="Enter"||e.key===" "){e.preventDefault();open();}});liveRoot.append(row);});
    else liveRoot.append(make("p","live-centre-empty",compact?"No live or upcoming events are listed in the published feeds.":"No events are currently marked live in the published feeds. Live indicators appear only when a source explicitly reports an event or session as live."));
    const limit=new Date(Date.now()+7*86400000);const limitKey=new Intl.DateTimeFormat("en-CA",{timeZone:"Europe/London"}).format(limit);
    const upcoming=all.filter(x=>isUpcoming(x.event)&&dateKey(dateValue(x.event))<=limitKey&&!isLive(x.event)).sort((a,b)=>timestamp(a.event)-timestamp(b.event));
    const upcomingCount=$("live-upcoming-count");if(upcomingCount)upcomingCount.textContent=upcoming.length+" UPCOMING";
    upcomingRoot.replaceChildren();
    if(upcoming.length){
      const groups=sports.map(sport=>({sport,items:upcoming.filter(x=>x.sport===sport)})).filter(group=>group.items.length).sort((a,b)=>timestamp(a.items[0].event)-timestamp(b.items[0].event));
      groups.forEach(({sport,items})=>{
        const group=make("section","live-upcoming-sport-group");group.dataset.sport=sport;
        const heading=make("div","live-upcoming-sport-heading");
        heading.append(make("strong",null,names[sport]),make("span",null,items.length+" EVENT"+(items.length===1?"":"S")));
        const list=make("div","live-centre-list live-upcoming-sport-list");
        const extra=[];
        items.forEach((x,index)=>{
          const row=renderSummary(x.sport,x.event,false);row.classList.add("live-centre-upcoming");
          if(index>=2){row.hidden=true;extra.push(row);}
          list.append(row);
        });
        group.append(heading,list);
        if(items.length>2){
          const button=make("button","live-upcoming-expand","SHOW ALL "+items.length+" "+names[sport]+" EVENTS");
          button.type="button";button.setAttribute("aria-expanded","false");
          button.addEventListener("click",()=>{
            const expanded=button.getAttribute("aria-expanded")==="true";
            extra.forEach(row=>{row.hidden=expanded;});
            button.setAttribute("aria-expanded",String(!expanded));
            button.textContent=expanded?"SHOW ALL "+items.length+" "+names[sport]+" EVENTS":"SHOW FEWER";
          });
          group.append(button);
        }
        upcomingRoot.append(group);
      });
    }else upcomingRoot.append(make("p","live-centre-empty","No upcoming events are listed for the next seven days in the currently loaded feeds."));
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
  function featuredDetailLines(sport,event){
    const lines=[];
    const add=(label,value)=>{if(value!==undefined&&value!==null&&String(value).trim())lines.push({label,value:String(value).trim()});};
    if(sport==="f1"){
      add("ROUND",event.round?String(event.round):null);
      add("CIRCUIT",event.circuit);
      add("LOCATION",[event.locality,event.country].filter(Boolean).join(", "));
      const sessions=(event.sessions||[]).filter(s=>s?.start_at||s?.date).sort((a,b)=>timestamp(a)-timestamp(b));
      const next=sessions.find(s=>timestamp(s)>Date.now());
      if(next)add("NEXT SESSION",next.name+" · "+formatDate(next)+" · "+formatTime(next));
    }else if(sport==="darts"){
      add("TOURNAMENT",String(event.tier||"").replaceAll("_"," ").toUpperCase());
      add("VENUE",event.venue||event.location);
      if(event.end_date)add("FINISHES",formatDate({date:event.end_date}));
      if(event.matches)add("SCHEDULED MATCHES",event.matches);
    }else if(sport==="ufc"){
      const fights=eventBouts(event);
      const main=fights.find(f=>f.is_main||Number(f.ordering)===1)||fights.find(f=>String(f.card_section||"").toLowerCase()==="main");
      if(main){
        const a=boxerName(main.fighter_a||main.fighter1||main.red_corner),b=boxerName(main.fighter_b||main.fighter2||main.blue_corner);
        if(a&&b)add("MAIN EVENT",a+" vs "+b);
      }
      const titleBouts=fights.filter(f=>f.is_title||f.title_text);
      if(titleBouts.length)add("TITLE BOUTS",titleBouts.length+" scheduled");
      if(event.main_card_at)add("MAIN CARD",formatTime({start_at:event.main_card_at}));
      if(event.prelims_at)add("PRELIMS",formatTime({start_at:event.prelims_at}));
    }else if(sport==="boxing"){
      const bouts=eventBouts(event);
      const title=bouts.find(b=>b.title_text||b.is_title||b.title);
      const headline=title||bouts[0];
      if(headline){
        const a=boxerName(headline.fighter1||headline.fighter_a||headline.red_corner),b=boxerName(headline.fighter2||headline.fighter_b||headline.blue_corner);
        if(a&&b)add(title?"TITLE FIGHT":"FEATURED BOUT",a+" vs "+b);
        if(headline.title_text)add("ON THE LINE",headline.title_text);
      }
      if(bouts.length)add("BOUTS LISTED",bouts.length);
    }else if(sport==="bkfc"){
      const fights=eventBouts(event);
      if(fights.length){
        const f=fights[0],a=boxerName(f.fighter_a||f.fighter1||f.red),b=boxerName(f.fighter_b||f.fighter2||f.blue);
        if(a&&b)add("FEATURED BOUT",a+" vs "+b);
        add("FIGHTS LISTED",fights.length);
      }
    }
    return lines.slice(0,4);
  }
  function renderFeaturedDetails(sport,event){
    const root=$("featured-event-details");if(!root)return;
    root.replaceChildren();
    const lines=featuredDetailLines(sport,event);
    if(!lines.length)return;
    lines.forEach(item=>{
      const row=make("div","featured-event-detail");
      row.append(make("small",null,item.label),make("strong",null,item.value));
      root.append(row);
    });
  }
  function renderFeaturedEvent(){
    const root=$("featured-event-widget");if(!root)return;
    const candidates=sports.flatMap(sport=>eventsFor(sport).map(event=>({sport,event}))).filter(({event})=>{
      const key=featuredDateKey(featuredDateValue(event)),s=String(event.status||"").toLowerCase();
      return key>=today()&& !["completed","complete","finished","ended","cancelled","canceled","postponed","abandoned"].includes(s);
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
    const countdown=$("featured-event-countdown");
    countdown.textContent=window.SportsCountdown?.text?.(target)||"DATE TO BE CONFIRMED";
    countdown.dataset.countdownTarget=target?(/^\d{4}-\d{2}-\d{2}$/.test(String(target))?String(target):new Date(target).toISOString()):"";
    renderFeaturedDetails(sport,event);
    $("featured-event-note").textContent=sport==="boxing"?"Headline boxing matchup":sport==="darts"?"Featured televised PDC tournament":sport==="ufc"?(event.is_title_card?"Title-card event":event.is_ppv?"Numbered pay-per-view event":"Featured UFC card"):sport==="f1"?"Next Grand Prix on the Formula 1 calendar":"Featured event across the fight calendar";
    $("featured-event-open").onclick=()=>window.SportPages?.open?.(sport);
    root.hidden=false;
  }
  $("compact-view-toggle")?.addEventListener("click",()=>requestAnimationFrame(render));
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
