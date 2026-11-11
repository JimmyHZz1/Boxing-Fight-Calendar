(() => {
  "use strict";
  const $=id=>document.getElementById(id);
  const feeds=[
    ["Formula 1","data/f1.json","events"],["PDC Darts","data/darts.json","events"],
    ["Boxing","data/fights.json","events"],["UFC","data/ufc.json","events"],
    ["BKFC","data/bkfc.json","events"],["FIM Speedway","data/speedway.json","competitions"],
    ["Featured games","data/games-featured.json","games"],["Game popularity","data/games-popularity.json","games"],["Games discovery","data/games-discovery.json","featured"],["Company profiles","data/company-profiles.json","companies"]
  ];
  const fmt=value=>{if(!value)return "Not recorded";const d=new Date(value);return Number.isNaN(d.getTime())?String(value):new Intl.DateTimeFormat("en-GB",{dateStyle:"medium",timeStyle:"short",timeZone:"Europe/London"}).format(d)+" UK";};
  const lastUpdated=data=>data.last_successful_update||data.last_updated||data.updated_at||data.generated_at||data.last_updated_at||data.last_successful_update_at||null;
  const today=()=>new Intl.DateTimeFormat("en-CA",{timeZone:"Europe/London"}).format(new Date());
  const fetchJson=async path=>{const r=await fetch("./"+path+"?health-check="+Date.now(),{cache:"no-store"});if(!r.ok)throw new Error("HTTP "+r.status);return r.json();};
  const row=(name,ok,label,detail)=>{const el=document.createElement("div");el.className="data-health-row";const left=document.createElement("div"),title=document.createElement("strong"),sub=document.createElement("small"),badge=document.createElement("span");title.textContent=name;sub.textContent=detail;badge.className="data-health-badge "+(ok?"is-healthy":"is-warning");badge.textContent=label;left.append(title,sub);el.append(left,badge);return el;};
  async function renderSpeedway(){
    const root=$("home-speedway-events");if(!root)return;
    try{
      const data=await fetchJson("data/speedway.json");
      const events=Object.values(data.competitions||{}).flatMap(c=>(c.events||[])).filter(e=>e.date&&e.date>=today()).sort((a,b)=>a.date.localeCompare(b.date)).slice(0,5);
      root.replaceChildren();
      if(!events.length){root.textContent="No dated future Speedway rounds are currently published.";return;}
      events.forEach(event=>{
        const card=document.createElement("button");card.type="button";card.className="home-speedway-event";
        const date=document.createElement("span");date.className="home-speedway-date";date.textContent=new Intl.DateTimeFormat("en-GB",{day:"2-digit",month:"short",timeZone:"UTC"}).format(new Date(event.date+"T12:00:00Z"));
        const copy=document.createElement("span"),name=document.createElement("strong"),meta=document.createElement("small");name.textContent=event.name||"Speedway event";meta.textContent=[event.venue,event.country].filter(Boolean).join(" · ");copy.append(name,meta);card.append(date,copy);card.addEventListener("click",()=>window.SpeedwayPage?.open?.());root.append(card);
      });
    }catch(error){root.textContent="Speedway calendar unavailable: "+error.message;}
  }
  async function runHealth(){
    const overall=$("data-health-overall"),feedRoot=$("data-health-feeds"),imageRoot=$("data-health-images"),summary=$("data-health-summary");
    if(!overall||!feedRoot||!imageRoot)return;
    overall.textContent="CHECKING DATA SOURCES…";feedRoot.replaceChildren();imageRoot.replaceChildren();summary.replaceChildren();
    let good=0,issues=0,totalEvents=0;
    for(const [name,path,field] of feeds){
      try{
        const data=await fetchJson(path);
        const count=field==="competitions"?Object.values(data.competitions||{}).reduce((n,c)=>n+(Array.isArray(c.events)?c.events.length:0),0):(Array.isArray(data[field])?data[field].length:0);
        totalEvents+=count;
        const stamp=lastUpdated(data),age=stamp?(Date.now()-new Date(stamp).getTime())/3600000:Infinity;
        const ok=count>0&&Number.isFinite(age)&&age<336;
        if(ok)good++;else issues++;
        feedRoot.append(row(name,ok,ok?"HEALTHY":"REVIEW",count+" records · Last updated: "+fmt(stamp)));
      }catch(error){issues++;feedRoot.append(row(name,false,"FAILED",error.message));}
    }
    try{
      const [library,index,extra,eventImages,hub]=await Promise.all(["data/image-library.json","data/sports-images.json","data/fighter-images.json","data/event-fighter-images.json","data/sports-hub.json"].map(fetchJson));
      const records=Object.entries(library.images||{}),indexCount=Object.keys(index.images||{}).length,extraCount=Object.keys(extra.images||{}).length,eventCount=Object.keys(eventImages.images||{}).length;
      const missingMeta=records.filter(([,v])=>!v.path||!v.source_url||!v.licence||!v.licence_url||!v.creator||!v.attribution||!v.verified_at);
      const paths=records.map(([,v])=>v.path).filter(Boolean),duplicates=paths.length-new Set(paths).size;
      const allPaths=records.map(([,v])=>v.path).filter(Boolean),local=allPaths.filter(path=>path.startsWith("assets/images/")),external=allPaths.length-local.length;
      const checks=await Promise.all(local.map(async path=>{try{const r=await fetch("./"+path,{method:"HEAD",cache:"no-store"});return r.ok;}catch{return false;}}));
      const missing=checks.filter(ok=>!ok).length,ok=missingMeta.length===0&&duplicates===0&&missing===0;
      if(ok)good++;else issues++;
      imageRoot.append(row("Curated licensed image library",ok,ok?"HEALTHY":"REVIEW",records.length+" records · Last updated: "+fmt(lastUpdated(library))));
      imageRoot.append(row("Sports image index",true,"INDEXED",indexCount+" records · Last updated: "+fmt(lastUpdated(index))));
      imageRoot.append(row("Additional fighter images",true,"INDEXED",extraCount+" records · Last updated: "+fmt(lastUpdated(extra))));
      imageRoot.append(row("Event-specific fighter images",true,"INDEXED",eventCount+" records · Last updated: "+fmt(lastUpdated(eventImages))));
      imageRoot.append(row("Local image files",missing===0,missing===0?"PASS":"MISSING",missing+" missing across "+local.length+" curated paths checked"));
      imageRoot.append(row("Image attribution & licences",missingMeta.length===0&&duplicates===0,missingMeta.length||duplicates?"REVIEW":"PASS",missingMeta.length+" incomplete records · "+duplicates+" duplicate paths"));
      const diag=hub.image_diagnostics||{},enrichmentStamp=diag.last_batch_at||diag.checked_at;
      const recentFound=Number(diag.newly_found||0),attempted=Number(diag.attempted||0);
      const enrichHealthy=attempted>0&&recentFound>0&&!diag.rate_limited;
      const enrichDetail=attempted+" lookups attempted · "+recentFound+" new images · Batch "+(diag.batch_number||0)+" · Last run: "+fmt(enrichmentStamp);
      imageRoot.append(row("Image enrichment pipeline",enrichHealthy,enrichHealthy?"NEW IMAGES FOUND":diag.rate_limited?"RATE LIMITED":attempted?"NO NEW MATCHES":"NOT RUN",enrichDetail));
      if(!enrichHealthy)issues++;else good++;
      [["HEALTHY CHECKS",good],["SCHEDULE RECORDS",totalEvents],["CURATED IMAGES",records.length],["IMAGE ISSUES",missing+missingMeta.length+duplicates]].forEach(([label,value])=>{const card=document.createElement("div");card.className="data-health-metric";const strong=document.createElement("strong"),small=document.createElement("small");strong.textContent=String(value);small.textContent=label;card.append(strong,small);summary.append(card);});
    }catch(error){issues++;imageRoot.append(row("Image database",false,"FAILED",error.message));}
    overall.textContent=issues?"CHECK RECOMMENDED · "+issues+" ITEM(S) NEED ATTENTION":"ALL CHECKS PASSED";
    overall.className="data-health-status "+(issues?"is-warning":"is-healthy");
    $("data-health-checked").textContent="Last checked "+fmt(new Date().toISOString());
  }
  const openHealth=()=>{window.showScreen?.("data-health-screen");runHealth();};
  $("open-data-health")?.addEventListener("click",openHealth);
  $("data-health-recheck")?.addEventListener("click",runHealth);
  document.querySelectorAll(".data-health-footer [data-screen]").forEach(button=>button.addEventListener("click",()=>window.showScreen?.(button.dataset.screen)));
  $("home-speedway-open")?.addEventListener("click",()=>window.SpeedwayPage?.open?.());
  document.addEventListener("sports:screen-changed",e=>{if(e.detail?.screen==="data-health-screen")runHealth();});
  document.addEventListener("sports:feeds-updated",renderSpeedway);
  renderSpeedway();
  window.DataHealthCentre={refresh:runHealth,open:openHealth};
})();