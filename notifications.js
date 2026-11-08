(() => {
  const PREF_KEY="sports-calendar-alert-preferences-v1";
  const SENT_KEY="sports-calendar-alerts-sent-v1";
  const $=id=>document.getElementById(id);
  const defaults={enabled:false,favourites:true,leadMinutes:60};
  let prefs={...defaults};
  let sent={};
  try{prefs={...defaults,...JSON.parse(localStorage.getItem(PREF_KEY)||"{}")};}catch(_){}
  try{sent=JSON.parse(localStorage.getItem(SENT_KEY)||"{}");}catch(_){}
  const normalise=value=>String(value||"").normalize("NFKD").replace(/[\u0300-\u036f]/g,"").toLowerCase().replace(/[^a-z0-9]+/g," ").trim();
  const today=()=>new Intl.DateTimeFormat("en-CA",{timeZone:"Europe/London"}).format(new Date());
  function events(){
    const out=[];
    for(const sport of ["f1","darts","ufc","bkfc"])(window.SportsData?.getEvents?.(sport,true)||[]).forEach(event=>out.push({sport,event}));
    (window.BoxingSchedule?.getEvents?.()||[]).forEach(event=>out.push({sport:"boxing",event}));
    return out;
  }
  function favourites(){try{return JSON.parse(localStorage.getItem("sports-calendar-my-favourites-v1")||"[]");}catch(_){return [];}}
  function isFavourite(sport,event){
    const people=favourites().filter(f=>f.sport===sport);
    if(!people.length)return false;
    const bouts=event.bouts||event.fights||[];
    const results=event.results||[];
    const haystack=normalise([event.name,event.title,event.team,event.driver,event.location,...results.flatMap(r=>[r.driver,r.team]),...bouts.flatMap(b=>[b.fighter1,b.fighter2,b.fighter_a?.name||b.fighter_a,b.fighter_b?.name||b.fighter_b,b.red_corner,b.blue_corner])].filter(Boolean).join(" "));
    return people.some(f=>haystack.includes(normalise(f.name)));
  }
  function eventTime(event){
    const raw=event.start_at||event.start_time_utc||event.main_card_at||event.race_start_at||event.date||event.event_date;
    if(!raw)return null;
    if(/^\d{4}-\d{2}-\d{2}$/.test(String(raw)))return {dateOnly:true,key:String(raw),time:null};
    const date=new Date(raw);
    return Number.isNaN(date.getTime())?null:{dateOnly:false,key:String(raw).slice(0,10),time:date.getTime()};
  }
  async function notify(title,body,tag){
    if(!("Notification" in window)||Notification.permission!=="granted")return false;
    try{
      const registration=await navigator.serviceWorker?.ready;
      if(registration?.showNotification)await registration.showNotification(title,{body,tag});
      else new Notification(title,{body,tag});
      return true;
    }catch(_){return false;}
  }
  function persist(){try{localStorage.setItem(PREF_KEY,JSON.stringify(prefs));}catch(_){}}
  function status(message){const node=$("alerts-status");if(node)node.textContent=message;}
  function syncControls(){
    if($("alerts-enabled"))$("alerts-enabled").checked=!!prefs.enabled;
    if($("alerts-favourites"))$("alerts-favourites").checked=!!prefs.favourites;
    if($("alerts-lead-time"))$("alerts-lead-time").value=String(prefs.leadMinutes);
    if(!("Notification" in window))status("This browser does not support notifications.");
    else if(Notification.permission==="denied")status("Notifications are blocked in browser settings.");
    else if(!prefs.enabled)status("Notifications are off.");
    else if(Notification.permission==="granted")status("Reminders enabled. They are checked while the app is open.");
    else status("Turn on reminders and allow notification permission.");
  }
  async function requestPermission(){
    if(!("Notification" in window)){status("This browser does not support notifications.");return false;}
    if(Notification.permission==="granted")return true;
    if(Notification.permission==="denied"){status("Notifications are blocked. Change permission in browser settings.");return false;}
    const result=await Notification.requestPermission();
    status(result==="granted"?"Permission granted. Reminders are enabled while the app is open.":"Permission was not granted.");
    return result==="granted";
  }
  async function check(){
    if(!prefs.enabled||!("Notification" in window)||Notification.permission!=="granted")return;
    const now=Date.now(),lead=Number(prefs.leadMinutes)*60000;
    for(const item of events()){
      const sport=item.sport,event=item.event,when=eventTime(event);
      if(!when)continue;
      if(prefs.favourites&&!isFavourite(sport,event))continue;
      let due=false,body="";
      if(when.dateOnly){if(when.key===today()){due=true;body="Today · exact start time not published.";}}
      else{
        const remaining=when.time-now;
        if(remaining>0&&remaining<=lead){due=true;body="Starts in "+Math.max(1,Math.ceil(remaining/60000))+" minutes (UK time).";}
      }
      const id=String(event.id||sport+"-"+normalise(event.name||event.title)+"-"+when.key);
      if(!due||sent[id])continue;
      const ok=await notify((event.name||event.title||sport.toUpperCase())+" · "+sport.toUpperCase(),body,id);
      if(ok){sent[id]=new Date().toISOString();try{localStorage.setItem(SENT_KEY,JSON.stringify(sent));}catch(_){}}
    }
  }
  $("alerts-enabled")?.addEventListener("change",async e=>{
    prefs.enabled=e.target.checked;
    if(prefs.enabled&&!await requestPermission()){prefs.enabled=false;e.target.checked=false;}
    persist();syncControls();check();
  });
  $("alerts-favourites")?.addEventListener("change",e=>{prefs.favourites=e.target.checked;persist();syncControls();check();});
  $("alerts-lead-time")?.addEventListener("change",e=>{prefs.leadMinutes=Number(e.target.value)||60;persist();});
  $("alerts-test")?.addEventListener("click",async()=>{
    if(!await requestPermission())return;
    const ok=await notify("Sports Calendar test","Notifications are working on this device.","sports-calendar-test");
    status(ok?"Test notification sent.":"The notification could not be displayed on this device.");
  });
  document.addEventListener("sports:feeds-updated",check);
  document.addEventListener("sports:boxing-data-updated",check);
  document.addEventListener("visibilitychange",()=>{if(document.visibilityState==="visible")check();});
  syncControls();check();
  setInterval(()=>{if(document.visibilityState==="visible")check();},60000);
  window.SportsCalendarAlerts={check,preferences:()=>({...prefs})};
})();