(() => {
  const order = ["f1", "darts", "boxing", "ufc"];
  const details = {
    f1: {name:"FORMULA 1",icon:"🏎️",title:"F1 calendar coming next",copy:"The Formula 1 calendar, practice sessions, qualifying, sprint weekends and race results will be connected in the next stage.",kicker:"MOTORSPORT"},
    darts: {name:"PDC DARTS",icon:"🎯",title:"PDC darts calendar coming next",copy:"The PDC tournament calendar will include the European Tour, Players Championship, majors and other PDC events. Live scores are not required.",kicker:"PDC TOUR"},
    boxing: {name:"BOXING",icon:"🥊",title:"Boxing fight calendar",copy:"Your existing boxing schedule, full fight cards, UK broadcasters and UK-fighter features remain in place.",kicker:"THE FIGHT GAME"},
    ufc: {name:"UFC",icon:"🥋",title:"UFC calendar coming next",copy:"Upcoming UFC events, complete fight cards, prelims, main cards and results will be connected in the next stage.",kicker:"MIXED MARTIAL ARTS"}
  };
  const rail=document.getElementById("sports-carousel");
  if(!rail)return;
  const slides=[...rail.querySelectorAll("[data-sport]")];
  const dots=document.getElementById("sports-carousel-dots");
  const content=document.getElementById("boxing-home-content");
  const coming=document.getElementById("sport-coming-soon");
  let active=0;
  const dotButtons=order.map((sport,index)=>{
    const b=document.createElement("button");b.type="button";b.className="carousel-dot";b.setAttribute("aria-label","Show "+details[sport].name);b.addEventListener("click",()=>go(index,true));dots.append(b);return b;
  });
  function select(index,manual=false){
    active=(index+order.length)%order.length;
    const sport=order[active],d=details[sport];
    slides.forEach((s,i)=>s.setAttribute("aria-pressed",String(i===active)));
    dotButtons.forEach((b,i)=>b.setAttribute("aria-current",String(i===active)));
    document.getElementById("sports-carousel-position").textContent=String(active+1).padStart(2,"0")+" / 04";
    document.getElementById("sport-coming-icon").textContent=d.icon;
    document.getElementById("sport-coming-kicker").textContent=d.kicker;
    document.getElementById("sport-coming-title").textContent=d.title;
    document.getElementById("sport-coming-copy").textContent=d.copy;
    const isBoxing=sport==="boxing";
    content.hidden=!isBoxing;coming.hidden=true;
    if(window.SportsData?.renderActive)window.SportsData.renderActive(sport);
    document.dispatchEvent(new CustomEvent("sports:select",{detail:{sport}}));
  }
  function go(index,manual=true){
    const next=(index+order.length)%order.length;
    const target=rail.scrollLeft+slides[next].getBoundingClientRect().left-rail.getBoundingClientRect().left;rail.scrollTo({left:target,behavior:window.matchMedia("(prefers-reduced-motion: reduce)").matches?"auto":"smooth"});
    select(next,manual);
  }
  slides.forEach((s,i)=>s.addEventListener("click",()=>go(i,true)));
  document.getElementById("sport-previous").addEventListener("click",()=>go(active-1,true));
  document.getElementById("sport-next").addEventListener("click",()=>go(active+1,true));
  let scrollTimer;
  rail.addEventListener("scroll",()=>{clearTimeout(scrollTimer);scrollTimer=setTimeout(()=>{let nearest=0,dist=Infinity;slides.forEach((s,i)=>{const d=Math.abs(s.getBoundingClientRect().left-rail.getBoundingClientRect().left);if(d<dist){dist=d;nearest=i;}});if(nearest!==active)select(nearest,true);},100);},{passive:true});
  select(0,false);
})();