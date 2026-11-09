(() => {
  const $ = id => document.getElementById(id);
  const root = $("sports-hub-content");
  if (!root) return;
  let payload = {};
  let bkfcPayload = {};
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
  const constructorLogoPath = name => ({Mercedes:"mercedes.jpg",Ferrari:"ferrari.jpg","Red Bull":"red-bull.png",McLaren:"mclaren.jpg","RB F1 Team":"visa-rb.jpg","Alpine F1 Team":"alpine-f1-team.png","Haas F1 Team":"haas-f1-team.png",Audi:"audi.png",Williams:"williams.png","Aston Martin":"aston-martin.jpg","Cadillac F1 Team":"cadillac-f1-team.png"}[name] || "");
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
    const broadcastLogo = constructor && constructorLogoPath(item.name);
    const source = broadcastLogo ? "https://raw.githubusercontent.com/JimmyHZz1/Boxing-Fight-Calendar/main/assets/images/f1-constructors/"+broadcastLogo : (officialF1 || officialPdc) ? item.image_url : (localPath ? "https://raw.githubusercontent.com/JimmyHZz1/Boxing-Fight-Calendar/main/"+String(local?.path || item.image_url).replace(/^\.\//,"").replace(/^\//,"") : item.image_url);
    const credit = (officialPdc || officialF1) ? item.image_credit : (local?.attribution || item.image_credit);
    const constructor = label==="Constructor";
    const fallback = constructor ? constructorWordmark(item.name) : initials(item.name);
    const img = source ? '<img class="'+(constructor?'hub-constructor-logo':'hub-driver-portrait'+(officialF1?' hub-driver-portrait-official-f1':''))+'" src="'+esc(source)+'" alt="'+esc(item.name+(constructor?" constructor logo":" portrait"))+'" loading="lazy" data-image-kind="'+(constructor?'constructor':'driver')+'" data-official-pdc="' + (officialPdc?"1":"0") + '" data-official-f1="'+(officialF1?"1":"0")+'" data-image-entity="'+esc(item.name||"") + '" data-image-fallback="'+esc(fallback)+'">' : (constructor ? '<span class="hub-constructor-fallback">'+esc(fallback)+'</span>' : '<span class="hub-avatar-fallback hub-driver-fallback">'+esc(fallback)+'</span>');
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
      content='<div class="hub-ranking-columns">'+columns+'</div>';
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
  function panel(sport) {
    const d=sport==="bkfc"?bkfcPayload:(payload[sport]||{});
    let out="";
    if(sport==="f1"){
      out=dropdown("Drivers’ championship",d.drivers,"Driver",30)+dropdown("Constructors’ championship",d.constructors,"Constructor",20);
    } else if(sport==="darts"){
      out=dropdown("PDC Order of Merit",d.rankings,"Player",40);
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
  function updateImageDiagnostics() {
    const box=$("version-image-diagnostics");
    if(!box) return;
    const wasOpen=!!box.querySelector("details")?.open;
    const d=imageDiagnostics;
    const found=Number(d.found||0), missing=Number(d.missing||0);
    const coverage=d.coverage||{};
    const coverageRows=Object.entries(coverage).map(([name,row])=>'<div class="hub-image-coverage-row"><span>'+esc(name)+'</span><strong>'+Number(row.with_image||0)+' / '+Number(row.total||0)+' images</strong><small>'+Number(row.missing||0)+' missing</small></div>').join("");
    const pause=d.rate_limited?'<p class="hub-image-warning">Image lookup is currently rate-limited upstream. The scheduled queue will retry; no missing portraits are being substituted with guessed matches.</p>':'';
    const checked=d.checked_at?new Date(d.checked_at).toLocaleString("en-GB",{timeZone:"Europe/London",dateStyle:"medium",timeStyle:"short"}):"Not checked";
    const batchNumber=Number(d.batch_number||0);
    const lastBatch=d.last_successful_batch_at?new Date(d.last_successful_batch_at).toLocaleString("en-GB",{timeZone:"Europe/London",dateStyle:"medium",timeStyle:"short"}):"Not recorded yet";
    const enrichmentState=d.enrichment_status||"Awaiting scheduled batch";
    const entries=Math.max(Number(d.library_entries||0),Object.keys(localImages).length);
    box.innerHTML='<details class="version-entry version-dropdown image-status-dropdown"'+(wasOpen?' open':'')+'><summary class="version-entry-summary"><span class="version-entry-top"><span class="version-number">IMAGE LIBRARY</span><span class="version-status">'+found+' FOUND · '+missing+' MISSING</span></span><span class="version-entry-title">Image loading &amp; coverage information</span><span class="version-entry-toggle" aria-hidden="true"></span></summary><div class="image-status-content"><p><strong>Last automated check:</strong> '+esc(checked)+'</p><p><strong>Batch progress:</strong> '+batchNumber+' batches recorded · <strong>Last successful batch:</strong> '+esc(lastBatch)+' · <strong>Status:</strong> '+esc(enrichmentState)+'</p><p><strong>Library entries:</strong> '+entries+' · <strong>New matches this run:</strong> '+Number(d.newly_found??d.found??0)+' · <strong>Lookup attempts:</strong> '+Number(d.attempted||0)+' · <strong>Rejected matches:</strong> '+Number(d.cumulative_rejected??d.rejected??0)+'</p><div class="hub-image-coverage">'+coverageRows+'</div><p><strong>This browser session:</strong> '+imageLoads+' image loads successful · '+imageFailures+' image loads failed. These two counters cover images rendered in the Sports Hub during this session.</p>'+pause+'<p>Only identity-matched images with source and licence metadata are published. Missing images remain missing rather than being replaced with guessed identities.</p></div></details>';
  }
  function render(sport=active) {
    active=sport;
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
        fallback.className=img.dataset.imageKind==="constructor" ? "hub-constructor-fallback" : (img.dataset.imageKind==="driver" ? "hub-avatar-fallback hub-driver-fallback" : "hub-avatar-fallback");
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
    fetch("./data/bkfc.json?t="+Date.now(),{cache:"no-store"}).then(r=>r.ok?r.json():{events:[]})
  ]).then(([data,library,bkfc])=>{
    payload=data.sports||data;
    imageDiagnostics=data.image_diagnostics||{};
    localImages=library.images||{};
    bkfcPayload=bkfc||{events:[]};
    render(active);
  }).catch(()=>{root.innerHTML='<p class="hub-empty">Standings and rankings are not available yet.</p>';});
  document.addEventListener("sports:select",e=>{if(e.detail&&e.detail.sport)render(e.detail.sport);});
  document.addEventListener("DOMContentLoaded",()=>render(active));
})();