(() => {
  const $ = id => document.getElementById(id);
  const root = $("sports-hub-content");
  if (!root) return;
  let payload = {};
  let active = "f1";
  const sportNames = {f1:"FORMULA 1",darts:"PDC DARTS",boxing:"BOXING WORLD CHAMPIONS",ufc:"UFC"};
  const esc = value => String(value ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  const initials = name => String(name || "?").split(/\s+/).slice(0,2).map(x=>x[0]||"").join("").toUpperCase();
  const constructorWordmark = name => ({Mercedes:"★",Ferrari:"SF","Red Bull":"RBR",McLaren:"MCL","RB F1 Team":"VCARB","Alpine F1 Team":"ALP","Haas F1 Team":"HAAS",Audi:"AUDI",Williams:"W","Aston Martin":"AM","Cadillac F1 Team":"CAD"}[name] || String(name||"F1").slice(0,4).toUpperCase());
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
    const source = (officialF1 || officialPdc) ? item.image_url : (localPath ? "https://raw.githubusercontent.com/JimmyHZz1/Boxing-Fight-Calendar/main/"+String(local?.path || item.image_url).replace(/^\.\//,"").replace(/^\//,"") : item.image_url);
    const credit = (officialPdc || officialF1) ? item.image_credit : (local?.attribution || item.image_credit);
    const constructor = label==="Constructor";
    const fallback = constructor ? constructorWordmark(item.name) : initials(item.name);
    const img = constructor ? (source ? '<img class="hub-constructor-logo" src="'+esc(source)+'" alt="'+esc(item.name+" logo")+'" loading="lazy" data-image-kind="constructor" data-image-entity="'+esc(item.name||"")+'" data-image-fallback="'+esc(fallback)+'" style="--team-color:'+constructorColour(item.name)+'">' : '<span class="hub-constructor-fallback" role="img" aria-label="'+esc(item.name+" logo")+'" style="--team-color:'+constructorColour(item.name)+'">'+constructorBadge(item.name)+'</span>') : (source ? '<img class="hub-driver-portrait'+(officialF1?' hub-driver-portrait-official-f1':'')+'" src="'+esc(source)+'" alt="'+esc(item.name+" portrait")+'" loading="lazy" data-image-kind="driver" data-official-pdc="' + (officialPdc?"1":"0") + '" data-official-f1="'+(officialF1?"1":"0")+'" data-image-entity="'+esc(item.name||"") + '" data-image-fallback="'+esc(fallback)+'">': '<span class="hub-avatar-fallback hub-driver-fallback">'+esc(fallback)+'</span>');
    const rank = item.rank != null ? (item.rank===0 ? "C" : "#"+item.rank) : (index+1);
    const extra = [item.team,item.prize_money?"£"+item.prize_money:(item.points!=null?item.points+" pts":null),item.org,credit].filter(Boolean).join(" · ");
    return '<div class="hub-person'+(label==="Player" && officialPdc?' hub-pdc-player':'')+'">'+img+'<span class="hub-rank">'+esc(rank)+'</span><span class="hub-person-name"><strong>'+esc(item.name||"TBC")+'</strong><small>'+esc(extra||label||"")+'</small></span></div>';
  }
  function dropdown(title, items, label, max=30) {
    const list=(items||[]).slice(0,max);
    return '<details class="hub-dropdown"><summary>'+esc(title)+'<span>'+list.length+' ENTRIES</span></summary><div class="hub-dropdown-list">'+(list.length?list.map((x,i)=>person(x,i,label)).join(""):'<p class="hub-empty">No published data available yet.</p>')+'</div></details>';
  }
  function panel(sport) {
    const d=payload[sport]||{};
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
    }
    const note=d.notice||d.sync_warning||"";
    const updated=d.last_updated?new Date(d.last_updated).toLocaleString("en-GB",{timeZone:"Europe/London",dateStyle:"medium",timeStyle:"short"}):"Awaiting first sync";
    $("sports-hub-updated").textContent=updated.toUpperCase();
    return '<div class="hub-sport-title"><strong>'+sportNames[sport]+'</strong><span>UPDATED '+esc(updated)+'</span></div>'+out+(note?'<p class="hub-source-note">'+esc(note)+'</p>':"");
  }
  function updateImageDiagnostics() {
    const box=$("hub-image-diagnostics");
    if(!box) return;
    const d=imageDiagnostics;
    const found=Number(d.found||0), missing=Number(d.missing||0);
    box.innerHTML='<summary>IMAGE CHECK · '+found+' FOUND / '+missing+' NOT FOUND · '+imageFailures+' FAILED TO LOAD · '+imageLoads+' LOADED</summary><p>Library entries: '+Math.max(Number(d.library_entries||0),Object.keys(localImages).length)+' · Last checked: '+esc(d.checked_at?new Date(d.checked_at).toLocaleString("en-GB",{timeZone:"Europe/London"}):"Not checked")+'</p><p>Only relevant Commons matches with image and licence metadata are published. Failed image loads are counted on this device.</p>';
  }
  function render(sport=active) {
    active=sport;
    root.innerHTML=panel(sport);
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
    fetch("./data/image-library.json?t="+Date.now(),{cache:"no-store"}).then(r=>r.ok?r.json():{images:{}})
  ]).then(([data,library])=>{
    payload=data.sports||data;
    imageDiagnostics=data.image_diagnostics||{};
    localImages=library.images||{};
    render(active);
  }).catch(()=>{root.innerHTML='<p class="hub-empty">Standings and rankings are not available yet.</p>';});
  document.addEventListener("sports:select",e=>{if(e.detail&&e.detail.sport)render(e.detail.sport);});
  document.addEventListener("DOMContentLoaded",()=>render(active));
})();