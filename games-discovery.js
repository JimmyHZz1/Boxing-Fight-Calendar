/* Official trailer-led Games Calendar discovery carousel and TBC catalogue. */
(() => {
  const track=document.getElementById("games-featured-track");
  const tbcList=document.getElementById("games-tbc-list");
  const dialog=document.getElementById("games-discovery-dialog");
  const dialogContent=document.getElementById("games-discovery-dialog-content");
  if(!track||!tbcList||!dialog||!dialogContent)return;
  const counter=document.getElementById("games-featured-counter");
  const dots=document.getElementById("games-featured-dots");
  const dataUrl="./data/games-discovery.json";
  let catalogue={featured:[],companies:[]};
  let activeIndex=0;
  const el=(tag,cls,text)=>{const node=document.createElement(tag);if(cls)node.className=cls;if(text!==undefined)node.textContent=text;return node;};
  const safeUrl=value=>typeof value==="string"&&/^https:\/\//i.test(value);
  const imageWithFallback=(wrap,url,title)=>{wrap.textContent=(title||"GAME").split(/\s+/).map(w=>w[0]).join("").slice(0,3).toUpperCase();if(!safeUrl(url))return;const img=document.createElement("img");img.src=url;img.alt=title+" artwork";img.loading="lazy";img.onerror=()=>img.remove();wrap.append(img);};
  const openDialog=()=>{dialog.hidden=false;document.body.classList.add("games-dialog-open");dialog.querySelector(".games-discovery-close")?.focus();};
  const closeDialog=()=>{dialog.hidden=true;dialogContent.replaceChildren();document.body.classList.remove("games-dialog-open");};
  dialog.addEventListener("click",e=>{if(e.target.closest("[data-games-dialog-close]"))closeDialog();});
  document.addEventListener("keydown",e=>{if(e.key==="Escape"&&!dialog.hidden)closeDialog();});
  const companyButton=(id,label)=>{const company=catalogue.companies.find(c=>c.id===id);const btn=el("button","games-company-game",label||(company?.name||"Company"));btn.type="button";btn.addEventListener("click",()=>showCompany(id));return btn;};
  const showGame=game=>{
    dialogContent.replaceChildren();
    const hero=el("div","games-dialog-hero"),art=el("div","games-dialog-art");imageWithFallback(art,game.artwork_url,game.title);
    const copy=el("div");copy.append(el("small","games-discovery-badge",game.date_status||"COMING SOON · DATE TBC"),el("h2","games-dialog-title",game.title),el("div","games-dialog-meta",(game.studio||"Developer TBC")+" · "+(game.publisher||"Publisher TBC")+"\n"+(game.platforms||[]).join(" · ")+"\n"+(game.date_label||"Release date TBC")));
    const actions=el("div","games-dialog-actions");if(safeUrl(game.official_url)){const a=el("a","","OFFICIAL GAME PAGE ↗");a.href=game.official_url;a.target="_blank";a.rel="noopener noreferrer";actions.append(a);}if(game.trailer_id||safeUrl(game.trailer_url)){const a=el("a","","WATCH OFFICIAL TRAILER ↗");a.href=game.trailer_id?"https://www.youtube.com/watch?v="+game.trailer_id:game.trailer_url;a.target="_blank";a.rel="noopener noreferrer";actions.append(a);}copy.append(actions);hero.append(art,copy);dialogContent.append(hero);
    if(game.trailer_id){const frame=el("div","games-dialog-trailer");const iframe=document.createElement("iframe");iframe.src="https://www.youtube-nocookie.com/embed/"+encodeURIComponent(game.trailer_id)+"?rel=0";iframe.title=game.title+" — "+(game.trailer_label||"official trailer");iframe.loading="lazy";iframe.allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share";iframe.allowFullscreen=true;frame.append(iframe);dialogContent.append(frame);}
    const info=el("section","games-dialog-section");info.append(el("h3","","About this game"),el("p","",game.synopsis||"Officially announced game. Release date has not been confirmed."));dialogContent.append(info);
    const companies=el("section","games-dialog-section");companies.append(el("h3","","Developer & publisher"));const buttons=el("div","games-company-games");(game.company_ids||[]).forEach(id=>{const c=catalogue.companies.find(x=>x.id===id);if(c)buttons.append(companyButton(id,c.name));});companies.append(buttons);dialogContent.append(companies);
    const source=el("section","games-dialog-section");source.append(el("h3","","Announcement & status"));const p=el("p","","Release status and trailer information are taken from official announcements. Dates remain TBC until the publisher confirms them.");source.append(p);if(safeUrl(game.source_url)){const a=el("a","","VIEW SOURCE ↗");a.href=game.source_url;a.target="_blank";a.rel="noopener noreferrer";a.style.color="#9bcaff";source.append(a);}dialogContent.append(source);openDialog();
  };
  const showCompany=id=>{
    const c=catalogue.companies.find(x=>x.id===id);if(!c)return;dialogContent.replaceChildren();
    const head=el("section","games-dialog-section");head.append(el("small","games-discovery-badge","DEVELOPER / PUBLISHER"),el("h2","games-dialog-title",c.name),el("p","games-dialog-meta","Explore games associated with this company, including past releases and announced projects."));const link=el("a","","OFFICIAL COMPANY WEBSITE ↗");link.href=c.website;link.target="_blank";link.rel="noopener noreferrer";link.style.color="#9bcaff";head.append(link);dialogContent.append(head);
    const section=el("section","games-dialog-section");section.append(el("h3","","Games & releases"));const list=el("div","games-company-games");(c.games||[]).forEach(title=>{const game=catalogue.featured.find(g=>g.title===title);if(game){const b=el("button","games-company-game",title);b.type="button";b.addEventListener("click",()=>showGame(game));list.append(b);}else list.append(el("span","games-company-game",title));});section.append(list);dialogContent.append(section);const back=el("button","games-company-game","← BACK TO FEATURED GAMES");back.type="button";back.addEventListener("click",()=>{closeDialog();});dialogContent.append(back);openDialog();
  };
  const renderFeatured=()=>{
    track.replaceChildren();dots.replaceChildren();
    catalogue.featured.slice(0,5).forEach((game,index)=>{
      const card=el("button","games-discovery-slide");card.type="button";card.setAttribute("aria-label","More about "+game.title);const art=el("span","games-discovery-art");imageWithFallback(art,game.artwork_url,game.title);
      const copy=el("span","games-discovery-copy");copy.append(el("small","",game.studio+" · "+game.publisher),el("strong","",game.title),el("span","",game.date_label||"Release date TBC"),el("span","games-discovery-badge",game.date_status||"COMING SOON · DATE TBC"),el("span","","VIEW GAME DETAILS →"));card.append(art,copy);card.addEventListener("click",()=>showGame(game));track.append(card);
      const dot=el("button");dot.type="button";dot.setAttribute("aria-label","Show featured game "+(index+1));dot.addEventListener("click",()=>track.scrollTo({left:card.offsetLeft-track.offsetLeft,behavior:"smooth"}));dots.append(dot);
    });
    const update=()=>{const width=track.clientWidth||1;activeIndex=Math.max(0,Math.min(catalogue.featured.length-1,Math.round(track.scrollLeft/width)));if(counter)counter.textContent=String(activeIndex+1).padStart(2,"0")+" / "+String(catalogue.featured.length).padStart(2,"0");[...dots.children].forEach((d,i)=>d.setAttribute("aria-current",String(i===activeIndex)));};
    track.addEventListener("scroll",()=>requestAnimationFrame(update),{passive:true});update();
  };
  const renderTbc=()=>{
    const games=catalogue.featured.filter(g=>!g.release_date);
    tbcList.replaceChildren();const count=document.getElementById("games-tbc-count");if(count)count.textContent=games.length+" GAMES";
    if(!games.length){tbcList.append(el("p","games-discovery-loading","No qualifying announced games currently meet the official trailer requirement."));return;}
    games.forEach(game=>{const card=el("button","games-tbc-card");card.type="button";const art=el("span","games-tbc-art");imageWithFallback(art,game.artwork_url,game.title);const copy=el("span","games-tbc-card-copy");copy.append(el("small","games-tbc-label","TBC · NO CONFIRMED DATE"),el("strong","",game.title),el("small","",game.studio+" · "+game.publisher),el("small","",game.trailer_label||"Official teaser available"));card.append(art,copy);card.addEventListener("click",()=>showGame(game));tbcList.append(card);});
  };
  const move=direction=>{const cards=[...track.children];const next=Math.max(0,Math.min(cards.length-1,activeIndex+direction));cards[next]?.scrollIntoView({behavior:"smooth",block:"nearest",inline:"start"});};
  document.getElementById("games-featured-prev")?.addEventListener("click",()=>move(-1));document.getElementById("games-featured-next")?.addEventListener("click",()=>move(1));
  fetch(dataUrl+"?v=20261110-01",{cache:"no-store"}).then(r=>{if(!r.ok)throw new Error("Discovery catalogue unavailable");return r.json();}).then(data=>{catalogue=data;renderFeatured();renderTbc();}).catch(error=>{console.warn("Games discovery catalogue unavailable",error);track.replaceChildren(el("p","games-discovery-loading","Featured games are temporarily unavailable."));tbcList.replaceChildren(el("p","games-discovery-loading","The TBC list is temporarily unavailable."));});
})();