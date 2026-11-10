/* Featured Games video stage, swipeable selection and TBC catalogue. */
(() => {
  const track=document.getElementById("games-featured-track");
  const tbcList=document.getElementById("games-tbc-list");
  const dialog=document.getElementById("games-discovery-dialog");
  const dialogContent=document.getElementById("games-discovery-dialog-content");
  const stage=document.getElementById("games-featured-stage");
  if(!track||!tbcList||!dialog||!dialogContent||!stage)return;
  const counter=document.getElementById("games-featured-counter");
  const dots=document.getElementById("games-featured-dots");
  let catalogue={featured:[],companies:[]},activeIndex=0,assetMap=new Map();
  const el=(tag,cls,txt)=>{const n=document.createElement(tag);if(cls)n.className=cls;if(txt!==undefined)n.textContent=txt;return n;};
  const safeUrl=u=>typeof u==="string"&&/^https:\/\//i.test(u);
  const norm=s=>String(s||"").toLowerCase().replace(/[^a-z0-9]+/g," ").trim();
  const imageCandidates=game=>[game.trailer_id?"https://img.youtube.com/vi/"+game.trailer_id+"/maxresdefault.jpg":null,game.trailer_id?"https://img.youtube.com/vi/"+game.trailer_id+"/hqdefault.jpg":null,assetMap.get(norm(game.title))?.artwork_url,assetMap.get(norm(game.title))?.logo_url,game.artwork_url,game.logo_url].filter((u,i,a)=>safeUrl(u)&&a.indexOf(u)===i);
  const addImage=(wrap,game,mode="cover")=>{
    wrap.replaceChildren();wrap.classList.add("has-artwork");
    const fallback=el("span","games-artwork-fallback",(game.title||"GAME").split(/\s+/).map(w=>w[0]).join("").slice(0,3).toUpperCase());
    wrap.append(fallback);
    const candidates=imageCandidates(game);if(!candidates.length)return;
    const img=document.createElement("img");img.alt=game.title+" artwork";img.loading="eager";img.decoding="async";img.referrerPolicy="no-referrer";if(mode==="cover")img.className="games-stage-art-image";
    let i=0;img.onerror=()=>{i++;if(i<candidates.length)img.src=candidates[i];else img.remove();};img.onload=()=>fallback.hidden=true;img.src=candidates[i];wrap.append(img);
  };
  const openDialog=()=>{dialog.hidden=false;document.body.classList.add("games-dialog-open");dialog.querySelector(".games-discovery-close")?.focus();};
  const closeDialog=()=>{dialog.hidden=true;dialogContent.replaceChildren();document.body.classList.remove("games-dialog-open");};
  dialog.addEventListener("click",e=>{if(e.target.closest("[data-games-dialog-close]"))closeDialog();});
  document.addEventListener("keydown",e=>{if(e.key==="Escape"&&!dialog.hidden)closeDialog();});
  const companyButton=(id,label)=>{const c=catalogue.companies.find(x=>x.id===id),b=el("button","games-company-game",label||(c?.name||"Company"));b.type="button";b.addEventListener("click",()=>showCompany(id));return b;};
  const makeTrailer=(game,cls)=>{
    const box=el("div",cls);
    if(game.trailer_id){
      const frame=document.createElement("iframe");frame.src="https://www.youtube-nocookie.com/embed/"+encodeURIComponent(game.trailer_id)+"?autoplay=1&mute=1&playsinline=1&rel=0";frame.title=game.title+" — "+(game.trailer_label||"official trailer");frame.loading="lazy";frame.referrerPolicy="strict-origin-when-cross-origin";frame.allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share";frame.allowFullscreen=true;box.append(frame);
    }else{
      const poster=el("div","games-stage-poster");addImage(poster,game);
      if(safeUrl(game.trailer_url)){const a=el("a","games-stage-watch","WATCH OFFICIAL TEASER ↗");a.href=game.trailer_url;a.target="_blank";a.rel="noopener noreferrer";poster.append(a);}
      box.append(poster);
    }
    return box;
  };
  const renderStage=game=>{
    stage.setAttribute("tabindex","0");stage.setAttribute("role","group");stage.setAttribute("aria-label","Featured game: "+game.title+". Swipe left or right to change game.");
    stage.replaceChildren();
    const media=makeTrailer(game,"games-featured-video");
    const copy=el("div","games-featured-stage-copy");
    copy.append(el("small","games-discovery-badge",game.date_status||"COMING SOON · DATE TBC"),el("h3","",game.title),el("p","",game.synopsis||"Officially announced game."));
    copy.append(el("div","games-stage-meta",(game.studio||"Developer TBC")+" · "+(game.publisher||"Publisher TBC")+"\n"+(game.date_label||"Release date TBC")),platformMarks(game.platforms));
    const actions=el("div","games-dialog-actions"),details=el("button","games-stage-details","GAME DETAILS + COMPANY INFO");details.type="button";details.addEventListener("click",()=>showGame(game));actions.append(details);
    if(safeUrl(game.official_url)){const a=el("a","","OFFICIAL PAGE ↗");a.href=game.official_url;a.target="_blank";a.rel="noopener noreferrer";actions.append(a);}
    copy.append(actions);stage.append(media,copy);
  };
  const showGame=game=>{
    dialogContent.replaceChildren();
    const hero=el("div","games-dialog-hero"),art=el("div","games-dialog-art");addImage(art,game);
    const copy=el("div");copy.append(el("small","games-discovery-badge",game.date_status||"COMING SOON · DATE TBC"),el("h2","games-dialog-title",game.title),el("div","games-dialog-meta",(game.studio||"Developer TBC")+" · "+(game.publisher||"Publisher TBC")+"\n"+(game.platforms||[]).join(" · ")+"\n"+(game.date_label||"Release date TBC")));
    const actions=el("div","games-dialog-actions");if(safeUrl(game.official_url)){const a=el("a","","OFFICIAL GAME PAGE ↗");a.href=game.official_url;a.target="_blank";a.rel="noopener noreferrer";actions.append(a);}if(game.trailer_id||safeUrl(game.trailer_url)){const a=el("a","","WATCH OFFICIAL TRAILER ↗");a.href=game.trailer_id?"https://www.youtube.com/watch?v="+game.trailer_id:game.trailer_url;a.target="_blank";a.rel="noopener noreferrer";actions.append(a);}copy.append(actions);hero.append(art,copy);dialogContent.append(hero);
    if(game.trailer_id)dialogContent.append(makeTrailer(game,"games-dialog-trailer"));
    const info=el("section","games-dialog-section");info.append(el("h3","","About this game"),el("p","",game.synopsis||"Officially announced game. Release date has not been confirmed."));dialogContent.append(info);
    const companies=el("section","games-dialog-section");companies.append(el("h3","","Developer & publisher"));const buttons=el("div","games-company-games");(game.company_ids||[]).forEach(id=>{const c=catalogue.companies.find(x=>x.id===id);if(c)buttons.append(companyButton(id,c.name));});companies.append(buttons);dialogContent.append(companies);
    const source=el("section","games-dialog-section");source.append(el("h3","","Announcement & status"),el("p","","Release status and trailer information are taken from official announcements. Dates remain TBC until the publisher confirms them."));if(safeUrl(game.source_url)){const a=el("a","","VIEW SOURCE ↗");a.href=game.source_url;a.target="_blank";a.rel="noopener noreferrer";a.style.color="#9bcaff";source.append(a);}dialogContent.append(source);openDialog();
  };
  const showCompany=id=>{
    const c=catalogue.companies.find(x=>x.id===id);if(!c)return;dialogContent.replaceChildren();
    const head=el("section","games-dialog-section");head.append(el("small","games-discovery-badge","DEVELOPER / PUBLISHER"),el("h2","games-dialog-title",c.name),el("p","games-dialog-meta","Explore games associated with this company, including past releases and announced projects."));const link=el("a","","OFFICIAL COMPANY WEBSITE ↗");link.href=c.website;link.target="_blank";link.rel="noopener noreferrer";link.style.color="#9bcaff";head.append(link);dialogContent.append(head);
    const section=el("section","games-dialog-section");section.append(el("h3","","Games & releases"));const list=el("div","games-company-games");(c.games||[]).forEach(title=>{const game=catalogue.featured.find(g=>g.title===title);if(game){const b=el("button","games-company-game",title);b.type="button";b.addEventListener("click",()=>showGame(game));list.append(b);}else list.append(el("span","games-company-game",title));});section.append(list);dialogContent.append(section);const back=el("button","games-company-game","← BACK TO FEATURED GAMES");back.type="button";back.addEventListener("click",closeDialog);dialogContent.append(back);openDialog();
  };
  const platformAsset=platform=>{
    const value=String(platform||"").toLowerCase();
    if(value.includes("playstation")||value.includes("ps5")||value.includes("ps4"))return ["playstation","PLAYSTATION"];
    if(value.includes("xbox"))return ["xbox","XBOX"];
    if(value.includes("nintendo")||value.includes("switch"))return ["nintendo","NINTENDO"];
    if(value.includes("steam"))return ["steam","STEAM"];
    if(value==="pc"||value.startsWith("pc "))return ["windows","PC"];
    return ["game-controller","PC & CONSOLE"];
  };
  const platformMarks=platforms=>{
    const row=el("div","games-stage-platforms");
    (platforms||[]).forEach(name=>{
      const [slug,label]=platformAsset(name),item=el("span","games-stage-platform");
      const img=document.createElement("img");img.src="./assets/platform-"+slug+".svg";img.alt="";img.loading="eager";img.decoding="async";img.onerror=()=>{img.replaceWith(el("b","games-stage-platform-fallback",label==="PLAYSTATION"?"PS":label==="NINTENDO"?"N":label==="XBOX"?"X":label==="STEAM"?"S":"PC"));};
      item.append(img,el("small","",label));row.append(item);
    });
    return row;
  };
  const updatePosition=()=>{
    if(counter)counter.textContent=String(activeIndex+1).padStart(2,"0")+" / "+String(Math.min(5,catalogue.featured.length)).padStart(2,"0");
    [...dots.children].forEach((dot,i)=>dot.setAttribute("aria-current",String(i===activeIndex)));
    [...track.children].forEach((card,i)=>card.setAttribute("aria-pressed",String(i===activeIndex)));
  };
  const selectFeatured=(index,scroll=true)=>{
    const games=catalogue.featured.slice(0,5);if(!games.length)return;
    activeIndex=(index+games.length)%games.length;
    if(scroll){const card=track.children[activeIndex];if(card)track.scrollTo({left:card.offsetLeft-track.offsetLeft,behavior:"smooth"});}
    renderStage(games[activeIndex]);updatePosition();
  };
  const renderFeatured=()=>{
    track.replaceChildren();dots.replaceChildren();
    catalogue.featured.slice(0,5).forEach((game,index)=>{
      const card=el("button","games-discovery-slide");card.type="button";card.setAttribute("aria-label","Show "+game.title);card.setAttribute("aria-pressed",String(index===activeIndex));
      const art=el("span","games-discovery-art");addImage(art,game,"thumb");
      const copy=el("span","games-discovery-copy");copy.append(el("small","",game.studio+" · "+game.publisher),el("strong","",game.title),el("span","",game.date_label||"Release date TBC"),el("span","games-discovery-badge",game.date_status||"COMING SOON · DATE TBC"));card.append(art,copy);
      card.addEventListener("click",()=>selectFeatured(index,false));track.append(card);
      const dot=el("button");dot.type="button";dot.setAttribute("aria-label","Show featured game "+(index+1));dot.addEventListener("click",()=>selectFeatured(index,true));dots.append(dot);
    });
    let scrollTimer=0;
    track.addEventListener("scroll",()=>{
      clearTimeout(scrollTimer);
      scrollTimer=setTimeout(()=>{
        const cards=[...track.children];if(!cards.length)return;
        const center=track.getBoundingClientRect().left+track.clientWidth/2;
        let best=0,delta=Infinity;
        cards.forEach((card,i)=>{const rect=card.getBoundingClientRect(),distance=Math.abs(rect.left+rect.width/2-center);if(distance<delta){delta=distance;best=i;}});
        if(best!==activeIndex){activeIndex=best;renderStage(catalogue.featured[best]);}
        updatePosition();
      },110);
    },{passive:true});
    selectFeatured(0,false);
  };
  let stageTouchX=0;
  stage.addEventListener("touchstart",event=>{stageTouchX=event.changedTouches[0]?.clientX||0;},{passive:true});
  stage.addEventListener("touchend",event=>{const endX=event.changedTouches[0]?.clientX||0,delta=endX-stageTouchX;if(Math.abs(delta)>55)selectFeatured(activeIndex+(delta<0?1:-1),true);},{passive:true});
  stage.addEventListener("keydown",event=>{if(event.key==="ArrowRight")selectFeatured(activeIndex+1,true);if(event.key==="ArrowLeft")selectFeatured(activeIndex-1,true);});
  const renderTbc=()=>{
    const games=catalogue.featured.filter(g=>!g.release_date);tbcList.replaceChildren();
    const count=document.getElementById("games-tbc-count");if(count)count.textContent=games.length+" GAMES";
    if(!games.length){tbcList.append(el("p","games-discovery-loading","No qualifying announced games currently meet the official trailer requirement."));return;}
    games.forEach(game=>{const card=el("button","games-tbc-card");card.type="button";const art=el("span","games-tbc-art");addImage(art,game,"thumb");const copy=el("span","games-tbc-card-copy");copy.append(el("small","games-tbc-label","TBC · NO CONFIRMED DATE"),el("strong","",game.title),el("small","",game.studio+" · "+game.publisher),el("small","",game.trailer_label||"Official teaser available"));card.append(art,copy);card.addEventListener("click",()=>showGame(game));tbcList.append(card);});
  };
  document.getElementById("games-featured-prev")?.addEventListener("click",()=>selectFeatured(activeIndex-1,true));
  document.getElementById("games-featured-next")?.addEventListener("click",()=>selectFeatured(activeIndex+1,true));
  Promise.all([
    fetch("./data/games-discovery.json?v=20261110-02",{cache:"no-store"}).then(r=>{if(!r.ok)throw Error("Featured catalogue unavailable");return r.json();}),
    fetch("./data/games-popularity.json?v=20261110-02",{cache:"no-store"}).then(r=>r.ok?r.json():{games:[]}).catch(()=>({games:[]}))
  ]).then(([data,pop])=>{
    (pop.games||[]).forEach(g=>{if(g.title)assetMap.set(norm(g.title),{artwork_url:g.artwork_url||null,logo_url:g.logo_url||null});});
    catalogue=data;renderFeatured();renderTbc();
  }).catch(error=>{console.warn("Games discovery catalogue unavailable",error);track.replaceChildren(el("p","games-discovery-loading","Featured games are temporarily unavailable."));tbcList.replaceChildren(el("p","games-discovery-loading","The TBC list is temporarily unavailable."));});
})();