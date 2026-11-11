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
  const companyLogoUrl=company=>{try{return "https://www.google.com/s2/favicons?domain="+encodeURIComponent(new URL(company.website).hostname)+"&sz=128";}catch{return "";}};
  const addCompanyMark=(parent,company)=>{const url=company.logo_url||companyLogoUrl(company);if(!url)return;const img=document.createElement("img");img.className="games-company-logo";img.src=url;img.alt=company.name+" logo";img.loading="lazy";img.onerror=()=>img.remove();parent.append(img);};
  const norm=s=>String(s||"").toLowerCase().replace(/[^a-z0-9]+/g," ").trim();
  const imageCandidates=game=>{const id=game.trailer_id;const asset=assetMap.get(norm(game.title))||{};return [asset.artwork_url,game.artwork_url,asset.logo_url,game.logo_url,id?"https://i.ytimg.com/vi/"+id+"/hqdefault.jpg":null,id?"https://img.youtube.com/vi/"+id+"/hqdefault.jpg":null,id?"https://i.ytimg.com/vi/"+id+"/sddefault.jpg":null,id?"https://img.youtube.com/vi/"+id+"/0.jpg":null,id?"https://i.ytimg.com/vi/"+id+"/0.jpg":null].filter((u,i,a)=>safeUrl(u)&&a.indexOf(u)===i);};
  const addImage=(wrap,game,mode="cover")=>{
    wrap.replaceChildren();wrap.classList.add("has-artwork");
    const fallback=el("span","games-artwork-fallback",(game.title||"GAME").split(/\s+/).map(w=>w[0]).join("").slice(0,3).toUpperCase());
    wrap.append(fallback);
    const candidates=imageCandidates(game);if(!candidates.length)return;
    const img=document.createElement("img");img.alt=game.title+" artwork";img.loading="eager";img.decoding="async";img.referrerPolicy="no-referrer";if(mode==="cover")img.className="games-stage-art-image";
    let i=0;img.onerror=()=>{i++;if(i<candidates.length)img.src=candidates[i];else img.remove();};img.onload=()=>fallback.hidden=true;img.src=candidates[i];wrap.append(img);
  };
  const openDialog=()=>{dialog.hidden=false;document.body.classList.add("games-dialog-open");dialog.querySelector(".games-discovery-close")?.focus();};
  const closeDialog=()=>{dialog.hidden=true;dialogContent.replaceChildren();document.body.classList.remove("games-dialog-open","games-company-profile-open");};
  dialog.addEventListener("click",e=>{if(e.target.closest("[data-games-dialog-close]"))closeDialog();});
  document.addEventListener("keydown",e=>{if(e.key==="Escape"&&!dialog.hidden)closeDialog();});
  const companyButton=(id,label)=>{const c=catalogue.companies.find(x=>x.id===id),b=el("button","games-company-game",label||(c?.name||"Company"));b.type="button";b.addEventListener("click",()=>showCompany(id));return b;};
  const makeTrailer=(game,cls)=>{
    const box=el("div",cls);
    if(game.trailer_id){
      const frame=document.createElement("iframe");frame.src="https://www.youtube-nocookie.com/embed/"+encodeURIComponent(game.trailer_id)+"?autoplay=1&mute=1&playsinline=1&rel=0";frame.title=game.title+" — "+(game.trailer_label||"official trailer");frame.loading="eager";frame.referrerPolicy="strict-origin-when-cross-origin";frame.allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share";frame.allowFullscreen=true;box.append(frame);
    }else{
      const poster=el("div","games-stage-poster");poster.append(el("strong","games-no-video","OFFICIAL VIDEO NOT AVAILABLE"));
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
    const intro=el("div","games-featured-intro");
    intro.append(el("small","games-discovery-badge",game.date_status||"COMING SOON · DATE TBC"),el("h3","",game.title),el("p","",game.synopsis||"Officially announced game."));
    const panel=el("aside","games-featured-info");
    panel.append(el("div","games-featured-info-status",game.date_label||"Release date TBC"));
    const releaseCountdown = el("div","games-featured-info-countdown");
    releaseCountdown.append(el("span","games-featured-info-label","RELEASE COUNTDOWN"));
    let countdownText = "AWAITING A CONFIRMED DATE";
    if (/^\\d{4}-\\d{2}-\\d{2}$/.test(String(game.release_date||""))) {
      const today = new Intl.DateTimeFormat("en-CA",{timeZone:"Europe/London",year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date());
      const days = Math.ceil((Date.parse(game.release_date+"T00:00:00Z")-Date.parse(today+"T00:00:00Z"))/86400000);
      countdownText = days < 0 ? "RELEASED" : days === 0 ? "OUT TODAY" : days+" DAYS TO GO";
    }
    releaseCountdown.append(el("strong","",countdownText));
    panel.append(releaseCountdown);
    const credits=el("div","games-featured-info-row");
    credits.append(el("span","games-featured-info-label","DEVELOPER / PUBLISHER"));
    const companyLinks=el("div","games-featured-company-links");
    (game.company_ids||[]).map(id=>catalogue.companies.find(x=>x.id===id)).filter(Boolean).forEach((company,index)=>{
      if(index)companyLinks.append(el("span","games-featured-company-separator","·"));
      const link=el("button","games-profile-link");link.type="button";addCompanyMark(link,company);link.append(document.createTextNode(company.name));link.title="View "+company.name+" profile";link.addEventListener("click",()=>showCompany(company.id));companyLinks.append(link);
    });
    credits.append(companyLinks);panel.append(credits);
    const platforms=el("div","games-featured-info-row");
    platforms.append(el("span","games-featured-info-label","AVAILABLE PLATFORMS"),platformMarks(game.platforms,true));
    panel.append(platforms);
    const links=el("div","games-featured-info-links");
    if(safeUrl(game.official_url)){const a=el("a","","OFFICIAL GAME WEBSITE ↗");a.href=game.official_url;a.target="_blank";a.rel="noopener noreferrer";links.append(a);}
    if(safeUrl(game.source_url)&&game.source_url!==game.official_url){const a=el("a","","OFFICIAL ANNOUNCEMENT ↗");a.href=game.source_url;a.target="_blank";a.rel="noopener noreferrer";links.append(a);}
    const details=el("button","games-stage-details","MORE GAME DETAILS");details.type="button";details.addEventListener("click",()=>showGame(game));links.append(details);
    panel.append(links);
    copy.append(intro,panel);stage.append(media,copy);
  };
  const showGame=game=>{
    dialogContent.replaceChildren();
    const copy=el("section","games-dialog-section");
    copy.append(el("small","games-discovery-badge",game.date_status||"COMING SOON · DATE TBC"),el("h2","games-dialog-title",game.title),el("p","games-dialog-meta",(game.studio||"Developer TBC")+" · "+(game.publisher||"Publisher TBC")),el("p","games-dialog-meta",game.date_label||"Release date TBC"));
    const actions=el("div","games-dialog-actions");
    if(safeUrl(game.official_url)){const link=el("a","","OFFICIAL GAME PAGE ↗");link.href=game.official_url;link.target="_blank";link.rel="noopener noreferrer";actions.append(link);}
    if(game.trailer_id||safeUrl(game.trailer_url)){const link=el("a","","WATCH OFFICIAL TRAILER ↗");link.href=game.trailer_id?"https://www.youtube.com/watch?v="+game.trailer_id:game.trailer_url;link.target="_blank";link.rel="noopener noreferrer";actions.append(link);}
    copy.append(actions);dialogContent.append(copy);
    if(game.trailer_id)dialogContent.append(makeTrailer(game,"games-dialog-trailer"));
    const about=el("section","games-dialog-section");about.append(el("h3","","About this game"),el("p","",game.synopsis||"Officially announced game. Release date has not been confirmed."));dialogContent.append(about);
    const platforms=el("section","games-dialog-section");platforms.append(el("h3","","Platforms"),platformMarks(game.platforms));dialogContent.append(platforms);
    const companies=el("section","games-dialog-section");companies.append(el("h3","","Developer & publisher"));const buttons=el("div","games-company-games");(game.company_ids||[]).forEach(id=>{const company=catalogue.companies.find(x=>x.id===id);if(company)buttons.append(companyButton(id,company.name));});companies.append(buttons);dialogContent.append(companies);
    const status=el("section","games-dialog-section");status.append(el("h3","","Announcement & release status"),el("p","","Release date: "+(game.date_label||"TBC")+". Status: "+(game.date_status||"COMING SOON · DATE TBC")+". Dates are only shown as confirmed when supported by an official announcement."));if(safeUrl(game.source_url)){const link=el("a","","VIEW OFFICIAL ANNOUNCEMENT ↗");link.href=game.source_url;link.target="_blank";link.rel="noopener noreferrer";link.style.color="#9bcaff";status.append(link);}dialogContent.append(status);openDialog();
  };
  let profileData={companies:[]},companyPreviousNodes=null;
  const profileDate=value=>{if(!value)return "Date not listed";const d=new Date(value);return Number.isNaN(d.getTime())?String(value):new Intl.DateTimeFormat("en-GB",{day:"numeric",month:"short",year:"numeric",timeZone:"UTC"}).format(d);};
  const showCompany=id=>{
    const c=profileData.companies.find(x=>x.id===id)||catalogue.companies.find(x=>x.id===id);if(!c)return;
    companyPreviousNodes=null;if(!dialog.hidden){companyPreviousNodes=document.createDocumentFragment();while(dialogContent.firstChild)companyPreviousNodes.append(dialogContent.firstChild);}
    dialogContent.replaceChildren();document.body.classList.add("games-company-profile-open");
    const back=el("button","games-profile-back","← BACK");back.type="button";back.addEventListener("click",()=>{document.body.classList.remove("games-company-profile-open");if(companyPreviousNodes){dialogContent.replaceChildren(companyPreviousNodes);companyPreviousNodes=null;openDialog();}else closeDialog();});dialogContent.append(back);
    const head=el("section","games-dialog-section games-company-profile-head"),identity=el("div","games-company-identity");
    addCompanyMark(identity,c);identity.append(el("h2","games-dialog-title",c.name));head.append(identity);
    if(c.description)head.append(el("p","games-dialog-meta",c.description));
    const facts=el("div","games-company-facts");if(c.founded)facts.append(el("span","","FOUNDED "+c.founded));if(c.parent_name)facts.append(el("span","","PART OF "+c.parent_name));head.append(facts);
    if(safeUrl(c.website)){const link=el("a","games-company-official","OFFICIAL COMPANY WEBSITE ↗");link.href=c.website;link.target="_blank";link.rel="noopener noreferrer";head.append(link);}dialogContent.append(head);
    const releases=c.releases||[],today=new Date().toISOString().slice(0,10);
    const upcoming=releases.filter(g=>g.release_date&&g.release_date>=today).sort((x,y)=>x.release_date.localeCompare(y.release_date));
    const previous=releases.filter(g=>!g.release_date||g.release_date<today).sort((x,y)=>(y.release_date||"").localeCompare(x.release_date||""));
    const section=(title,items,empty)=>{const box=el("section","games-dialog-section games-company-release-section");box.append(el("h3","",title+" · "+items.length));if(!items.length)box.append(el("p","games-company-empty",empty));const list=el("div","games-company-release-list");items.forEach(g=>{const row=el("article","games-company-release");if(g.artwork_url){const img=document.createElement("img");img.src=g.artwork_url;img.alt="";img.loading="lazy";img.onerror=()=>img.remove();row.append(img);}const copy=el("div","games-company-release-copy");copy.append(el("strong","",g.title),el("small","",g.release_label||profileDate(g.release_date)));if(g.platforms?.length)copy.append(el("small","games-company-platforms",g.platforms.join(" · ")));const roles=[g.developer?"Developer":"",g.publisher?"Publisher":""].filter(Boolean);if(roles.length)copy.append(el("small","games-company-credit",roles.join(" / ")));row.append(copy);list.append(row);});box.append(list);dialogContent.append(box);};
    section("Upcoming releases",upcoming,"No upcoming releases are currently listed for this company.");
    section("Previous releases",previous,"Historical releases will appear after the first IGDB catalogue sync.");
    const attribution=el("p","games-company-attribution"),source=document.createElement("a");source.href="https://www.igdb.com/";source.target="_blank";source.rel="noopener noreferrer";source.textContent="Game data powered by IGDB";attribution.append(source);dialogContent.append(attribution);openDialog();
  };
  document.addEventListener("open-games-company-profile",event=>showCompany(event.detail?.companyId));

  const platformAsset=platform=>{
    const value=String(platform||"").toLowerCase();
    if(value.includes("playstation")||value.includes("ps5")||value.includes("ps4"))return ["playstation",value.includes("ps4")?"PS4":"PS5"];
    if(value.includes("xbox"))return ["xbox","XBOX"];
    if(value.includes("nintendo")||value.includes("switch"))return ["nintendo",value.includes("switch 2")?"SWITCH 2":"SWITCH"];
    if(value.includes("steam"))return ["steam","STEAM"];
    if(value==="pc"||value.startsWith("pc "))return ["windows","PC"];
    return ["windows","PC"];
  };
  const platformUrl=name=>{
    const value=String(name||"").toLowerCase();
    if(value.includes("playstation")||value.includes("ps5")||value.includes("ps4"))return "https://www.playstation.com/";
    if(value.includes("xbox"))return "https://www.xbox.com/";
    if(value.includes("nintendo")||value.includes("switch"))return "https://www.nintendo.com/";
    if(value.includes("steam"))return "https://store.steampowered.com/";
    if(value==="pc"||value.startsWith("pc "))return "https://www.microsoft.com/windows/";
    return null;
  };
  const platformMarks=(platforms,clickable=false)=>{
    const row=el("div","games-stage-platforms");
    (platforms||[]).forEach(name=>{
      const [slug,label]=platformAsset(name),url=platformUrl(name);
      const item=clickable&&url?document.createElement("a"):el("span");
      item.className="games-stage-platform";item.title="Visit "+name+" official website";item.setAttribute("aria-label",name);
      if(clickable&&url){item.href=url;item.target="_blank";item.rel="noopener noreferrer";}
      const img=document.createElement("img");img.src="./assets/platform-"+slug+".svg";img.alt="";img.loading="eager";img.decoding="async";img.onerror=()=>{img.replaceWith(el("b","games-stage-platform-fallback",slug.toUpperCase()));};
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
      const copy=el("span","games-discovery-copy");copy.append(el("small","",game.studio+" · "+game.publisher),el("strong","",game.title),el("span","",game.date_label||"Release date TBC"),el("span","games-discovery-badge",game.date_status||"COMING SOON · DATE TBC"));card.append(copy);
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
  const featuredPanel=stage.closest(".games-discovery-featured")||stage;
  let swipeStartX=0,swipeStartY=0,swipeActive=false;
  featuredPanel.setAttribute("tabindex","0");
  featuredPanel.setAttribute("aria-label","Featured games. Swipe anywhere across this section to change game.");
  featuredPanel.addEventListener("touchstart",event=>{
    if(event.target.closest("button,a,[role=button]")){swipeActive=false;return;}
    const touch=event.changedTouches[0];swipeStartX=touch?.clientX||0;swipeStartY=touch?.clientY||0;swipeActive=true;
  },{passive:true});
  featuredPanel.addEventListener("touchend",event=>{
    if(!swipeActive)return;swipeActive=false;
    const touch=event.changedTouches[0],dx=(touch?.clientX||0)-swipeStartX,dy=(touch?.clientY||0)-swipeStartY;
    if(Math.abs(dx)>55&&Math.abs(dx)>Math.abs(dy)*1.2)selectFeatured(activeIndex+(dx<0?1:-1),true);
  },{passive:true});
  featuredPanel.addEventListener("keydown",event=>{if(event.key==="ArrowRight")selectFeatured(activeIndex+1,true);if(event.key==="ArrowLeft")selectFeatured(activeIndex-1,true);});
  const renderTbc=()=>{
    const games=catalogue.featured.filter(g=>!g.release_date);tbcList.replaceChildren();
    const count=document.getElementById("games-tbc-count");if(count)count.textContent=games.length+" GAMES";
    if(!games.length){tbcList.append(el("p","games-discovery-loading","No qualifying announced games currently meet the official trailer requirement."));return;}
    games.forEach(game=>{const card=el("button","games-tbc-card");card.type="button";const art=el("span","games-tbc-art");addImage(art,game,"thumb");const copy=el("span","games-tbc-card-copy");copy.append(el("small","games-tbc-label","TBC · NO CONFIRMED DATE"),el("strong","",game.title),el("small","",game.studio+" · "+game.publisher),el("small","",game.trailer_label||"Official teaser available"));card.append(art,copy);card.addEventListener("click",()=>showGame(game));tbcList.append(card);});
  };
  document.getElementById("games-featured-prev")?.addEventListener("click",()=>selectFeatured(activeIndex-1,true));
  document.getElementById("games-featured-next")?.addEventListener("click",()=>selectFeatured(activeIndex+1,true));
  Promise.all([
    fetch("./data/games-discovery.json?v=20261111-04",{cache:"no-store"}).then(r=>{if(!r.ok)throw Error("Featured catalogue unavailable");return r.json();}),
    fetch("./data/games-popularity.json?v=20261110-07",{cache:"no-store"}).then(r=>r.ok?r.json():{games:[]}).catch(()=>({games:[]})),
    fetch("./data/company-profiles.json?v=20261111-02",{cache:"no-store"}).then(r=>r.ok?r.json():{companies:[]}).catch(()=>({companies:[]}))
  ]).then(([data,pop,profiles])=>{
    (pop.games||[]).forEach(g=>{if(g.title)assetMap.set(norm(g.title),{artwork_url:g.artwork_url||null,logo_url:g.logo_url||null});});
    catalogue=data;profileData=profiles;catalogue.companies=profiles.companies?.length?profiles.companies:catalogue.companies;renderFeatured();renderTbc();
  }).catch(error=>{console.warn("Games discovery catalogue unavailable",error);track.replaceChildren(el("p","games-discovery-loading","Featured games are temporarily unavailable."));tbcList.replaceChildren(el("p","games-discovery-loading","The TBC list is temporarily unavailable."));});
})();