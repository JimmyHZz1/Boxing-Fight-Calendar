(() => {
  const $=id=>document.getElementById(id);
  const labels={f1:"FORMULA 1",darts:"PDC DARTS",boxing:"BOXING",ufc:"UFC",bkfc:"BKFC"};
  const types={f1:[["driver","Driver"],["team","Constructor / Team"]],darts:[["player","Darts player"]],boxing:[["fighter","Boxer"]],ufc:[["fighter","UFC fighter"]],bkfc:[["fighter","BKFC fighter"]]};
  const key="sports-calendar-my-favourites-v1";
  let favourites=[],hub={},filter="all",events={};
  try{favourites=JSON.parse(localStorage.getItem(key)||"[]");if(!Array.isArray(favourites))favourites=[];}catch(_){favourites=[];}
  const esc=v=>String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  const norm=v=>String(v||"").normalize("NFKD").replace(/[\u0300-\u036f]/g,"").toLowerCase().replace(/[^a-z0-9]+/g," ").trim();
  const make=(tag,cls,text)=>{const n=document.createElement(tag);if(cls)n.className=cls;if(text!=null)n.textContent=text;return n;};
  const save=()=>{try{localStorage.setItem(key,JSON.stringify(favourites));}catch(_){$("favourites-content").prepend(make("p","favourites-error","Could not save favourites on this device. Check browser storage settings."));}};
  function updateTypes(){
    const sport=$("favourite-sport").value,select=$("favourite-type");
    select.replaceChildren();
    (types[sport]||[]).forEach(([value,label])=>{const o=make("option","",label);o.value=value;select.append(o);});
  }
  function profileOptions(){
    const sport=$("favourite-sport").value,items=[];
    const d=hub[sport]||{};
    if(sport==="f1"){(d.drivers||[]).forEach(x=>items.push(x.name));(d.constructors||[]).forEach(x=>items.push(x.name));}
    if(sport==="darts")(d.rankings||[]).forEach(x=>items.push(x.name));
    if(sport==="ufc")(d.divisions||[]).forEach(div=>(div.entries||[]).forEach(x=>items.push(x.name)));
    if(sport==="boxing")(d.divisions||[]).forEach(div=>(div.champions||[]).forEach(x=>items.push(x.name)));
    if(sport==="boxing"||sport==="ufc"||sport==="bkfc"){
      const list=sport==="boxing"?(window.BoxingSchedule?.getAllBouts?.()||[]):(events[sport]||[]).flatMap(e=>e.fights||[]);
      list.forEach(b=>[b.fighter1,b.fighter2,b.fighter_a?.name,b.fighter_b?.name].forEach(n=>{if(n&&n!=="TBC")items.push(n);}));
    }
    const unique=[...new Set(items.filter(Boolean))].sort((a,b)=>a.localeCompare(b));
    $("favourite-suggestions").replaceChildren(...unique.slice(0,250).map(name=>{const o=make("option");o.value=name;return o;}));
  }
  function lookup(f){
    const d=hub[f.sport]||{},n=norm(f.name);
    const find=(arr,field="name")=>(arr||[]).find(x=>norm(x[field])===n);
    if(f.sport==="f1")return f.type==="team"?find(d.constructors):find(d.drivers);
    if(f.sport==="darts")return find(d.rankings);
    if(f.sport==="ufc"){for(const div of d.divisions||[]){const hit=find(div.entries);if(hit)return {...hit,division:div.name};}}
    if(f.sport==="boxing"){for(const div of d.divisions||[]){const hit=find(div.champions);if(hit)return {...hit,division:div.name};}}
    return null;
  }
  function allSportEvents(sport){
    if(sport==="boxing")return window.BoxingSchedule?.getEvents?.()||[];
    return window.SportsData?.getEvents?.(sport,true)||events[sport]||[];
  }
  function eventMatch(f,e){
    const name=norm(f.name),title=norm(e.name||e.title);
    if(f.sport==="f1"&&f.type==="team")return (e.results||[]).some(x=>norm(x.team).includes(name))||(e.sessions||[]).length>0&&title.includes("grand prix");
    const fights=e.bouts||e.fights||[];
    return fights.some(b=>[b.fighter1,b.fighter2,b.fighter_a?.name,b.fighter_b?.name].some(x=>norm(x)===name));
  }
  function nextEvent(f){
    const today=new Intl.DateTimeFormat("en-CA",{timeZone:"Europe/London"}).format(new Date());
    return allSportEvents(f.sport).filter(e=>String(e.date||e.start_at||e.event_date||"").slice(0,10)>=today&&eventMatch(f,e)).sort((a,b)=>String(a.date||a.start_at).localeCompare(String(b.date||b.start_at)))[0]||null;
  }
  function statPairs(f,profile){
    const pairs=[];
    if(profile){
      if(profile.rank!=null)pairs.push(["RANK",profile.rank===0?"CHAMPION":"#"+profile.rank]);
      if(profile.points!=null)pairs.push(["POINTS",profile.points]);
      if(profile.prize_money!=null)pairs.push(["PRIZE MONEY","£"+profile.prize_money]);
      if(profile.team)pairs.push(["TEAM",profile.team]);
      if(profile.division)pairs.push(["DIVISION",profile.division]);
      if(profile.org)pairs.push(["ORGANISATION",profile.org]);
    }
    if(f.sport==="f1"&&f.type==="team"&&profile?.points!=null)pairs.push(["CHAMPIONSHIP","POINTS"]);
    return pairs.slice(0,4);
  }
  function card(f){
    const profile=lookup(f),event=nextEvent(f),article=make("article","favourite-card favourite-card-"+f.sport);
    const top=make("div","favourite-card-top");
    const portrait=make("div","favourite-card-portrait");
    if(profile?.image_url){const img=make("img");img.src=profile.image_url;img.alt=f.name+" portrait";img.loading="lazy";img.onerror=()=>{img.remove();portrait.textContent=f.name.split(/\s+/).slice(0,2).map(x=>x[0]).join("").toUpperCase();};portrait.append(img);}
    else portrait.textContent=f.name.split(/\s+/).slice(0,2).map(x=>x[0]).join("").toUpperCase();
    const identity=make("div","favourite-card-identity");identity.append(make("span","favourite-sport-label",labels[f.sport]),make("h3","",f.name),make("small","",f.type==="team"?"TEAM / CONSTRUCTOR":f.type.toUpperCase()));
    const remove=make("button","favourite-remove","×");remove.type="button";remove.setAttribute("aria-label","Remove "+f.name+" from favourites");remove.addEventListener("click",()=>{favourites=favourites.filter(x=>x.id!==f.id);save();render();});
    top.append(portrait,identity,remove);article.append(top);
    const stats=statPairs(f,profile);
    if(stats.length){const grid=make("div","favourite-stats");stats.forEach(([label,value])=>{const cell=make("div","favourite-stat");cell.append(make("small","",label),make("strong","",value));grid.append(cell);});article.append(grid);}
    else article.append(make("p","favourite-no-stats","No verified ranking or championship statistics are currently published for this profile."));
    if(f.note)article.append(make("p","favourite-personal-note","YOUR NOTE · "+f.note));
    if(event){const next=make("div","favourite-next-event");next.append(make("small","","NEXT SCHEDULED APPEARANCE"),make("strong","",event.name||event.title||"Upcoming event"),make("span","",String(event.date||event.start_at||"Date TBC").slice(0,10)+" · "+(event.venue||event.location||event.circuit||"Venue TBC")));article.append(next);}
    else article.append(make("p","favourite-no-event","No upcoming event involving this favourite is currently listed."));
    const source=profile?.image_page_url||profile?.source_url||null;
    if(source&&/^https:\/\//i.test(source)){const a=make("a","favourite-source","PROFILE / DATA SOURCE ↗");a.href=source;a.target="_blank";a.rel="noopener noreferrer";article.append(a);}
    return article;
  }
  function render(){
    const root=$("favourites-content");if(!root)return;root.replaceChildren();
    const list=favourites.filter(f=>filter==="all"||f.sport===filter);
    $("favourites-count").textContent=favourites.length+" "+(favourites.length===1?"FAVOURITE":"FAVOURITES");
    if(!list.length){const empty=make("div","favourites-empty");empty.append(make("span","","★"),make("h3","",favourites.length?"No favourites in this sport yet":"Your sports line-up starts here"),make("p","",favourites.length?"Choose another sport filter or add a new favourite above.":"Add a driver, team, darts player or fighter above. Their available stats and upcoming events will appear in this space."));root.append(empty);return;}
    list.forEach(f=>root.append(card(f)));
  }
  $("favourite-sport")?.addEventListener("change",()=>{updateTypes();profileOptions();});
  $("favourites-form")?.addEventListener("submit",e=>{
    e.preventDefault();const sport=$("favourite-sport").value,type=$("favourite-type").value,name=$("favourite-name").value.trim(),note=$("favourite-note").value.trim();
    if(!name)return;
    const exists=favourites.some(f=>f.sport===sport&&f.type===type&&norm(f.name)===norm(name));
    if(exists){$("favourite-name").setCustomValidity("That favourite is already in your list.");$("favourite-name").reportValidity();return;}
    $("favourite-name").setCustomValidity("");
    favourites.push({id:(crypto.randomUUID?crypto.randomUUID():Date.now()+"-"+Math.random()),sport,type,name,note,added_at:new Date().toISOString()});save();
    $("favourite-name").value="";$("favourite-note").value="";filter="all";
    document.querySelectorAll("[data-fav-filter]").forEach(b=>{b.setAttribute("aria-pressed",b.dataset.favFilter==="all"?"true":"false");});
    render();
  });
  $("favourite-name")?.addEventListener("input",e=>e.target.setCustomValidity(""));
  document.querySelectorAll("[data-fav-filter]").forEach(b=>b.addEventListener("click",()=>{filter=b.dataset.favFilter;document.querySelectorAll("[data-fav-filter]").forEach(x=>x.setAttribute("aria-pressed",x===b?"true":"false"));render();}));
  async function load(){
    try{const r=await fetch("./data/sports-hub.json?t="+Date.now(),{cache:"no-store"});if(r.ok){const d=await r.json();hub=d.sports||d;}}catch(_){}
    for(const s of ["f1","darts","ufc","bkfc"]){try{const r=await fetch("./data/"+s+".json?t="+Date.now(),{cache:"no-store"});if(r.ok){const d=await r.json();events[s]=d.events||[];}}catch(_){}}
    profileOptions();render();
  }
  updateTypes();load();
  document.addEventListener("sports:feeds-updated",()=>{profileOptions();render();});
  document.addEventListener("sports:boxing-data-updated",render);
  window.MySportsFavourites={refresh:render};
})();
