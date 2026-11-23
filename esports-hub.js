(() => {
  "use strict";
  const $=id=>document.getElementById(id);
  const allowedOrganisers=[
    {id:"valve",name:"Valve Majors",label:"MAJOR"},{id:"esl",name:"ESL / Intel Extreme Masters",label:"PREMIER"},
    {id:"blast",name:"BLAST Premier",label:"PREMIER"},{id:"pgl",name:"PGL",label:"PREMIER"},
    {id:"eswc",name:"Esports World Cup",label:"PREMIER"},{id:"cac",name:"CS Asia Championships",label:"PREMIER"},
    {id:"starladder",name:"StarLadder StarSeries",label:"PREMIER"},{id:"thunderpick",name:"Thunderpick World Championship",label:"PREMIER"},
    {id:"fissure",name:"FISSURE Playground",label:"PREMIER"}
  ];
  let feed={events:[],matches:[],teams:[]},activeView="overview",activeOrganiser="all";
  const esc=value=>String(value??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  const dateValue=value=>{if(!value)return null;const d=new Date(value);return Number.isNaN(d.getTime())?null:d;};
  const dateLabel=value=>{const d=dateValue(value);return d?new Intl.DateTimeFormat("en-GB",{timeZone:"Europe/London",day:"numeric",month:"short",year:"numeric"}).format(d):"Date TBC";};
  const timeLabel=value=>{const d=dateValue(value);return d?new Intl.DateTimeFormat("en-GB",{timeZone:"Europe/London",hour:"2-digit",minute:"2-digit",hour12:false}).format(d)+" UK":"Time TBC";};
  const normal=value=>String(value||"").toLowerCase().replace(/[^a-z0-9]+/g," ").trim();
  const status=value=>{const s=normal(value);if(["live","in progress","ongoing"].includes(s))return "live";if(["finished","completed","complete"].includes(s))return "completed";return "upcoming";};
  const eventOrganiser=event=>String(event.organiser_id||event.organiser||"").toLowerCase();
  const allMatches=()=>feed.matches.slice().sort((a,b)=>(dateValue(b.start_at)?.getTime()||0)-(dateValue(a.start_at)?.getTime()||0));
  const searchTerm=()=>normal($("esports-search-input")?.value);
  function eventMatchesSearch(event,q){return !q||[event.name,event.organiser,event.venue,event.location,...(event.teams||[])].some(v=>normal(v).includes(q));}
  function renderMatch(match){
    const live=status(match.status)==="live",complete=status(match.status)==="completed",tournament=feed.events.find(e=>String(e.id)===String(match.event_id));
    const score=match.score_a!=null&&match.score_b!=null?esc(match.score_a)+" : "+esc(match.score_b):"VS";
    return '<article class="esports-match-card"><div class="esports-match-top"><span>'+esc(match.stage||match.round||tournament?.name||"COUNTER-STRIKE 2")+'</span><span class="'+(live?"esports-live-pill":"")+'">'+(live?"● LIVE":complete?"FINAL":esc(match.status||"SCHEDULED").toUpperCase())+'</span></div><div class="esports-match-teams"><div class="esports-match-team">'+esc(match.team_a||match.team1||"TBC")+'</div><div class="esports-match-score">'+score+'</div><div class="esports-match-team">'+esc(match.team_b||match.team2||"TBC")+'</div></div><div class="esports-match-foot"><span>'+esc(tournament?.name||match.tournament||"Tournament TBC")+'</span><span>'+(live?"LIVE NOW":complete?"COMPLETED":timeLabel(match.start_at))+'</span></div></article>';
  }
  function eventCard(event){
    const org=allowedOrganisers.find(o=>o.id===eventOrganiser(event)),end=event.end_at||event.end_date;
    return '<article class="esports-tournament-card" role="button" tabindex="0" data-esports-event="'+esc(event.id)+'"><div class="esports-tournament-top"><span>'+esc(org?.name||event.organiser||"Premier tournament")+'</span><span class="esports-tournament-tier">'+esc(event.tier||org?.label||"PREMIER").toUpperCase()+'</span></div><h3>'+esc(event.name)+'</h3><p>'+esc(event.location||event.venue||"Location TBC")+' · '+esc(dateLabel(event.start_at||event.date))+(end?" – "+esc(dateLabel(end)):"")+'</p><div class="esports-tournament-foot"><span>'+esc(event.status||"Scheduled").toUpperCase()+'</span><span>'+((event.teams||[]).length||event.team_count||"—")+' TEAMS · VIEW DETAILS ↗</span></div></article>';
  }
  function renderOverview(){
    const q=searchTerm(),matches=allMatches().filter(m=>!q||[m.team_a,m.team_b,m.tournament,m.stage].some(v=>normal(v).includes(q)));
    const live=matches.filter(m=>status(m.status)==="live"),results=matches.filter(m=>status(m.status)==="completed").slice(0,8),now=Date.now();
    const events=feed.events.filter(e=>eventMatchesSearch(e,q)&&status(e.status)!=="completed"&&(!dateValue(e.end_at||e.end_date)||dateValue(e.end_at||e.end_date).getTime()>=now)).sort((a,b)=>(dateValue(a.start_at||a.date)?.getTime()||0)-(dateValue(b.start_at||b.date)?.getTime()||0)).slice(0,6);
    $("esports-live-count").textContent=live.length+" LIVE";$("esports-live-matches").innerHTML=live.length?live.map(renderMatch).join(""):'<p class="esports-empty">No verified live matches are being reported right now. The live panel will populate when the match feed confirms an active series.</p>';
    $("esports-upcoming-count").textContent=events.length+" EVENTS";$("esports-upcoming-events").innerHTML=events.length?events.map(eventCard).join(""):'<p class="esports-empty">No upcoming tournaments are available in the current feed. We will not invent fixtures or dates while the schedule source is being connected.</p>';
    $("esports-results-count").textContent=results.length+" RESULTS";$("esports-recent-results").innerHTML=results.length?results.map(renderMatch).join(""):'<p class="esports-empty">No completed match results are available in the current feed yet.</p>';
  }
  function filteredEvents(){const q=searchTerm();return feed.events.filter(e=>eventMatchesSearch(e,q)&&(activeOrganiser==="all"|| (activeOrganiser==="other"?!["valve","esl","blast","pgl"].includes(eventOrganiser(e)):eventOrganiser(e)===activeOrganiser)));}
  function renderTournaments(){const list=filteredEvents();$("esports-all-tournaments").innerHTML=list.length?list.map(eventCard).join(""):'<p class="esports-empty">No tournaments match this filter in the current feed.</p>';}
  function renderTeams(){const q=searchTerm(),teams=feed.teams.filter(t=>!q||[t.name,t.region,t.ranking,t.org].some(v=>normal(v).includes(q)));$("esports-team-grid").innerHTML=teams.length?teams.map(t=>'<article class="esports-team-card"><span class="esports-team-mark">'+esc(String(t.short_name||t.name||"CS").slice(0,3).toUpperCase())+'</span><span><strong>'+esc(t.name)+'</strong><small>'+esc([t.region,t.ranking?"Rank "+t.ranking:null,t.org].filter(Boolean).join(" · ")||"Team profile")+'</small></span></article>').join(""):'<p class="esports-empty">Verified team profiles and rosters will appear here once roster data is available.</p>';}
  function render(){
    $("esports-live-section").hidden=activeView!=="overview";$("esports-upcoming-section").hidden=activeView!=="overview";$("esports-results-section").hidden=activeView!=="overview";
    $("esports-tournaments-section").hidden=activeView!=="tournaments";$("esports-teams-section").hidden=activeView!=="teams";
    document.querySelectorAll("[data-esports-view]").forEach(b=>b.setAttribute("aria-pressed",String(b.dataset.esportsView===activeView)));
    renderOverview();renderTournaments();renderTeams();
  }
  function openEvent(id){
    const event=feed.events.find(e=>String(e.id)===String(id));if(!event)return;
    const matches=allMatches().filter(m=>String(m.event_id)===String(id)),teams=(event.teams||[]).map(t=>typeof t==="string"?t:t.name).filter(Boolean);
    $("esports-detail-content").innerHTML='<div class="esports-detail-block"><p>'+esc(event.organiser||"Premier Counter-Strike event")+' · '+esc(dateLabel(event.start_at||event.date))+(event.end_at||event.end_date?" – "+esc(dateLabel(event.end_at||event.end_date)):"")+'</p><p>'+esc(event.location||event.venue||"Location TBC")+(event.prize_pool?" · "+esc(event.prize_pool):"")+'</p><p>'+esc(event.format||"Tournament format details will be added when published.")+'</p>'+(event.event_url?'<p><a href="'+esc(event.event_url)+'" target="_blank" rel="noopener noreferrer">Official tournament page ↗</a></p>':"")+'</div><div class="esports-detail-block"><h3>Teams & participants</h3>'+(teams.length?'<ul>'+teams.map(t=>'<li>'+esc(t)+'</li>').join("")+'</ul>':'<p>Participant list has not been published in the current feed.</p>')+'</div><div class="esports-detail-block"><h3>Fixtures & results</h3>'+(matches.length?'<div class="esports-match-grid">'+matches.map(renderMatch).join("")+'</div>':'<p>Fixtures and match results will appear here once confirmed.</p>')+'</div><div class="esports-detail-block"><h3>Standings & bracket</h3><p>'+(event.standings?"Standings are available in the tournament feed.":"Standings and bracket information will appear when the organiser publishes them.")+'</p></div>';
    $("esports-detail-title").textContent=event.name;$("esports-detail-dialog").showModal();
  }
  async function load(){
    const statusNode=$("esports-feed-status"),refresh=$("esports-refresh");if(refresh)refresh.disabled=true;
    try{const response=await fetch("./data/esports.json?t="+Date.now(),{cache:"no-store"});if(!response.ok)throw new Error("HTTP "+response.status);const incoming=await response.json();if(!incoming||!Array.isArray(incoming.events)||!Array.isArray(incoming.matches)||!Array.isArray(incoming.teams))throw new Error("Feed structure invalid");feed=incoming;if(statusNode)statusNode.textContent=incoming.updated_at?"UPDATED "+dateLabel(incoming.updated_at):"FEED READY · DATA SOURCE PENDING";}
    catch(error){if(statusNode)statusNode.textContent="TOURNAMENT FEED UNAVAILABLE";}
    if(refresh)refresh.disabled=false;render();
  }
  document.addEventListener("sports:screen-changed",event=>{
    const active=event.detail?.screen==="esports-hub-screen";document.body.classList.toggle("esports-mode",active);
    if(active){const title=$("brand-title"),mark=$("brand-mark-letter");if(title)title.textContent="ESPORTS";if(mark){mark.textContent="E";mark.classList.remove("brand-mark-image");}load();}
  });
  document.querySelectorAll("[data-esports-view]").forEach(b=>b.addEventListener("click",()=>{activeView=b.dataset.esportsView;render();}));
  document.querySelectorAll("[data-esports-organiser]").forEach(b=>b.addEventListener("click",()=>{activeOrganiser=b.dataset.esportsOrganiser;document.querySelectorAll("[data-esports-organiser]").forEach(x=>x.setAttribute("aria-pressed",String(x===b)));renderTournaments();}));
  $("esports-search-input")?.addEventListener("input",render);$("esports-refresh")?.addEventListener("click",load);$("esports-detail-close")?.addEventListener("click",()=>$("esports-detail-dialog").close());
  document.addEventListener("click",event=>{const card=event.target.closest("[data-esports-event]");if(card)openEvent(card.dataset.esportsEvent);});
  document.addEventListener("keydown",event=>{const card=event.target.closest("[data-esports-event]");if(card&&(event.key==="Enter"||event.key===" ")){event.preventDefault();openEvent(card.dataset.esportsEvent);}});
  if($("esports-hub-screen"))render();
})();
