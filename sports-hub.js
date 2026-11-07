(() => {
  const $ = id => document.getElementById(id);
  const root = $("sports-hub-content");
  if (!root) return;
  let payload = {};
  let active = "f1";
  const sportNames = {f1:"FORMULA 1",darts:"PDC DARTS",boxing:"BOXING WORLD CHAMPIONS",ufc:"UFC"};
  const esc = value => String(value ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  const initials = name => String(name || "?").split(/\s+/).slice(0,2).map(x=>x[0]||"").join("").toUpperCase();
  function person(item, index, label) {
    const img = item.image_url ? '<img src="'+esc(item.image_url)+'" alt="" loading="lazy" onerror="this.remove()">' : '<span class="hub-avatar-fallback">'+esc(initials(item.name))+'</span>';
    const rank = item.rank != null ? (item.rank===0 ? "C" : "#"+item.rank) : (index+1);
    const extra = [item.team,item.points!=null?item.points+" pts":null,item.prize_money,item.org].filter(Boolean).join(" · ");
    return '<div class="hub-person">'+img+'<span class="hub-rank">'+esc(rank)+'</span><span class="hub-person-name"><strong>'+esc(item.name||"TBC")+'</strong><small>'+esc(extra||label||"")+'</small></span></div>';
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
  function render(sport=active) {
    active=sport;
    root.innerHTML=panel(sport);
  }
  fetch("./data/sports-hub.json?t="+Date.now(),{cache:"no-store"}).then(r=>{if(!r.ok)throw Error("HTTP "+r.status);return r.json();}).then(data=>{
    payload=data.sports||data;
    render(active);
  }).catch(()=>{root.innerHTML='<p class="hub-empty">Standings and rankings will appear here after the next successful sync.</p>';});
  document.addEventListener("sports:select",e=>{if(e.detail&&e.detail.sport)render(e.detail.sport);});
  document.addEventListener("DOMContentLoaded",()=>render(active));
})();