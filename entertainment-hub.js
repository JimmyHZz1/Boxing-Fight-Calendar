/* Entertainment Hub — TMDB discovery, details, UK providers and local watchlist. */
(() => {
  const API = "https://dyulhgfpbnyotxjstwcq.supabase.co/functions/v1/tmdb";
  const $ = id => document.getElementById(id);
  const state = { films:{}, tv:{}, watchlist:[], searchTimer:null, active:null, loaded:false };
  const WATCHLIST_KEY = "theHubEntertainmentWatchlistV1";
  const image = path => path ? "https://image.tmdb.org/t/p/w500" + path : "";
  const escapeText = value => String(value ?? "").replace(/[&<>"']/g, ch => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[ch]));
  const dateLabel = value => { if(!value)return "Date TBC"; const d=new Date(value+"T12:00:00"); return Number.isNaN(d.getTime())?"Date TBC":new Intl.DateTimeFormat("en-GB",{day:"numeric",month:"short",year:"numeric"}).format(d); };
  const status = (message,error=false) => { const node=$("entertainment-data-status"); if(node){node.textContent=message;node.classList.toggle("is-error",error);} };
  async function request(path,params={}) {
    const url=new URL(API);
    url.searchParams.set("path",path);
    Object.entries(params).forEach(([key,value])=>{if(value!==undefined&&value!==null&&value!=="")url.searchParams.set(key,String(value));});
    const response=await fetch(url.toString(),{headers:{Accept:"application/json"}});
    const data=await response.json().catch(()=>({}));
    if(!response.ok)throw new Error(data.error||"TMDB request failed ("+response.status+").");
    return data;
  }
  function readWatchlist(){try{const saved=JSON.parse(localStorage.getItem(WATCHLIST_KEY)||"[]");state.watchlist=Array.isArray(saved)?saved:[];}catch(_){state.watchlist=[];}}
  function saveWatchlist(){try{localStorage.setItem(WATCHLIST_KEY,JSON.stringify(state.watchlist));}catch(_){} renderWatchlist();}
  function isSaved(item){return state.watchlist.some(x=>x.id===item.id&&x.media_type===item.media_type);}
  function toggleSaved(item){const key=item.id+":"+item.media_type;const found=state.watchlist.some(x=>x.id+":"+x.media_type===key);state.watchlist=found?state.watchlist.filter(x=>x.id+":"+x.media_type!==key):[{id:item.id,media_type:item.media_type,title:item.title||item.name,poster_path:item.poster_path,release_date:item.release_date||item.first_air_date,vote_average:item.vote_average},...state.watchlist];saveWatchlist();}
  function card(item,mediaType){
    const title=item.title||item.name||"Untitled";
    const date=item.release_date||item.first_air_date;
    const poster=image(item.poster_path);
    const article=document.createElement("article");article.className="entertainment-title-card";article.tabIndex=0;article.setAttribute("role","button");article.setAttribute("aria-label","View "+title+" details");
    const posterWrap=document.createElement("div");posterWrap.className="entertainment-title-poster";
    if(poster){const img=document.createElement("img");img.src=poster;img.alt=title+" poster";img.loading="lazy";img.onerror=()=>{img.remove();posterWrap.innerHTML='<span class="entertainment-poster-fallback">▶</span>';};posterWrap.append(img);}else posterWrap.innerHTML='<span class="entertainment-poster-fallback">▶</span>';
    if(Number(item.vote_average)>0){const rating=document.createElement("span");rating.className="entertainment-rating";rating.textContent="★ "+Number(item.vote_average).toFixed(1);posterWrap.append(rating);}
    const save=document.createElement("button");save.type="button";save.className="entertainment-card-save";save.textContent=isSaved({...item,media_type:mediaType})?"★":"☆";save.setAttribute("aria-label",isSaved({...item,media_type:mediaType})?"Remove from watchlist":"Add to watchlist");save.addEventListener("click",event=>{event.stopPropagation();toggleSaved({...item,media_type:mediaType});save.textContent=isSaved({...item,media_type:mediaType})?"★":"☆";save.setAttribute("aria-label",isSaved({...item,media_type:mediaType})?"Remove from watchlist":"Add to watchlist");});posterWrap.append(save);
    const copy=document.createElement("div");copy.className="entertainment-title-copy";const strong=document.createElement("strong");strong.textContent=title;const small=document.createElement("small");small.textContent=(mediaType==="movie"?"FILM":"TV SERIES")+" · "+dateLabel(date);copy.append(strong,small);article.append(posterWrap,copy);
    const open=()=>showDetails({...item,media_type:mediaType});article.addEventListener("click",open);article.addEventListener("keydown",event=>{if(event.target===article&&(event.key==="Enter"||event.key===" ")){event.preventDefault();open();}});return article;
  }
  function renderShelf(id,items,mediaType){const target=$(id);if(!target)return;target.replaceChildren();if(!items?.length){const p=document.createElement("p");p.className="entertainment-empty-copy";p.textContent="No titles are available in this section right now.";target.append(p);return;}items.slice(0,10).forEach(item=>target.append(card(item,mediaType)));}
  function renderWatchlist(){const target=$("entertainment-watchlist-grid");if(!target)return;target.replaceChildren();const count=$("entertainment-watchlist-count");if(count)count.textContent=state.watchlist.length+" SAVED";if(!state.watchlist.length){const p=document.createElement("p");p.className="entertainment-empty-copy";p.textContent="Your watchlist is empty. Use the ☆ on any film or series to save it on this device.";target.append(p);return;}state.watchlist.forEach(item=>target.append(card(item,item.media_type)));}
  async function loadCatalogues(){
    try{
      status("Loading UK film and television listings…");
      const results=await Promise.all([
        request("/3/movie/now_playing",{region:"GB",page:1}),
        request("/3/movie/upcoming",{region:"GB",page:1}),
        request("/3/movie/popular",{region:"GB",page:1}),
        request("/3/tv/on_the_air",{page:1}),
        request("/3/tv/airing_today",{page:1}),
        request("/3/tv/popular",{page:1})
      ]);
      state.films={now:results[0].results||[],upcoming:results[1].results||[],popular:results[2].results||[]};
      state.tv={onAir:results[3].results||[],today:results[4].results||[],popular:results[5].results||[]};
      renderShelf("entertainment-now-playing",state.films.now,"movie");renderShelf("entertainment-upcoming-films",state.films.upcoming,"movie");renderShelf("entertainment-popular-films",state.films.popular,"movie");
      renderShelf("entertainment-on-air",state.tv.onAir,"tv");renderShelf("entertainment-airing-today",state.tv.today,"tv");renderShelf("entertainment-popular-tv",state.tv.popular,"tv");
      status("Listings updated · UK region · "+new Intl.DateTimeFormat("en-GB",{hour:"2-digit",minute:"2-digit"}).format(new Date()));
    }catch(error){status(error.message||"Could not load TMDB listings.",true);document.querySelectorAll(".entertainment-loading").forEach(node=>{node.textContent="Listings are temporarily unavailable. Please try again shortly.";});}
  }
  async function search(query){
    const section=$("entertainment-search-results"),grid=$("entertainment-search-grid"),count=$("entertainment-search-count");if(!section||!grid)return;
    if(!query.trim()){section.hidden=true;return;}
    section.hidden=false;grid.replaceChildren();const loading=document.createElement("p");loading.className="entertainment-loading";loading.textContent="Searching films and television…";grid.append(loading);
    try{const [movies,tv]=await Promise.all([request("/3/search/movie",{query:query.trim(),page:1,include_adult:false}),request("/3/search/tv",{query:query.trim(),page:1,include_adult:false})]);const combined=[...(movies.results||[]).map(x=>({...x,media_type:"movie"})),...(tv.results||[]).map(x=>({...x,media_type:"tv"}))].sort((a,b)=>(b.popularity||0)-(a.popularity||0)).slice(0,20);grid.replaceChildren();if(count)count.textContent=combined.length+" MATCHES";if(!combined.length){const p=document.createElement("p");p.className="entertainment-empty-copy";p.textContent="No matching films or series found.";grid.append(p);}combined.forEach(item=>grid.append(card(item,item.media_type)));}catch(error){grid.replaceChildren();const p=document.createElement("p");p.className="entertainment-empty-copy";p.textContent=error.message||"Search is temporarily unavailable.";grid.append(p);}
  }
  async function showDetails(item){
    const overlay=$("entertainment-detail-overlay"),content=$("entertainment-detail-content");if(!overlay||!content)return;
    state.active=item;overlay.hidden=false;document.body.style.overflow="hidden";content.innerHTML='<div class="entertainment-detail-section"><p class="entertainment-loading">Loading title details, cast and UK viewing options…</p></div>';
    try{
      const type=item.media_type==="tv"?"tv":"movie",id=item.id;
      const [detail,credits,videos,providers]=await Promise.all([request("/3/"+type+"/"+id,{append_to_response:""}),request("/3/"+type+"/"+id+"/credits"),request("/3/"+type+"/"+id+"/videos"),request("/3/"+type+"/"+id+"/watch/providers")]);
      const title=detail.title||detail.name||item.title||item.name||"Title details";
      const date=detail.release_date||detail.first_air_date||item.release_date||item.first_air_date;
      const runtime=detail.runtime?detail.runtime+" min":(detail.episode_run_time||[]).length?(detail.episode_run_time[0]+" min per episode"):"";
      const genres=(detail.genres||[]).map(x=>x.name).join(" · ");
      const trailer=(videos.results||[]).find(v=>v.site==="YouTube"&&v.type==="Trailer"&&v.official)||(videos.results||[]).find(v=>v.site==="YouTube"&&v.type==="Trailer");
      const saved=isSaved({...item,media_type:type});
      const poster=image(detail.poster_path||item.poster_path);
      content.replaceChildren();
      const hero=document.createElement("div");hero.className="entertainment-detail-hero";
      if(poster){const img=document.createElement("img");img.className="entertainment-detail-poster";img.src=poster;img.alt=title+" poster";hero.append(img);}
      const copy=document.createElement("div");copy.className="entertainment-detail-copy";
      const kicker=document.createElement("span");kicker.className="eyebrow entertainment-eyebrow";kicker.textContent=type==="movie"?"FILM":"TELEVISION";
      const h=document.createElement("h2");h.id="entertainment-detail-title";h.textContent=title;
      const meta=document.createElement("div");meta.className="entertainment-detail-meta";meta.textContent=[dateLabel(date),detail.status||"",runtime,genres,Number(detail.vote_average)>0?"★ "+Number(detail.vote_average).toFixed(1)+"/10":""].filter(Boolean).join(" · ");
      const overview=document.createElement("p");overview.className="entertainment-detail-overview";overview.textContent=detail.overview||"No synopsis is available yet.";
      const actions=document.createElement("div");actions.className="entertainment-detail-actions";
      const watch=document.createElement("button");watch.type="button";watch.textContent=saved?"★ SAVED TO WATCHLIST":"☆ ADD TO WATCHLIST";watch.addEventListener("click",()=>{toggleSaved({...item,media_type:type});watch.textContent=isSaved({...item,media_type:type})?"★ SAVED TO WATCHLIST":"☆ ADD TO WATCHLIST";});
      actions.append(watch);if(trailer){const a=document.createElement("a");a.className="entertainment-trailer";a.href="https://www.youtube.com/watch?v="+encodeURIComponent(trailer.key);a.target="_blank";a.rel="noopener noreferrer";a.textContent="WATCH TRAILER ↗";actions.append(a);}
      copy.append(kicker,h,meta,overview,actions);hero.append(copy);content.append(hero);
      const providersGB=providers.results?.GB||{};const providerGroups=[["STREAM",providersGB.flatrate||[]],["RENT",providersGB.rent||[]],["BUY",providersGB.buy||[]]];
      const providerSection=document.createElement("section");providerSection.className="entertainment-detail-section";const ph=document.createElement("h3");ph.textContent="Where to watch in the UK";providerSection.append(ph);
      const providerList=document.createElement("div");providerList.className="entertainment-provider-list";let anyProvider=false;
      providerGroups.forEach(([label,list])=>list.forEach(provider=>{anyProvider=true;const itemNode=document.createElement("div");itemNode.className="entertainment-provider";if(provider.logo_path){const img=document.createElement("img");img.src=image(provider.logo_path);img.alt="";itemNode.append(img);}const name=document.createElement("span");name.textContent=provider.provider_name+" · "+label;itemNode.append(name);providerList.append(itemNode);}));
      if(!anyProvider){const p=document.createElement("p");p.className="entertainment-empty-copy";p.textContent="No UK streaming, rental or purchase providers are currently listed for this title.";providerList.append(p);}
      providerSection.append(providerList);if(providersGB.link){const link=document.createElement("a");link.className="entertainment-trailer";link.href=providersGB.link;link.target="_blank";link.rel="noopener noreferrer";link.textContent="VIEW ALL UK OPTIONS ↗";providerSection.append(link);}content.append(providerSection);
      const cast=(credits.cast||[]).slice(0,10);if(cast.length){const section=document.createElement("section");section.className="entertainment-detail-section";const heading=document.createElement("h3");heading.textContent="Cast";section.append(heading);const row=document.createElement("div");row.className="entertainment-cast";cast.forEach(person=>{const entry=document.createElement("div");entry.className="entertainment-cast-item";if(person.profile_path){const img=document.createElement("img");img.src=image(person.profile_path);img.alt=person.name;entry.append(img);}const name=document.createElement("strong");name.textContent=person.name;const role=document.createElement("div");role.textContent=person.character||"";entry.append(name,role);row.append(entry);});section.append(row);content.append(section);}
      const attribution=document.createElement("p");attribution.className="entertainment-attribution";attribution.textContent="This product uses the TMDB API but is not endorsed or certified by TMDB. Streaming availability is supplied by JustWatch.";content.append(attribution);
    }catch(error){content.innerHTML='<div class="entertainment-detail-section"><p class="entertainment-empty-copy">'+escapeText(error.message||"Could not load this title.")+'</p></div>';}
  }
  function closeDetails(){const overlay=$("entertainment-detail-overlay");if(overlay)overlay.hidden=true;document.body.style.overflow="";}
  function init(){
    readWatchlist();renderWatchlist();
    document.addEventListener("click",event=>{
      const control=event.target.closest("[data-shelf-scroll]");
      if(!control)return;
      const shelf=$(control.dataset.shelfScroll);
      if(!shelf)return;
      const direction=Number(control.dataset.direction)||1;
      shelf.scrollBy({left:direction*Math.max(260,shelf.clientWidth*0.78),behavior:"smooth"});
    });
    document.addEventListener("sports:screen-changed",event=>{if(event.detail?.screen==="entertainment-hub-screen"&&!state.loaded){state.loaded=true;loadCatalogues();}});
    document.querySelectorAll("#entertainment-hub-screen [data-screen],#entertainment-version-history-screen [data-screen],.entertainment-version-history-link").forEach(button=>button.addEventListener("click",()=>{const destination=button.dataset.screen||"entertainment-version-history-screen";window.showScreen?.(destination);}));
    const input=$("entertainment-search-input");if(input){input.addEventListener("input",()=>{clearTimeout(state.searchTimer);const value=input.value;state.searchTimer=setTimeout(()=>search(value),350);});input.addEventListener("keydown",event=>{if(event.key==="Escape"){input.value="";search("");input.blur();}});}
    $("entertainment-detail-close")?.addEventListener("click",closeDetails);
    $("entertainment-detail-overlay")?.addEventListener("click",event=>{if(event.target.id==="entertainment-detail-overlay")closeDetails();});
    document.addEventListener("keydown",event=>{if(event.key==="Escape"&&!$("entertainment-detail-overlay")?.hidden)closeDetails();});
    document.querySelectorAll('[data-screen="entertainment-hub-screen"]').forEach(button=>button.addEventListener("click",()=>{if($("entertainment-data-status")?.textContent.includes("temporarily unavailable"))loadCatalogues();}));
    document.querySelectorAll('[data-screen="entertainment-version-history-screen"]').forEach(button=>button.addEventListener("click",()=>window.showScreen?.("entertainment-version-history-screen")));
  }
  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",init);else init();
})();
