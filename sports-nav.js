(() => {
  const root=document.getElementById("next-event-ticker");
  const topButtons=[...document.querySelectorAll("[data-top-sport]")];
  if(!root&&!topButtons.length)return;
  const order=["f1","darts","boxing","ufc","bkfc"];
  const labels={f1:"FORMULA 1",darts:"PDC DARTS",boxing:"BOXING",ufc:"UFC",bkfc:"BKFC"};
  const ukDate=value=>{if(!value)return "DATE TBC";const d=new Date(/^\d{4}-\d{2}-\d{2}$/.test(String(value))?String(value)+"T12:00:00Z":value);return Number.isNaN(d.getTime())?"DATE TBC":new Intl.DateTimeFormat("en-GB",{timeZone:"Europe/London",day:"numeric",month:"short"}).format(d).toUpperCase();};
  const eventDate=e=>e?.start_at||e?.date||e?.start_time_utc||null;
  function nextFor(sport){return sport==="boxing"?window.BoxingSchedule?.getNextEvent?.():window.SportsData?.getNextEvent?.(sport);}
  function openSport(sport){if(window.SportPages?.open){window.SportPages.open(sport);return;}window.showScreen?.("home-screen");window.SportsSelector?.goToSport(sport);}
  function setActiveSport(sport){topButtons.forEach(button=>{
    const active=button.dataset.topSport===sport;
    button.setAttribute("aria-pressed",String(active));
    button.classList.toggle("user-selected",active);
    if(active)button.setAttribute("aria-current","true");else button.removeAttribute("aria-current");
  });}
  function installLogoFallback(button){
    const image=button.querySelector("img");if(!image)return;
    const showFallback=()=>{
      if(!image.isConnected)return;
      const fallback=document.createElement("span");
      fallback.className="top-sport-wordmark top-sport-fallback";
      fallback.setAttribute("aria-hidden","true");
      fallback.textContent=button.dataset.logoFallback||button.dataset.topSport.toUpperCase();
      image.replaceWith(fallback);
    };
    image.addEventListener("error",showFallback,{once:true});
    if(image.complete&&image.naturalWidth===0)showFallback();
  }
  function render(){
    if(root){
      root.replaceChildren();
      order.forEach(sport=>{
      const event=nextFor(sport);
      const button=document.createElement("button");button.type="button";button.className="next-event-link";button.dataset.sport=sport;button.setAttribute("aria-label",labels[sport]+": "+(event?.name||event?.title||"No next event listed")+". Open "+labels[sport]);button.addEventListener("click",()=>openSport(sport));
      const meta=document.createElement("span");meta.className="next-event-meta";meta.append(document.createTextNode(labels[sport]));
      const date=document.createElement("span");date.className="next-event-date";date.textContent=event?ukDate(eventDate(event)):"AWAITING FIXTURE";meta.append(date);
      const name=document.createElement("strong");name.className="next-event-name";name.textContent=event?.name||event?.title||(sport==="boxing"?"No upcoming fight card":"No event published");
      const detail=document.createElement("small");detail.className="next-event-detail";detail.textContent=event?(event.location||event.venue||event.circuit||event.country||event.tier||"Tap to view event details"):"Tap to open sport schedule";
      button.append(meta,name,detail);root.append(button);
      });
    }
    setActiveSport(window.SportsSelector?.getActive?.()||"f1");
  }
  document.addEventListener("sports:feeds-updated",render);
  document.addEventListener("sports:boxing-data-updated",render);
  topButtons.forEach(button=>{
    installLogoFallback(button);
    button.addEventListener("click",()=>{setActiveSport(button.dataset.topSport);openSport(button.dataset.topSport);});
  });
  document.addEventListener("sports:select",event=>setActiveSport(event.detail?.sport));
  render();
  if(root)setInterval(render,30000);
})();
