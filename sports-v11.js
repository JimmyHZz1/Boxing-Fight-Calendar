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
    if(/^\\d{4}-\\d{2}-\\d{2}$/.test(s))return s;
    const d=new Date(s);
    return Number.isNaN(d.getTime())?"":new Intl.DateTimeFormat("en-CA",{timeZone:"Europe/London"}).format(d);
  };
  const timestamp=e=>{const v=dateValue(e);if(!v)return Number.MAX_SAFE_INTEGER;const d=new Date(v);return Number.isNaN(d.getTime())?Number.MAX_SAFE_INTEGER:d.getTime();};
  const formatDate=e=>{const v=dateValue(e);if(!v)return "Date TBC";const d=new Date(/^\\d{4}-\\d{2}-\\d{2}$/.test(String(v))?v+"T12:00:00Z":v);return Number.isNaN(d.getTime())?"Date TBC":new Intl.DateTimeFormat("en-GB",{timeZone:"Europe/London",weekday:"short",day:"numeric",month:"short"}).format(d);};
  const formatTime=e=>{const v=dateValue(e);if(!v||/^\\d{4}-\\d{2}-\\d{2}$/.test(String(v)))return "Time TBC";const d=new Date(v);return Number.isNaN(d.getTime())?"Time TBC":new Intl.DateTimeFormat("en-GB",{timeZone:"Europe/London",hour:"2-digit",minute:"2-digit"}).format(d)+" UK";};
  const status=e=>String(e?.status||"").toLowerCase().replace(/[ -]/g,"_");
  const isLive=e=>["live","in_progress","ongoing","inprogress"].includes(status(e))||e?.is_live===true||e?.live===true||(e?.sessions||[]).some(s=>["live","in_progress","ongoing"].includes(String(s.status||"").toLowerCase().replace(/[ -]/g,"_"))||s.is_live===true);
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
    row.append(mark,info,make("span","live-centre-badge",live?"● LIVE":"UPCOMING"));
    return row;
  }
  function allEvents(){
    return sports.flatMap(sport=>eventsFor(sport).map(event=>({sport,event}))).filter(x=>dateKey(dateValue(x.event)));
  }
  function render(){
    const liveRoot=$("live-now-events"),upcomingRoot=$("live-upcoming-events");
    if(!liveRoot||!upcomingRoot)return;
    const all=allEvents(),live=all.filter(x=>isLive(x.event)).sort((a,b)=>timestamp(a.event)-timestamp(b.event));
    liveRoot.replaceChildren();
    $("live-now-count").textContent=live.length+" LIVE";
    if(live.length)live.forEach(x=>{const row=renderSummary(x.sport,x.event,true);row.tabIndex=0;row.setAttribute("role","button");row.setAttribute("aria-label","Open "+names[x.sport]+" event: "+(x.event.name||x.event.title||"Event"));const open=()=>window.SportPages?.open?.(x.sport);row.addEventListener("click",open);row.addEventListener("keydown",e=>{if(e.key==="Enter"||e.key===" "){e.preventDefault();open();}});liveRoot.append(row);});
    else liveRoot.append(make("p","live-centre-empty","No events are currently marked live in the published feeds. Live indicators appear only when a source explicitly reports an event or session as live."));
    const todayKey=today(),limit=new Date(Date.now()+7*86400000);const limitKey=new Intl.DateTimeFormat("en-CA",{timeZone:"Europe/London"}).format(limit);
    const upcoming=all.filter(x=>dateKey(dateValue(x.event))>=todayKey&&dateKey(dateValue(x.event))<=limitKey&&!isLive(x.event)).sort((a,b)=>timestamp(a.event)-timestamp(b.event)).slice(0,12);
    upcomingRoot.replaceChildren();
    if(upcoming.length)upcoming.forEach(x=>{const row=renderSummary(x.sport,x.event,false);row.classList.add("live-centre-upcoming");upcomingRoot.append(row);});
    else upcomingRoot.append(make("p","live-centre-empty","No upcoming events are listed for the next seven days in the currently loaded feeds."));
  }
  $("live-centre-calendar")?.addEventListener("click",()=>window.showScreen?.("calendar-screen"));
  $("open-version-history")?.addEventListener("click",e=>{e.preventDefault();window.showScreen?.("version-history-screen");});
  $("version-history-back")?.addEventListener("click",()=>window.showScreen?.("home-screen"));
  document.addEventListener("sports:feeds-updated",render);
  document.addEventListener("sports:boxing-data-updated",render);
  document.addEventListener("DOMContentLoaded",render);
  window.SportsCentreV11={refresh:render};
  render();
})();
