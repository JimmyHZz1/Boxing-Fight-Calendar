(() => {
  const order=["f1","darts","boxing","ufc","speedway","bkfc"];
  function openSport(sport){
    if(sport==="speedway"&&window.SpeedwayPage?.open){window.SpeedwayPage.open();return;}
    if(window.SportPages?.open){window.SportPages.open(sport);return;}
    window.showScreen?.("home-screen");
    window.SportsSelector?.goToSport(sport);
  }
  function syncTopSport(sport){
    document.querySelectorAll("[data-top-sport]").forEach(button=>{
      const selected=button.dataset.topSport===sport;
      button.classList.toggle("user-selected",selected);
      if(selected)button.setAttribute("aria-current","true");
      else button.removeAttribute("aria-current");
    });
  }
  document.addEventListener("sports:select",event=>syncTopSport(event.detail?.sport));
  document.addEventListener("sports:page-opened",event=>syncTopSport(event.detail?.sport));
  document.querySelectorAll("[data-top-sport]").forEach(button=>{
    button.addEventListener("click",()=>{
      syncTopSport(button.dataset.topSport);
      openSport(button.dataset.topSport);
    });
  });
})();
