(() => {
  const $ = id => document.getElementById(id);
  const root = $("sports-hub-content");
  if (!root) return;
  let payload = {};
  let bkfcPayload = {};
  let dartsPayload = {events:[]};
  let active = "f1";
  const sportNames = {f1:"FORMULA 1",darts:"PDC DARTS",boxing:"BOXING WORLD CHAMPIONS",ufc:"UFC",bkfc:"BKFC BARE KNUCKLE"};
  const sportTabs = [{id:"f1",label:"F1"},{id:"darts",label:"DARTS"},{id:"boxing",label:"BOXING"},{id:"ufc",label:"UFC"},{id:"bkfc",label:"BKFC"}];
  const esc = value => String(value ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  const initials = name => String(name || "?").split(/\s+/).slice(0,2).map(x=>x[0]||"").join("").toUpperCase();
  const moneyLabel = value => {
    const raw = String(value ?? "").trim();
    if (!raw) return "";
    const amount = Number(raw.replace(/[£,\s]/g, ""));
    return Number.isFinite(amount) ? "£" + amount.toLocaleString("en-GB", {maximumFractionDigits:0}) + " prize money" : "£" + raw + " prize money";
  };
  const constructorLogoSlug = name => ({Mercedes:"mercedes",Ferrari:"ferrari","Red Bull":"redbullracing","Red Bull Racing":"redbullracing",McLaren:"mclaren","Alpine F1 Team":"alpine",Alpine:"alpine","Haas F1 Team":"haas",Audi:"audi","RB F1 Team":"racingbulls","Racing Bulls":"racingbulls","Aston Martin":"astonmartin","Cadillac F1 Team":"cadillac",Cadillac:"cadillac",Williams:"williams"}[String(name||"").trim()] || "");
  const constructorLogoUrl = name => {const slug=constructorLogoSlug(name);return slug?"https://media.formula1.com/image/upload/common/f1/2026/"+slug+"/2026"+slug+"logo.svg":"";};
  const constructorWordmark = name => ({Mercedes:"MER",Ferrari:"FER","Red Bull":"RBR",McLaren:"MCL","RB F1 Team":"RB","Alpine F1 Team":"ALP","Haas F1 Team":"HAS",Audi:"AUD",Williams:"WIL","Aston Martin":"AMR","Cadillac F1 Team":"CAD"}[name] || String(name||"F1").slice(0,3).toUpperCase());
  const constructorColour = name => ({Mercedes:"#00d2be",Ferrari:"#ef1a2d","Red Bull":"#4776d0",McLaren:"#ff8700","RB F1 Team":"#6c9bd2","Alpine F1 Team":"#168bd2","Haas F1 Team":"#c7cbd1",Audi:"#f02b32",Williams:"#39a9df","Aston Martin":"#00a58b","Cadillac F1 Team":"#e5e5e5"}[name] || "#e2b45b");
  const constructorBadge = name => name==="Mercedes" ? '<svg class="hub-mercedes-star" viewBox="0 0 100 100" aria-hidden="true" focusable="false"><circle cx="50" cy="50" r="43" fill="none" stroke="currentColor" stroke-width="5"/><path d="M50 12 L45 48 L19 70 L24 77 L50 60 L76 77 L81 70 L55 48 Z" fill="currentColor"/><path d="M50 12 L50 50 L45 48 Z M50 50 L19 70 L24 77 Z M50 50 L81 70 L76 77 Z" fill="#17191e" opacity=".32"/></svg>' : esc(constructorWordmark(name));
  let imageFailures = 0;
  let imageLoads = 0;
  let localImages = {};
  let imageDiagnostics = {};
  const imageKey = name => String(name||"").normalize("NFKD").replace(/[\u0300-\u036f]/g,"").toLowerCase().replace(/[^a-z0-9]+/g," ").trim();
  function person(item, index, label) {
    const local = localImages[imageKey(item.name)];
    const officialF1 = (active==="f1" && label==="Driver") || item.image_source==="Formula1.com" || item.image_match_method==="official-driver-profile";
    const officialPdc = item.image_source==="PDC Europe" || item.image_match_method==="official-pdc-tour-card-photo";
    const localPath = !officialF1 && !officialPdc && local && local.path ? "./"+String(local.path).replace(/^[/]+/,"") : (!officialF1 && !officialPdc && item.image_url && item.image_url.startsWith("./assets/") ? item.image_url : "");
    const constructor = label==="Constructor";
    const source = constructor ? "" : (officialF1 || officialPdc) ? item.image_url : (localPath ? "https://raw.githubusercontent.com/JimmyHZz1/Boxing-Fight-Calendar/main/"+String(local?.path || item.image_url).replace(/^\.\//,"").replace(/^\//,"") : item.image_url);
    const credit = (officialPdc || officialF1) ? item.image_credit : (local?.attribution || item.image_credit);
    const fallback = constructor ? constructorWordmark(item.name) : initials(item.name);
    const constructorUrl = constructorLogoUrl(item.name);
    const img = constructor
      ? constructorUrl
        ? '<img class="hub-constructor-logo" src="'+esc(constructorUrl)+'" alt="'+esc(item.name+' timing-board team emblem')+'" loading="lazy" decoding="async" data-image-kind="constructor" data-image-entity="'+esc(item.name||'')+'" data-image-fallback="'+esc(constructorBadge(item.name))+'">'
        : '<span class="hub-constructor-broadcast constructor-broadcast-mark" style="--team-color:'+esc(constructorColour(item.name))+'" role="img" aria-label="'+esc(item.name)+' F1 broadcast mark">'+constructorBadge(item.name)+'</span>'
      : source ? '<img class="hub-driver-portrait'+(officialF1?' hub-driver-portrait-official-f1':'')+'" src="'+esc(source)+'" alt="'+esc(item.name+" portrait")+'" loading="lazy" data-image-kind="driver" data-official-pdc="' + (officialPdc?"1":"0") + '" data-official-f1="'+(officialF1?"1":"0")+'" data-image-entity="'+esc(item.name||"") + '" data-image-fallback="'+esc(fallback)+'">' : '<span class="hub-avatar-fallback hub-driver-fallback">'+esc(fallback)+'</span>';
    const rank = item.rank != null ? (item.rank===0 ? "C" : "#"+item.rank) : (index+1);
    const extra = [item.team,item.prize_money?moneyLabel(item.prize_money):(item.points!=null?item.points+" pts":null),item.org,credit].filter(Boolean).join(" · ");
    return '<div class="hub-person'+(label==="Player" && officialPdc?' hub-pdc-player':'')+'">'+img+'<span class="hub-rank">'+esc(rank)+'</span><span class="hub-person-name"><strong>'+esc(item.name||"TBC")+'</strong><small>'+esc(extra||label||"")+'</small></span></div>';
  }
  function dropdown(title, items, label, max=30) {
    const isRanking=title==="PDC Order of Merit";
    const list=(items||[]).slice(0,max);
    if(isRanking)list.sort((a,b)=>Number(a.rank??Infinity)-Number(b.rank??Infinity));
    let content="";
    if(isRanking){
      const columnCount=window.matchMedia("(min-width: 1200px)").matches?3:2;
      const perColumn=Math.ceil(list.length/columnCount);
      const columns=Array.from({length:columnCount},(_,column)=>'<div class="hub-ranking-column">'+list.slice(column*perColumn,(column+1)*perColumn).map((x,i)=>person(x,column*perColumn+i,label)).join("")+'</div>').join("");
      content='<div class="hub-ranking-columns" style="grid-template-columns:repeat('+columnCount+',minmax(0,1fr))">'+columns+'</div>';
    }else{
      content=list.length?list.map((x,i)=>person(x,i,label)).join(""):'<p class="hub-empty">No published data available yet.</p>';
    }
    const autoOpen=title==="Drivers’ championship"||title==="Constructors’ championship"||isRanking;
    return '<details class="hub-dropdown"'+(autoOpen?" open":"")+'><summary>'+esc(title)+'<span>'+list.length+' ENTRIES</span></summary><div class="hub-dropdown-list'+(isRanking?' hub-dropdown-list-ranking':'')+'">'+content+'</div></details>';
  }
  function bkfcPanel() {
    const events=(bkfcPayload.events||[]).filter(event=>(event.fights||[]).length);
    if(!events.length) return '<p class="hub-empty">BKFC bout listings and weight classes are not available yet.</p>';
    return events.map(event=>{
      const groups={};
      (event.fights||[]).forEach(fight=>{
        const weight=String(fight.weight_class||"Weight class TBC").trim();
        (groups[weight]||(groups[weight]=[])).push(fight);
      });
      const sections=Object.entries(groups).sort((a,b)=>a[0].localeCompare(b[0])).map(([weight,fights])=>{
        const rows=fights.map((fight,index)=>{
          const a=fight.fighter_a?.name||fight.fighter1||"TBC";
          const b=fight.fighter_b?.name||fight.fighter2||"TBC";
          return '<div class="hub-person hub-bkfc-bout"><span class="hub-bkfc-mark">BKFC</span><span class="hub-rank">'+(index+1)+'</span><span class="hub-person-name"><strong>'+esc(a)+' <i>vs</i> '+esc(b)+'</strong><small>'+esc(fight.card_section||"Scheduled bout")+' · '+esc(weight)+'</small></span></div>';
        }).join("");
        return '<details class="hub-dropdown"><summary>'+esc(weight)+'<span>'+fights.length+' BOUT'+(fights.length===1?"":"S")+'</span></summary><div class="hub-dropdown-list">'+rows+'</div></details>';
      }).join("");
      return '<div class="hub-bkfc-event"><div class="hub-bkfc-event-title"><strong>'+esc(event.name)+'</strong><span>'+esc(event.date||"Date TBC")+'</span></div>'+sections+'</div>';
    }).join("");
  }
  let dartsPayload={events:[]};
  function grandSlamPanel(event) {
    const ongoing=String(event.status||"").toLowerCase()==="ongoing";
    const groups=event.groups||{};
    const groupCards=Object.entries(groups).map(([group,players])=>
      '<details class="hub-dropdown"><summary>GROUP '+esc(group)+'<span>'+players.length+' PLAYERS</span></summary><div class="hub-dropdown-list">'+
      players.map((name,index)=>'<div class="hub-person"><span class="hub-rank">'+(index+1)+'</span><span class="hub-person-name"><strong>'+esc(name)+'</strong><small>Group '+esc(group)+'</small></span></div>').join('')+
      '</div></details>'
    ).join('');
    const start=new Date(String(event.date||'')+'T12:00:00Z');
    const end=new Date(String(event.end_date||event.date||'')+'T12:00:00Z');
    const range=[start.toLocaleDateString('en-GB',{day:'numeric',month:'short',timeZone:'Europe/London'}),end.toLocaleDateString('en-GB',{day:'numeric',month:'short',year:'numeric',timeZone:'Europe/London'})].join(' – ');
    return '<section class="hub-bkfc-event" style="margin:0 0 18px;padding:16px;border:1px solid rgba(201,164,91,.45);border-radius:14px;background:rgba(201,164,91,.07)">'+
      '<div class="hub-bkfc-event-title"><strong>'+esc(event.name)+'</strong><span style="color:'+(ongoing?'#67d69b':'#c9a45b')+'">'+(ongoing?'● ONGOING':'UPCOMING')+'</span></div>'+
      '<p class="hub-source-note" style="margin:8px 0 14px">'+esc(range)+' · '+esc(event.venue||'PDC')+'</p>'+
      '<details class="hub-dropdown" open><summary>GROUP DRAW<span>'+Object.keys(groups).length+' GROUPS · '+Object.values(groups).flat().length+' PLAYERS</span></summary><div class="hub-dropdown-list" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(190px,1fr));gap:8px">'+groupCards+'</div></details>'+
      (event.schedule_source_url?'<p style="margin:10px 0 0"><a class="event-source-link" href="'+esc(event.schedule_source_url)+'" target="_blank" rel="noopener noreferrer">Official PDC draw ↗</a></p>':'')+
      '</section>';
  }
  function panel(sport) {
    const d=sport==="bkfc"?bkfcPayload:(payload[sport]||{});
    let out="";
    if(sport==="f1"){
      out=dropdown("Drivers’ championship",d.drivers,"Driver",30)+dropdown("Constructors’ championship",d.constructors,"Constructor",20);
    } else if(sport==="darts"){
      const todayKey=new Intl.DateTimeFormat("en-CA",{timeZone:"Europe/London",year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date());
      const tournament=(dartsPayload.events||[]).find(event=>/grand slam of darts/i.test(event.name||"")&&String(event.date||"").slice(0,10)<=todayKey&&String(event.end_date||event.date||"").slice(0,10)>=todayKey);
      out=(tournament?grandSlamPanel(tournament):"")+dropdown("PDC Order of Merit",d.rankings,"Player",40);
    } else if(sport==="ufc"){
      const divisions=d.divisions||[];
      out=divisions.length?divisions.map(div=>dropdown(div.name||div.division,div.entries,"Fighter",15)).join(""):'<p class="hub-empty">UFC rankings are not available yet.</p>';
    } else if(sport==="boxing"){
      const divisions=d.divisions||[];
      out=divisions.length?divisions.map(div=>dropdown(div.name,div.champions,"Champion",12)).join(""):'<p class="hub-empty">World title-holder data is not available yet.</p>';
    } else if(sport==="bkfc"){
      out=bkfcPanel();
    }
    const note=d.notice||d.sync_warning||"";
    const updated=d.last_updated?new Date(d.last_updated).toLocaleString("en-GB",{timeZone:"Europe/London",dateStyle:"medium",timeStyle:"short"}):"Awaiting first sync";
    $("sports-hub-updated").textContent=updated.toUpperCase();
    const tabs='<nav class="hub-sport-shortcuts" aria-label="Sports Hub tabs">'+sportTabs.map(tab=>'<button type="button" class="hub-sport-shortcut'+(tab.id===sport?' is-active':'')+'" data-hub-sport="'+tab.id+'" aria-pressed="'+(tab.id===sport?'true':'false')+'"><span>'+tab.label+'</span></button>').join("")+'</nav>';
    return tabs+'<div class="hub-sport-title"><strong>'+sportNames[sport]+'</strong><span>UPDATED '+esc(updated)+'</span></div>'+out+(note?'<p class="hub-source-note">'+esc(note)+'</p>':"");
  }
  let enrichmentHistory = [];
  function reportDate(value) {
    if(!value) return "Not recorded";
    const date=new Date(value);
    return Number.isNaN(date.getTime())?String(value):date.toLocaleString("en-GB",{timeZone:"Europe/London",dateStyle:"medium",timeStyle:"short"});
  }
  function updateImageDiagnostics() {
    const box=$("version-image-diagnostics");
    if(!box) return;
    const wasOpen=!!box.querySelector("details")?.open;
    const d=imageDiagnostics||{};
    const coverage=d.coverage||{};
    const found=Number(d.found||0), missing=Number(d.missing||0);
    const total=Object.values(coverage).reduce((sum,row)=>sum+Number(row.total||0),0);
    const covered=Object.values(coverage).reduce((sum,row)=>sum+Number(row.with_image||0),0);
    const pct=total?Math.round(covered/total*100):0;
    const coverageRows=Object.entries(coverage).map(([name,row])=>{
      const n=Number(row.with_image||0), t=Number(row.total||0), m=Number(row.missing||Math.max(0,t-n));
      const rate=t?Math.round(n/t*100):0;
      return '<div class="hub-image-report-coverage"><div><strong>'+esc(name)+'</strong><span>'+n+' / '+t+' · '+rate+'%</span></div><div class="hub-image-report-bar"><i style="width:'+rate+'%"></i></div><small>'+m+' still missing</small></div>';
    }).join("");
    const attempts=(d.search_details||[]).map(item=>{
      const accepted=Number(item.accepted||0), candidates=Number(item.candidate_files||0), rejected=Object.values(item.rejections||{}).reduce((a,b)=>a+Number(b||0),0);
      const status=accepted?"IMAGE ADDED":(candidates||rejected)?"CANDIDATES REJECTED":"NO USABLE IMAGE";
      const cls=accepted?"success":(candidates||rejected)?"warning":"muted";
      const reason=accepted?"Identity checks passed and the image was saved.":rejected?Object.entries(item.rejections||{}).map(([k,v])=>k.replace(/_/g," ")+" ("+v+")").join(", "):"No suitable image candidate was returned.";
      return '<div class="hub-image-report-result"><div><strong>'+esc(item.name)+'</strong><span class="hub-image-result-badge is-'+cls+'">'+status+'</span></div><small>'+Number(item.queries||0)+' queries · '+candidates+' candidates · '+accepted+' accepted</small><p>'+esc(reason)+'</p></div>';
    }).join("");
    const recent=(enrichmentHistory||[]).slice(-8).reverse().map(batch=>{
      const ok=Number(batch.found||0), tried=Number(batch.attempted||0), miss=Number(batch.missing||0), limited=!!batch.rate_limited;
      return '<div class="hub-image-history-row"><span><strong>Batch '+Number(batch.batch||0)+'</strong><small>'+esc(reportDate(batch.at))+'</small></span><b class="'+(ok?"is-good":limited?"is-warning":"")+'">'+ok+' found</b><small>'+tried+' attempted · '+miss+' without match'+(limited?' · rate limited':'')+'</small></div>';
    }).join("");
    const latestStamp=d.checked_at?reportDate(d.checked_at):"Not checked";
    const lastSuccess=d.last_successful_batch_at?reportDate(d.last_successful_batch_at):"Not recorded";
    const rateLimit=!!d.rate_limited;
    const libraryCount=Object.keys(localImages).length;
    const latestMatches=Object.values(localImages).filter(item=>item.verified_at && d.last_successful_batch_at && String(item.verified_at)>=String(d.last_successful_batch_at));
    const latestAssets=latestMatches.map(item=>'<div class="hub-image-report-asset"><strong>'+esc(item.name)+'</strong><span>'+esc(item.licence||"Licence not listed")+'</span><a href="'+esc(item.source_url||"#")+'" target="_blank" rel="noopener noreferrer">SOURCE ↗</a></div>').join("");
    const warning=rateLimit?'<div class="hub-image-report-alert">UPSTREAM RATE LIMIT · Wikimedia Commons limited requests during the latest check. The queue should pause and retry later.</div>':'';
    const cumulative=d.cumulative_found!=null?Number(d.cumulative_found):found;
    const attemptsTotal=d.cumulative_attempted!=null?Number(d.cumulative_attempted):Number(d.attempted||0);
    const failedTotal=d.cumulative_missing!=null?Number(d.cumulative_missing):missing;
    const rejectedTotal=d.cumulative_rejected!=null?Number(d.cumulative_rejected):Number(d.rejected||0);
    box.innerHTML='<details class="version-entry version-dropdown image-status-dropdown"'+(wasOpen?' open':'')+'><summary class="version-entry-summary"><span class="version-entry-top"><span class="version-number">IMAGE ENRICHMENT REPORT</span><span class="version-status">'+pct+'% COVERAGE</span></span><span class="version-entry-title">What worked, what failed and what still needs attention</span><span class="version-entry-toggle" aria-hidden="true"></span></summary><div class="image-status-content hub-image-report">'+
      '<div class="hub-image-report-intro"><p><strong>Latest check:</strong> '+esc(latestStamp)+' · <strong>Last successful batch:</strong> '+esc(lastSuccess)+'</p><p>This report separates successful image additions from searches that returned nothing and candidates rejected by identity checks. Rejected candidates are not counted as successful images.</p></div>'+
      '<div class="hub-image-report-stats"><div><strong>'+libraryCount+'</strong><span>Library records</span></div><div><strong>'+cumulative+'</strong><span>Enrichment matches</span></div><div><strong>'+attemptsTotal+'</strong><span>Lookups attempted</span></div><div><strong>'+failedTotal+'</strong><span>No usable match</span></div><div><strong>'+rejectedTotal+'</strong><span>Candidates rejected</span></div></div>'+
      '<section class="hub-image-report-section"><h4>Coverage by sport</h4><div class="hub-image-report-coverage-grid">'+(coverageRows||'<p>Coverage data has not been published yet.</p>')+'</div></section>'+
      '<section class="hub-image-report-section"><h4>Latest search results</h4><p class="hub-image-report-caption">Each name below shows whether an image was saved, candidates were rejected, or no suitable image was found.</p>'+(attempts||'<p>No individual search results were recorded for the latest batch.</p>')+'</section>'+
      '<section class="hub-image-report-section"><h4>Images added in the latest check</h4>'+(latestAssets||'<p>No newly verified image assets were recorded in this check.</p>')+'</section>'+
      '<section class="hub-image-report-section"><h4>Recent batch history</h4><div class="hub-image-history">'+(recent||'<p>No batch history has been published yet.</p>')+'</div></section>'+
      (warning||'')+
      '<p class="hub-image-report-footnote">Images are only published when identity matching and reuse-right checks pass. Source and licence details are retained with each accepted asset. Browser image-load failures are tracked separately from enrichment search failures.</p>'+
      '<p><strong>Browser session:</strong> '+imageLoads+' image loads successful · '+imageFailures+' failed to load.</p></div></details>';
  }
  function render(sport=active) {
    active=sport;
    root.dataset.activeSport=sport;
    root.innerHTML=panel(sport);
    root.querySelectorAll("[data-hub-sport]").forEach(button=>button.addEventListener("click",()=>render(button.dataset.hubSport)));
    root.querySelectorAll("img[data-image-entity]").forEach(img=>{
      img.addEventListener("load",()=>{imageLoads++;updateImageDiagnostics();},{once:true});
      img.addEventListener("error",()=>{
        if(img.dataset.remoteRetry!=="1" && img.dataset.imageEntity && img.dataset.officialF1!=="1" && img.dataset.officialPdc!=="1"){
          img.dataset.remoteRetry="1";
          const local=localImages[imageKey(img.dataset.imageEntity)];
          const path=local?.path;
          if(path){img.src="https://raw.githubusercontent.com/JimmyHZz1/Boxing-Fight-Calendar/main/"+String(path).replace(/^\//,"");return;}
        }
        imageFailures++;
        const fallback=document.createElement("span");
        if(img.dataset.imageKind==="constructor"){
          fallback.className="hub-constructor-broadcast constructor-broadcast-mark";
          fallback.style.setProperty("--team-color",constructorColour(img.dataset.imageEntity));
          fallback.setAttribute("role","img");
          fallback.setAttribute("aria-label",img.dataset.imageEntity+" F1 broadcast mark");
        }else{
          fallback.className=img.dataset.imageKind==="driver" ? "hub-avatar-fallback hub-driver-fallback" : "hub-avatar-fallback";
        }
        fallback.textContent=img.dataset.imageFallback||"?";
        img.replaceWith(fallback);
        updateImageDiagnostics();
      },{once:true});
    });
    updateImageDiagnostics();
  }
  Promise.all([
    fetch("./data/sports-hub.json?t="+Date.now(),{cache:"no-store"}).then(r=>{if(!r.ok)throw Error("HTTP "+r.status);return r.json();}),
    fetch("./data/image-library.json?t="+Date.now(),{cache:"no-store"}).then(r=>r.ok?r.json():{images:{}}),
    fetch("./data/bkfc.json?t="+Date.now(),{cache:"no-store"}).then(r=>r.ok?r.json():{events:[]}),
    fetch("./data/darts.json?t="+Date.now(),{cache:"no-store"}).then(r=>r.ok?r.json():{events:[]}),
    fetch("./data/sports-images.json?t="+Date.now(),{cache:"no-store"}).then(r=>r.ok?r.json():{enrichment:{history:[]}})
  ]).then(([data,library,bkfc,darts,sportsImages])=>{
    payload=data.sports||data;
    imageDiagnostics=data.image_diagnostics||{};
    enrichmentHistory=sportsImages?.enrichment?.history||[];
    localImages=library.images||{};
    bkfcPayload=bkfc||{events:[]};
    dartsPayload=darts||{events:[]};
    render(active);
  }).catch(()=>{root.innerHTML='<p class="hub-empty">Standings and rankings are not available yet.</p>';});
  document.addEventListener("sports:select",e=>{if(e.detail&&e.detail.sport)render(e.detail.sport);});
  document.addEventListener("DOMContentLoaded",()=>render(active));
})();