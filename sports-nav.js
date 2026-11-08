(() => {
  const root=document.getElementById("next-event-ticker");
  if(!root)return;
  const order=["f1","darts","boxing","ufc","bkfc"];
  const labels={f1:"FORMULA 1",darts:"PDC DARTS",boxing:"BOXING",ufc:"UFC",bkfc:"BKFC"};
  const ukDate=value=>{if(!value)return "DATE TBC";const d=new Date(/^\d{4}-\d{2}-\d{2}$/.test(String(value))?String(value)+"T12:00:00Z":value);return Number.isNaN(d.getTime())?"DATE TBC":new Intl.DateTimeFormat("en-GB",{timeZone:"Europe/London",day:"numeric",month:"short"}).format(d).toUpperCase();};
  const eventDate=e=>e?.start_at||e?.date||e?.start_time_utc||null;
  function nextFor(sport){return sport==="boxing"?window.BoxingSchedule?.getNextEvent?.():window.SportsData?.getNextEvent?.(sport);}
  function openSport(sport){if(window.SportPages?.open){window.SportPages.open(sport);return;}window.showScreen?.("home-screen");window.SportsSelector?.goToSport(sport);}
  function render(){
    root.replaceChildren();
    order.forEach(sport=>{
      const event=nextFor(sport);
      const button=document.createElement("button");button.type="button";button.className="next-event-link";button.dataset.sport=sport;button.setAttribute("aria-label",labels[sport]+": "+(event?.name||event?.title||"No next event listed")+". Open "+labels[sport]);button.addEventListener("click",()=>openSport(sport));
      const meta=document.createElement("span");meta.className="next-event-meta";meta.append(document.createTextNode(labels[sport]));
      const date=document.createElement("span");date.className="next-event-date";date.textContent=event?ukDate(eventDate(event)):"AWAITING FIXTURE";meta.append(date);
      const name=document.createElement("strong");name.className="next-event-name";name.textContent=event?.name||event?.title||(sport==="boxing"?"No upcoming fight card":"No event published");
      const detail=document.createElement("small");detail.className="next-event-detail";detail.textContent=event?(event.location||event.venue||event.circuit||event.country||event.tier||"Tap to view event details"):"Tap to open sport schedule";
      button.append(meta,name,detail);
      const target=event&&(event.start_at||event.main_card_at||event.start_time_utc);
      if(target&&new Date(target).getTime()>Date.now()){
        const timer=document.createElement("span");timer.className="next-event-countdown";timer.dataset.countdownTarget=new Date(target).toISOString();timer.textContent=window.SportsCountdown?.text?.(target)||"COUNTDOWN";button.append(timer);
      }
      root.append(button);
    });
    
  }
  document.addEventListener("sports:feeds-updated",render);
  document.addEventListener("sports:boxing-data-updated",render);
  document.querySelectorAll("[data-top-sport]").forEach(button=>button.addEventListener("click",()=>{document.querySelectorAll("[data-top-sport]").forEach(item=>{item.classList.remove("user-selected");item.removeAttribute("aria-current");});button.classList.add("user-selected");button.setAttribute("aria-current","true");openSport(button.dataset.topSport);}));
  render();
  setInterval(render,30000);
  setInterval(()=>{root.querySelectorAll("[data-countdown-target]").forEach(node=>{const label=window.SportsCountdown?.text?.(node.dataset.countdownTarget);if(label)node.textContent=label;});},1000);
})();
