(() => {
  const $=id=>document.getElementById(id);
  const labels={f1:"FORMULA 1",darts:"PDC DARTS",boxing:"BOXING",ufc:"UFC",bkfc:"BKFC"};
  const types={f1:[["driver","Driver"],["team","Constructor / Team"]],darts:[["player","Darts player"]],boxing:[["fighter","Boxer"]],ufc:[["fighter","UFC fighter"]],bkfc:[["fighter","BKFC fighter"]]};
  const key="sports-calendar-my-favourites-v1";
  let favourites=[],hub={},filter="all",events={},compareIds=new Set();
  try{favourites=JSON.parse(localStorage.getItem(key)||"[]");if(!Array.isArray(favourites))favourites=[];}catch(_){favourites=[];}
  const esc=v=>String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  const norm=v=>String(v||"").normalize("NFKD").replace(/[\u0300-\u036f]/g,"").toLowerCase().replace(/[^a-z0-9]+/g," ").trim();
  const make=(tag,cls,text)=>{const n=document.createElement(tag);if(cls)n.className=cls;if(text!=null)n.textContent=text;return n;};
  const constructorMarks={"Mercedes":"MER","Ferrari":"FER","Red Bull":"RBR","McLaren":"MCL","RB F1 Team":"RB","Alpine F1 Team":"ALP","Haas F1 Team":"HAS","Audi":"AUD","Williams":"WIL","Aston Martin":"AMR","Cadillac F1 Team":"CAD"};
  const constructorColours={"Mercedes":"#00d2be","Ferrari":"#ef1a2d","Red Bull":"#4776d0","McLaren":"#ff8700","RB F1 Team":"#6c9bd2","Alpine F1 Team":"#168bd2","Haas F1 Team":"#c7cbd1","Audi":"#f02b32","Williams":"#39a9df","Aston Martin":"#00a58b","Cadillac F1 Team":"#e5e5e5"};
  function constructorBroadcastMark(name){
    const mark=make("span","favourite-f1-team-broadcast",constructorMarks[name]||String(name||"F1").slice(0,3).toUpperCase());
    mark.style.setProperty("--team-color",constructorColours[name]||"#e2b45b");
    mark.setAttribute("role","img");mark.setAttribute("aria-label",name+" F1 television timing-board mark");
    return mark;
  }
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
  const teamAliases={"red bull racing":"Red Bull","oracle red bull racing":"Red Bull","visa cash app rb":"RB F1 Team","racing bulls":"RB F1 Team","rb":"RB F1 Team","alpine":"Alpine F1 Team","haas":"Haas F1 Team","audi f1 team":"Audi","cadillac":"Cadillac F1 Team"};
  function lookup(f){
    const d=hub[f.sport]||{},raw=norm(f.name),n=f.sport==="f1"&&f.type==="team"?norm(teamAliases[raw]||f.name):raw;
    const find=(arr,field="name")=>(arr||[]).find(x=>norm(x[field])===n);
    if(f.sport==="f1")return f.type==="team"?find(d.constructors):find(d.drivers);
    if(f.sport==="darts")return find(d.rankings);
    if(f.sport==="ufc"){for(const div of d.divisions||[]){const hit=find(div.entries);if(hit)return {...hit,division:div.name};}}
    if(f.sport==="boxing"){for(const div of d.divisions||[]){const hit=find(div.champions);if(hit)return {...hit,division:div.name};}}
    return null;
  }
  function displayName(f,profile=lookup(f)){return f.sport==="f1"&&f.type==="team"&&profile?.name?profile.name:f.name;}
  function allSportEvents(sport){
    if(sport==="boxing"){const feed=window.BoxingSchedule?.getEvents?.()||[];return feed.length?feed:events[sport]||[];}
    const feed=window.SportsData?.getEvents?.(sport,true)||[];
    return feed.length?feed:events[sport]||[];
  }
  function eventMatch(f,e){
    const name=norm(f.name),title=norm(e.name||e.title);
    if(f.sport==="f1"&&f.type==="team")return (e.results||[]).some(x=>norm(x.team)===name);
    if(f.sport==="f1")return (e.results||[]).some(x=>norm(x.driver)===name);
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

    return pairs.slice(0,4);
  }

  function profileResults(f){
    const name=norm(displayName(f)),out=[];
    if(f.sport==="f1"){
      allSportEvents("f1").forEach(e=>(e.results||[]).forEach(r=>{
        const match=f.type==="team"?norm(r.team)===name:norm(r.driver)===name;
        if(match)out.push({date:e.date,title:e.name||"Grand Prix",detail:"P"+(r.position||"—")+" · "+(r.points??"0")+" pts",win:String(r.position)==="1",source:e.url||e.source_url});
      }));
    }else{
      allSportEvents(f.sport).forEach(e=>(e.bouts||e.fights||[]).forEach(b=>{
        const a=b.fighter1||b.fighter_a?.name||"",bb=b.fighter2||b.fighter_b?.name||"";
        if(norm(a)!==name&&norm(bb)!==name)return;
        const result=b.result||b.outcome||{},winner=result.winner||result.winner_name||b.winner||b.winner_name||"";
        const winnerId=result.winner_fighter_id;
        const fighterId=(norm(a)===name?b.fighter_a?.id:b.fighter_b?.id);
        const won=(winner&&norm(winner)===name)||(winnerId!=null&&fighterId!=null&&String(winnerId)===String(fighterId));
        const status=String(b.status||"").toLowerCase();
        if(result.method||winner||status==="completed")out.push({date:e.date||e.start_at,title:e.name||e.title||"Fight night",detail:(won?"WIN":winner?"LOSS":"RESULT")+" · "+(result.method||result.finish||status||"Result published"),win:won,source:e.source_url||e.url});
      }));
    }
    return out.filter(x=>x.date).sort((a,b)=>String(b.date).localeCompare(String(a.date)));
  }
  function profileAchievements(f,profile,results){
    const items=[];
    if(profile?.rank===0)items.push("Current champion"+(profile.org?" · "+profile.org:""));
    if(profile?.rank>0)items.push("Ranked #"+profile.rank+(profile.org?" · "+profile.org:""));
    const wins=results.filter(x=>x.win);
    if(wins.length)items.push(wins.length+" verified event win"+(wins.length===1?"":"s")+" in the loaded results");
    if(f.sport==="f1"&&profile?.points!=null)items.push("Scored "+profile.points+" championship points this season");
    if(!items.length)items.push("No verified career achievements are available in the current data feed.");
    return items;
  }
  function openProfile(f){
    const profile=lookup(f),results=profileResults(f),upcoming=nextEvent(f),achievements=profileAchievements(f,profile,results);
    const existing=$("favourite-profile-modal");if(existing)existing.remove();
    const modal=make("div","favourite-profile-modal");modal.id="favourite-profile-modal";modal.setAttribute("role","dialog");modal.setAttribute("aria-modal","true");modal.setAttribute("aria-label",f.name+" profile");
    const panel=make("section","favourite-profile-panel");
    const close=make("button","favourite-profile-close","×");close.type="button";close.setAttribute("aria-label","Close profile");close.addEventListener("click",()=>modal.remove());
    const head=make("div","favourite-profile-head");
    const portrait=make("div","favourite-profile-portrait");
    const shownName=displayName(f,profile);const identity=make("div","favourite-profile-identity");identity.append(make("span","favourite-sport-label",labels[f.sport]),make("h2","",shownName),make("p","",f.type==="team"?"F1 CONSTRUCTOR":f.type.toUpperCase()));
    if(f.sport==="f1"&&f.type==="team"){portrait.append(constructorBroadcastMark(shownName));}
    else if(profile?.image_url){const img=make("img",f.sport==="f1"&&f.type==="driver"?"favourite-f1-driver-portrait":"");img.src=profile.image_url;img.alt=displayName(f,profile)+" portrait";img.onerror=()=>{img.remove();portrait.textContent=f.name.split(/\s+/).map(x=>x[0]).slice(0,2).join("").toUpperCase();};portrait.append(img);}
    else portrait.textContent=f.name.split(/\s+/).map(x=>x[0]).slice(0,2).join("").toUpperCase();
    head.append(portrait,identity,close);panel.append(head);
    const statTitle=make("h3","favourite-profile-section-title","CURRENT PROFILE");
    panel.append(statTitle);
    const stats=statPairs(f,profile);
    if(f.sport==="f1"&&profile?.rank!=null)stats.unshift(["CHAMPIONSHIP RANK","#"+profile.rank]);
    if(profile?.since)stats.push(["CHAMPION SINCE",profile.since]);
    if(profile?.nationality)stats.push(["NATIONALITY",profile.nationality]);
    if(profile?.nickname)stats.push(["NICKNAME",profile.nickname]);
    if(stats.length){const grid=make("div","favourite-profile-stats");stats.slice(0,8).forEach(([k,v])=>{const cell=make("div","favourite-stat");cell.append(make("small","",k),make("strong","",v));grid.append(cell);});panel.append(grid);}
    else panel.append(make("p","favourite-profile-muted","The current published feed does not include verified ranking or career statistics for this profile."));
    const achievementSection=make("section","favourite-profile-section");achievementSection.append(make("h3","favourite-profile-section-title","ACHIEVEMENTS & FORM"));
    const achievementList=make("ul","favourite-profile-achievements");achievements.forEach(x=>achievementList.append(make("li","",x)));achievementSection.append(achievementList);
    const recent=make("div","favourite-profile-recent");recent.append(make("h3","favourite-profile-section-title","RECENT RESULTS"));
    if(results.length){results.slice(0,5).forEach(r=>{const row=make("div","favourite-profile-result");row.append(make("span","favourite-result-date",String(r.date).slice(0,10)),make("strong","",r.title),make("small",r.win?"favourite-result-win":"",r.detail));recent.append(row);});}
    else recent.append(make("p","favourite-profile-muted","No verified recent results are available in the current feed."));
    achievementSection.append(recent);panel.append(achievementSection);
    const next=make("section","favourite-profile-section");next.append(make("h3","favourite-profile-section-title","NEXT APPEARANCE"));
    if(upcoming){const row=make("div","favourite-profile-next");row.append(make("strong","",upcoming.name||upcoming.title||"Upcoming event"),make("span","",String(upcoming.date||upcoming.start_at||"Date TBC").slice(0,10)+" · "+(upcoming.venue||upcoming.location||upcoming.circuit||"Venue TBC")));next.append(row);}
    else next.append(make("p","favourite-profile-muted","No upcoming appearance is currently listed for this favourite."));
    panel.append(next);
    const source=profile?.image_page_url||profile?.source_url||results.find(x=>x.source)?.source;
    if(source&&/^https?:\/\//i.test(source)){const a=make("a","favourite-source","OPEN OFFICIAL PROFILE / SOURCE ↗");a.href=source;a.target="_blank";a.rel="noopener noreferrer";panel.append(a);}
    modal.append(panel);modal.addEventListener("click",e=>{if(e.target===modal)modal.remove();});
    const escClose=e=>{if(e.key==="Escape"){modal.remove();document.removeEventListener("keydown",escClose);}};
    document.addEventListener("keydown",escClose);document.body.append(modal);close.focus();
  }
  function renderComparison(){
    const toolbar=document.querySelector(".favourites-toolbar"),root=$("favourites-content");if(!toolbar||!root)return;
    let panel=$("favourites-comparison");if(panel)panel.remove();
    const selected=favourites.filter(f=>compareIds.has(f.id)).slice(0,3);
    if(!selected.length)return;
    panel=make("section","favourites-comparison");panel.id="favourites-comparison";
    const head=make("div","favourites-comparison-head");head.append(make("h3","","COMPARE FAVOURITES"));
    const clear=make("button","favourites-compare-clear","CLEAR");clear.type="button";clear.addEventListener("click",()=>{compareIds.clear();render();});head.append(clear);panel.append(head);
    const grid=make("div","favourites-comparison-grid");
    selected.forEach(f=>{const col=make("div","favourites-comparison-item");const p=lookup(f);col.append(make("strong","",f.name),make("small","",labels[f.sport]));const pairs=statPairs(f,p);if(f.sport==="f1"&&p?.rank!=null)pairs.unshift(["RANK","#"+p.rank]);if(!pairs.length)col.append(make("p","favourite-profile-muted","No verified stats available."));else pairs.slice(0,5).forEach(([k,v])=>col.append(make("p","",""+k+": "+v)));grid.append(col);});
    panel.append(grid);toolbar.after(panel);
  }

  function card(f){
    const profile=lookup(f),event=nextEvent(f),article=make("article","favourite-card favourite-card-"+f.sport);
    const shownName=displayName(f,profile);const top=make("div","favourite-card-top");
    const portrait=make("div","favourite-card-portrait");
    if(f.sport==="f1"&&f.type==="team"){portrait.append(constructorBroadcastMark(shownName));}
    else if(profile?.image_url){const img=make("img",f.sport==="f1"&&f.type==="driver"?"favourite-f1-driver-portrait":"");img.src=profile.image_url;img.alt=shownName+" portrait";img.loading="lazy";img.onerror=()=>{img.remove();portrait.textContent=f.name.split(/\s+/).slice(0,2).map(x=>x[0]).join("").toUpperCase();};portrait.append(img);}
    else portrait.textContent=f.name.split(/\s+/).slice(0,2).map(x=>x[0]).join("").toUpperCase();
    const identity=make("div","favourite-card-identity");identity.append(make("span","favourite-sport-label",labels[f.sport]),make("h3","",shownName),make("small","",f.type==="team"?"F1 CONSTRUCTOR":f.type.toUpperCase()));
    const remove=make("button","favourite-remove","×");remove.type="button";remove.setAttribute("aria-label","Remove "+shownName+" from favourites");remove.addEventListener("click",()=>{favourites=favourites.filter(x=>x.id!==f.id);compareIds.delete(f.id);save();render();});
    top.append(portrait,identity,remove);article.append(top);
    const actions=make("div","favourite-card-actions");const view=make("button","favourite-view-profile","VIEW PROFILE ↗");view.type="button";view.addEventListener("click",()=>openProfile(f));actions.append(view);
    if(compareIds.has(f.id)){}const compareLabel=make("label","favourite-compare-label");const compare=make("input","");compare.type="checkbox";compare.checked=compareIds.has(f.id);compare.addEventListener("change",()=>{if(compare.checked&&compareIds.size>=3){compare.checked=false;return;}if(compare.checked)compareIds.add(f.id);else compareIds.delete(f.id);render();});compareLabel.append(compare,document.createTextNode("COMPARE"));actions.append(compareLabel);article.append(actions);
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
    if(!list.length){const empty=make("div","favourites-empty");empty.append(make("span","","★"),make("h3","",favourites.length?"No favourites in this sport yet":"Your sports line-up starts here"),make("p","",favourites.length?"Choose another sport filter or add a new favourite above.":"Add a driver, team, darts player or fighter above. Their available stats and upcoming events will appear in this space."));root.append(empty);renderComparison();return;}
    list.forEach(f=>root.append(card(f)));renderComparison();
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
  window.MySportsFavourites={refresh:render,openProfile};
})();
