/* Independent Games Calendar navigation and Games-only release history. */
(() => {
  const menu = document.getElementById("mobile-calendar-menu");
  const trigger = document.getElementById("calendar-menu-trigger");
  const mark = document.getElementById("brand-mark-letter");
  const title = document.getElementById("brand-title");
  const closeMenu = () => {
    if (!menu || !trigger) return;
    menu.hidden = true;
    trigger.setAttribute("aria-expanded", "false");
  };
  const setBrand = screenId => {
    const games = screenId === "games-calendar-screen" || screenId === "games-platform-calendar-screen" || screenId === "games-version-history-screen";
    document.body.classList.toggle("games-mode", games);
    if (mark) mark.textContent = games ? "G" : "S";
    if (title) title.textContent = games ? "GAMES" : "SPORTS";
  };
  if (menu && trigger) {
    // A single document-level capture handler handles taps on every nested part
    // of the brand and prevents other header listeners swallowing iOS clicks.
    document.addEventListener("click", event => {
      const target = event.target instanceof Element ? event.target : event.target?.parentElement;
      const triggerHit = target?.closest("#calendar-menu-trigger");
      if (triggerHit) {
        event.preventDefault();
        event.stopPropagation();
        menu.hidden = !menu.hidden;
        trigger.setAttribute("aria-expanded", String(!menu.hidden));
        return;
      }
      const menuButton = target?.closest("#mobile-calendar-menu button[data-screen]");
      if (menuButton && menu.contains(menuButton)) {
        event.preventDefault();
        event.stopPropagation();
        const destination = menuButton.dataset.screen;
        closeMenu();
        setBrand(destination);
        if (typeof window.showScreen === "function") {
          window.showScreen(destination);
        } else {
          document.querySelectorAll(".screen").forEach(screen => {
            screen.classList.toggle("active", screen.id === destination);
          });
          setBrand(destination);
        }
        return;
      }
      if (!menu.contains(target)) closeMenu();
    }, true);
    document.addEventListener("keydown", event => {
      if (event.key === "Escape") closeMenu();
    });
    window.addEventListener("sports:screen-changed", event => setBrand(event.detail?.screen || ""));
  }


  document.querySelectorAll(".games-page-footer [data-screen], .games-history-link[data-screen], .games-version-history-link[data-screen]").forEach(button => {
    button.addEventListener("click", () => window.showScreen?.(button.dataset.screen));
  });

  const list = document.getElementById("games-recent-release-list");
  const status = document.getElementById("games-recent-release-status");
  if (!list) return;
  const featuredTicker = document.getElementById("games-up-next-ticker");
  const releaseList = document.getElementById("games-release-list");
  let allUpcomingGames = [];
  let activePlatform = "all";
  let currentPlatformPage = null;
  const londonMidnight = releaseDate => {
    const [year, month, day] = releaseDate.split("-").map(Number);
    const utcGuess = Date.UTC(year, month - 1, day);
    const parts = new Intl.DateTimeFormat("en-GB", {
      timeZone: "Europe/London", year: "numeric", month: "2-digit",
      day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit",
      hourCycle: "h23"
    }).formatToParts(new Date(utcGuess));
    const values = Object.fromEntries(parts.filter(part => part.type !== "literal").map(part => [part.type, Number(part.value)]));
    const londonClockAsUtc = Date.UTC(values.year, values.month - 1, values.day, values.hour, values.minute, values.second);
    return utcGuess - (londonClockAsUtc - utcGuess);
  };
  const releaseCountdown = releaseDate => {
    const remaining = londonMidnight(releaseDate) - Date.now();
    if (!Number.isFinite(remaining)) return "DATE TBC";
    if (remaining <= 0) return "RELEASED";
    const seconds = Math.floor(remaining / 1000);
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return "IN " + days + "D " + String(hours).padStart(2,"0") + "H " +
      String(minutes).padStart(2,"0") + "M " + String(secs).padStart(2,"0") + "S";
  };
  const isAdditionalRelease = game => {
    const type=String(game?.release_type||game?.category_name||"").toLowerCase().replace(/[^a-z0-9]+/g,"_");
    if(["full_release","main_game","full_game"].includes(type)) return false;
    if(type && !["unknown","game"].includes(type)) return true;
    const category=Number(game?.igdb_category);
    if(Number.isFinite(category) && game?.igdb_category!==null && game?.igdb_category!=="" && category!==0) return true;
    return /\b(dlc|expansion|season pass|add.on|remaster(ed)?|remake|definitive edition|complete edition|game of the year|goty edition|deluxe edition|ultimate edition|collector.?s edition|special edition|anniversary edition|enhanced edition|switch 2 edition|next.?gen upgrade|bundle|pack)\b/i.test(String(game?.title||""));
  };
  const renderReleaseGroups = (games,destination,emptyCopy,prefix) => {
    destination.replaceChildren();
    if(!games.length){const empty=document.createElement("div");empty.className="games-empty-state compact";const title=document.createElement("h3");title.textContent="No upcoming releases found";const copy=document.createElement("p");copy.textContent=emptyCopy;empty.append(title,copy);destination.append(empty);return;}
    const grouped=new Map();games.forEach(game=>{const month=game.release_date.slice(0,7);if(!grouped.has(month))grouped.set(month,[]);grouped.get(month).push(game);});
    const nav=document.createElement("nav");nav.className="games-timeline-month-nav";nav.setAttribute("aria-label","Jump to release month");const groups=[];
    [...grouped.entries()].forEach(([month,monthGames],index)=>{
      const date=new Date(month+"-15T12:00:00");const label=new Intl.DateTimeFormat("en-GB",{month:"long",year:"numeric",timeZone:"Europe/London"}).format(date);
      const button=document.createElement("button");button.type="button";button.textContent=new Intl.DateTimeFormat("en-GB",{month:"short",year:"numeric",timeZone:"Europe/London"}).format(date);
      const id=prefix+"month-"+month;button.setAttribute("aria-controls",id);button.setAttribute("aria-current",index===0?"true":"false");nav.append(button);
      const details=document.createElement("details");details.className="games-month-group";details.open=index===0;
      const summary=document.createElement("summary");summary.className="games-month-summary";const name=document.createElement("strong");name.textContent=label;
      const count=document.createElement("small");count.textContent=monthGames.length+(monthGames.length===1?" RELEASE":" RELEASES");
      const toggle=document.createElement("span");toggle.className="games-month-toggle";toggle.setAttribute("aria-hidden","true");summary.append(name,count,toggle);
      const timeline=document.createElement("div");timeline.className="games-month-timeline";timeline.id=id;renderTimeline(monthGames,timeline,prefix+month+"-",false);
      details.append(summary,timeline);groups.push({button,details,timeline});button.addEventListener("click",()=>{details.open=true;timeline.scrollIntoView({behavior:"smooth",block:"start"});});
    });
    destination.append(nav);const container=document.createElement("div");container.className="games-month-groups";groups.forEach(group=>container.append(group.details));destination.append(container);
  };
  const renderFeaturedGames = items => {
    if (!featuredTicker) return;
    const today = new Intl.DateTimeFormat("en-CA", {timeZone:"Europe/London",year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date());
    const upcoming = (Array.isArray(items) ? items : [])
      .filter(game => game && !isAdditionalRelease(game) && typeof game.release_date === "string" && game.release_date.length === 10 && game.release_date[4] === "-" && game.release_date[7] === "-" && game.release_date >= today)
      .sort((a,b) => a.release_date.localeCompare(b.release_date));
    featuredTicker.replaceChildren();
    if (!upcoming.length) {
      const empty = document.createElement("span");
      empty.className = "games-up-next-loading";
      empty.textContent = "No confirmed major release dates currently listed.";
      featuredTicker.append(empty);
      return;
    }
    const track = document.createElement("div");
    track.className = "next-event-track";
    const group = document.createElement("div");
    group.className = "next-event-group";
    upcoming.forEach(game => {
      const item = document.createElement(game.source_url && (game.source_url.startsWith("https://") || game.source_url.startsWith("http://")) ? "a" : "article");
      item.className = "next-event-item games-up-next-item";
      item.dataset.sport = "games";
      if (item.tagName === "A") {
        item.href = game.source_url;
        item.target = "_blank";
        item.rel = "noopener noreferrer";
        item.setAttribute("aria-label", "Release details for " + (game.title || "upcoming game"));
      }
      const info = document.createElement("span");
      info.className = "next-event-info";
      const label = document.createElement("small");
      label.className = "next-event-sport";
      label.textContent = game.verification_status === "verified" ? "GAMES · VERIFIED" : "GAMES · ESTIMATED";
      const name = document.createElement("strong");
      name.className = "next-event-name";
      name.textContent = game.title || "Upcoming release";
      const countdown = document.createElement("small");
      countdown.className = "next-event-countdown";
      countdown.dataset.releaseDate = game.release_date;
      countdown.textContent = releaseCountdown(game.release_date);
      const platforms = document.createElement("small");
      platforms.className = "next-event-detail";
      platforms.textContent = Array.isArray(game.platforms) ? game.platforms.join(" · ") : "PC & CONSOLE";
      info.append(label, name, countdown, platforms);
      const logoWrap = document.createElement("span");
      logoWrap.className = "next-event-state games-up-next-logo";
      if (game.logo_text) {
        logoWrap.textContent = game.logo_text;
        logoWrap.classList.add("games-up-next-logo-text");
      } else if ((game.logo_url || game.artwork_url) && (game.logo_url || game.artwork_url).startsWith("https://")) {
        const logo = document.createElement("img");
        logo.src = game.logo_url || game.artwork_url;
        logo.alt = (game.title || "Game") + " logo";
        logo.loading = "lazy";
        logo.onerror = () => {
          logo.remove();
          logoWrap.textContent = String(game.short_name || game.title || "GAME").split(" ").map(word => word[0]).join("").slice(0,3).toUpperCase();
          logoWrap.classList.add("games-up-next-logo-fallback");
        };
        logoWrap.append(logo);
      } else {
        logoWrap.textContent = String(game.short_name || game.title || "GAME").split(" ").map(word => word[0]).join("").slice(0,3).toUpperCase();
        logoWrap.classList.add("games-up-next-logo-fallback");
      }
      item.append(logoWrap, info);
      group.append(item);
    });
    track.append(group);
    featuredTicker.replaceChildren(track);
    const groupWidth = group.getBoundingClientRect().width || group.scrollWidth;
    const gap = parseFloat(getComputedStyle(group).columnGap || getComputedStyle(group).gap) || 0;
    const loopDistance = groupWidth + gap;
    if (groupWidth && loopDistance) {
      const targetWidth = Math.max(featuredTicker.clientWidth + loopDistance * 1.25, loopDistance * 2.5);
      let copies = 1;
      while (track.scrollWidth < targetWidth && copies < 20) {
        const clone = group.cloneNode(true);
        clone.dataset.tickerClone = "true";
        clone.setAttribute("aria-hidden", "true");
        clone.querySelectorAll("a,button").forEach(node => { node.tabIndex = -1; });
        track.append(clone);
        copies++;
      }
      track.style.setProperty("--ticker-distance", loopDistance + "px");
      track.style.setProperty("--ticker-offset", "-" + loopDistance + "px");
      track.style.setProperty("--ticker-duration", Math.max(14, loopDistance / 38) + "s");
      featuredTicker.classList.add("is-auto-scrolling");
    }
  };
  const companyDomains={"rockstar games":"rockstargames.com","rockstar north":"rockstargames.com","ubisoft":"ubisoft.com","electronic arts":"ea.com","ea":"ea.com","nintendo":"nintendo.com","sony interactive entertainment":"sony.com","playstation studios":"playstation.com","microsoft":"microsoft.com","xbox game studios":"xbox.com","sega":"sega.com","atlus":"atlus.com","capcom":"capcom.com","bandai namco":"bandainamcoent.com","bandai namco entertainment":"bandainamcoent.com","kojima productions":"kojimaproductions.jp","lucasfilm games":"lucasfilm.com","quantic dream":"quanticdream.com","saber interactive":"saber.games","square enix":"square-enix-games.com","deep silver":"deepsilver.com","king art games":"kingart-games.com","warner bros. games":"wbgames.com","warner bros games":"wbgames.com","activision":"activision.com","blizzard entertainment":"blizzard.com","bethesda":"bethesda.net","bethesda softworks":"bethesda.net","insomniac games":"insomniac.games","fromsoftware":"fromsoftware.jp","konami":"konami.com","take-two interactive":"take2games.com","2k":"2k.com","focus entertainment":"focus-entmt.com","thq nordic":"thqnordic.com","atari":"atari.com","amazon games":"amazon.com"};
  const companyLogoUrl=name=>{const domain=companyDomains[String(name||"").toLowerCase().trim()];return domain?"https://www.google.com/s2/favicons?domain="+encodeURIComponent(domain)+"&sz=96":"";};
  const addCompanyMarks=(parent,game)=>{
    const names=[game.developer,game.publisher].filter((name,index,array)=>name&&array.findIndex(x=>String(x).toLowerCase()===String(name).toLowerCase())===index);
    if(!names.length)return;
    const row=document.createElement("div");row.className="games-release-companies";
    names.forEach(name=>{const key=String(name).toLowerCase().replace(/[^a-z0-9]+/g," ").trim();const companyIds={"rockstar games":"rockstar-games","rockstar north":"rockstar-games","ubisoft":"ubisoft","electronic arts":"electronic-arts","ea":"electronic-arts","nintendo":"nintendo","sony interactive entertainment":"playstation-studios","playstation studios":"playstation-studios","xbox game studios":"xbox-game-studios","microsoft studios":"xbox-game-studios","sega":"sega","capcom":"capcom","bandai namco entertainment":"bandai-namco","konami digital entertainment":"konami","take two interactive":"take-two","2k":"take-two","warner bros games":"warner-bros-games","warner bros interactive entertainment":"warner-bros-games","bethesda softworks":"bethesda","activision":"activision-blizzard","blizzard entertainment":"activision-blizzard","square enix":"square-enix","cd projekt red":"cd-projekt","cd projekt":"cd-projekt","kojima productions":"kojima-productions","fromsoftware":"fromsoftware"};const companyId=companyIds[key];const mark=document.createElement(companyId?"button":"span");mark.className="games-release-company";if(companyId){mark.type="button";mark.title="View "+name+" company profile";mark.setAttribute("aria-label","View "+name+" company profile");mark.addEventListener("click",()=>document.dispatchEvent(new CustomEvent("open-games-company-profile",{detail:{companyId}})));}const url=companyLogoUrl(name);if(url){const img=document.createElement("img");img.src=url;img.alt="";img.loading="lazy";img.onerror=()=>img.remove();mark.append(img);}const label=document.createElement("small");label.textContent=name;mark.append(label);row.append(mark);});
    parent.append(row);
  };
  const platformIcon = platform => {
    const value = String(platform || "").toLowerCase();
    if (value.includes("steam")) return ["STEAM","STEAM"];
    if (value.includes("playstation") || value.includes("ps4") || value.includes("ps5")) return ["PS","PLAYSTATION"];
    if (value.includes("xbox")) return ["XBOX","XBOX"];
    if (value.includes("nintendo") || value.includes("switch")) return ["N","NINTENDO"];
    if (value === "pc" || value.startsWith("pc ")) return ["PC","PC"];
    return ["GAME","PLATFORM"];
  };
  const comingSoonStatus = releaseDate => {
    const today = new Intl.DateTimeFormat("en-CA", {timeZone:"Europe/London",year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date());
    if (releaseDate < today) return "";
    const todayUtc = new Date(today + "T00:00:00Z");
    const mondayOffset = (todayUtc.getUTCDay() + 6) % 7;
    const weekStart = new Date(todayUtc.getTime() - mondayOffset * 86400000).toISOString().slice(0,10);
    const weekEnd = new Date(todayUtc.getTime() + (6 - mondayOffset) * 86400000).toISOString().slice(0,10);
    if (releaseDate >= weekStart && releaseDate <= weekEnd) return "week";
    if (releaseDate.slice(0,7) === today.slice(0,7)) return "month";
    return "";
  };
  const renderTimeline = (games, target, prefix, showMonthHeading = true) => {
    const today = new Intl.DateTimeFormat("en-CA",{timeZone:"Europe/London",year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date());
    games.forEach((game,index) => {
      const card = document.createElement("article");
      card.className = "games-release-card";
      const artwork = document.createElement("div");
      artwork.className = "games-release-artwork";
      const steamMatch=String(game.source_url||"").match(/store\.steampowered\.com\/app\/(\d+)/i);
      const artworkUrl = game.artwork_url || game.logo_url || (steamMatch?"https://cdn.akamai.steamstatic.com/steam/apps/"+steamMatch[1]+"/header.jpg":"");
      if (artworkUrl.startsWith("https://")) {
        const image = document.createElement("img");
        image.className = "games-release-artwork-image";
        image.src = artworkUrl;
        image.alt = (game.title || "Game") + (game.artwork_url ? " artwork" : " logo");
        image.dataset.imageType = game.artwork_url ? "artwork" : "logo";
        image.loading = "lazy";
        image.onerror = () => {
          image.remove();
          artwork.textContent = String(game.short_name || game.title || "GAME").split(" ").map(word => word[0]).join("").slice(0,3).toUpperCase();
          artwork.classList.add("games-release-artwork-fallback");
        };
        artwork.append(image);
      } else {
        artwork.textContent = String(game.short_name || game.title || "GAME").split(" ").map(word => word[0]).join("").slice(0,3).toUpperCase();
        artwork.classList.add("games-release-artwork-fallback");
      }
      const date = document.createElement("div");
      date.className = "games-release-date";
      const releaseDateValue = new Date(game.release_date + "T12:00:00");
      date.textContent = new Intl.DateTimeFormat("en-GB",{weekday:"short",day:"2-digit",month:"short",year:"numeric",timeZone:"Europe/London"}).format(releaseDateValue).toUpperCase();
      const details = document.createElement("div");
      details.className = "games-release-details";
      const title = document.createElement("h3");
      title.textContent = game.title || "Upcoming game";
      const platforms = document.createElement("div");
      platforms.className = "games-platform-badges";
      (Array.isArray(game.platforms) ? game.platforms : ["PC & console"]).forEach(platform => {
        const [icon,label] = platformIcon(platform);
        const chip = document.createElement("span");
        chip.className = "games-platform-chip";
        const mark = document.createElement("img");
        const logoSlug = icon === "PS" ? "playstation" : icon === "XBOX" ? "xbox" : icon === "N" ? "nintendo" : icon === "STEAM" ? "steam" : icon === "PC" ? "windows" : "";
        mark.className = "games-platform-mark-image";
        mark.alt = "";
        mark.setAttribute("aria-hidden","true");
        if (logoSlug) {
          mark.src = "./assets/platform-" + logoSlug + ".svg";
          mark.loading = "eager";
          mark.onerror = () => { const fallback = document.createElement("b"); fallback.className = "games-platform-mark games-platform-mark-" + icon.toLowerCase(); fallback.textContent = icon; fallback.setAttribute("aria-hidden","true"); mark.replaceWith(fallback); };
        } else { mark.replaceWith(Object.assign(document.createElement("b"),{className:"games-platform-mark",textContent:icon})); }
        const text = document.createElement("span");
        text.textContent = label;
        chip.append(mark,text);
        platforms.append(chip);
      });
      const comingSoon = comingSoonStatus(game.release_date);
      if (comingSoon) {
        const badge = document.createElement("small");
        badge.className = "games-coming-soon games-coming-soon-" + comingSoon;
        badge.textContent = comingSoon === "week" ? "COMING SOON · THIS WEEK" : "COMING SOON · THIS MONTH";
        badge.setAttribute("aria-label", comingSoon === "week" ? "Releasing this week" : "Releasing this month");
        details.append(badge);
      }
      const countdown = document.createElement("small");
      countdown.className = "games-release-countdown";
      countdown.dataset.releaseDate = game.release_date;
      countdown.textContent = releaseCountdown(game.release_date);
      const verification = document.createElement("small");
      verification.className = "games-release-meta";
      verification.textContent = game.verification_status === "verified" ? "VERIFIED RELEASE DATE" : "ESTIMATED DATE · CHECK PUBLISHER";
      details.append(date,title,platforms,countdown,verification);
      addCompanyMarks(details,game);
      const platformDates = Array.isArray(game.release_dates) ? game.release_dates.filter(entry => entry && entry.date && (activePlatform === "all" || String(entry.platform||"").toLowerCase().includes(activePlatform === "pc" ? "pc" : activePlatform))) : [];
      if (platformDates.length) {
        const dateInfo = document.createElement("small");
        dateInfo.className = "games-release-platform-dates";
        const visibleDates = platformDates.slice(0,4).map(entry => {
          const dateLabel = new Intl.DateTimeFormat("en-GB",{day:"2-digit",month:"short",year:"numeric",timeZone:"Europe/London"}).format(new Date(entry.date+"T12:00:00"));
          return String(entry.platform||"Platform").toUpperCase()+" · "+dateLabel+(entry.region ? " · "+entry.region : "");
        });
        dateInfo.textContent = visibleDates.join("  /  ")+(platformDates.length>4 ? "  /  +"+(platformDates.length-4)+" MORE" : "");
        details.append(dateInfo);
      }
      if (game.source_url && game.source_url.startsWith("http")) {
        const link = document.createElement("a");
        link.href = game.source_url;
        link.target = "_blank";
        link.rel = "noopener noreferrer";
        link.className = "games-release-source";
        link.textContent = "FULL RELEASE DETAILS ↗";
        link.setAttribute("aria-label", "Release details for " + (game.title || "upcoming game"));
        details.append(link);
      }
      card.append(artwork,details);
      target.append(card);
    });
  };
  const renderUpcomingReleases = (items,options={}) => {
    const {target=releaseList,platform="all",additionalTarget=null,additionalDetails=null,additionalCount=null,fullCount=null}=options;
    if(!target)return;activePlatform=platform;
    const today=new Intl.DateTimeFormat("en-CA",{timeZone:"Europe/London",year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date());
    const matchesPlatform=game=>platform==="all"||(Array.isArray(game.platforms)&&game.platforms.some(value=>{
      const name=String(value).toLowerCase();
      if(platform==="steam")return name.includes("steam");
      if(platform==="pc")return name==="pc"||name.startsWith("pc ")||name.includes("windows")||name.includes("linux")||name.includes("mac");
      if(platform==="playstation")return name.includes("playstation")||/\bps[45]\b/i.test(name);
      if(platform==="xbox")return name.includes("xbox");
      if(platform==="nintendo")return name.includes("nintendo")||name.includes("switch");
      return false;
    }));
    const dated=(Array.isArray(items)?items:[]).filter(game=>game&&typeof game.release_date==="string"&&/^\d{4}-\d{2}-\d{2}$/.test(game.release_date)&&game.release_date>=today&&matchesPlatform(game)).sort((a,b)=>a.release_date.localeCompare(b.release_date)||String(a.title).localeCompare(String(b.title)));
    const full=dated.filter(game=>!isAdditionalRelease(game)),additional=dated.filter(isAdditionalRelease);
    renderReleaseGroups(full,target,platform==="all"?"Upcoming full PC and console game releases will appear here as dates are added.":"There are no upcoming full game releases listed for this platform.","full-"+platform+"-");
    if(fullCount)fullCount.textContent=full.length+(full.length===1?" RELEASE":" RELEASES");
    if(additionalDetails&&additionalTarget){additionalDetails.hidden=additional.length===0;if(additionalCount)additionalCount.textContent=additional.length+(additional.length===1?" RELEASE":" RELEASES");if(additional.length)renderReleaseGroups(additional,additionalTarget,"No DLC or alternate versions are currently listed.","additional-"+platform+"-");else additionalTarget.replaceChildren();}
  };
    const updateReleaseCountdowns = () => {
    document.querySelectorAll("#games-release-list [data-release-date], #games-up-next-ticker [data-release-date]").forEach(node => {
      node.textContent = releaseCountdown(node.dataset.releaseDate);
    });
  };
  const platformHub=document.getElementById("games-platform-hub");
  const platformNames={all:"All platforms",pc:"PC",steam:"Steam",playstation:"PlayStation",xbox:"Xbox",nintendo:"Nintendo"};
  const platformDescriptions={all:"Browse every upcoming full PC and console game release, grouped by month.",pc:"Upcoming full PC game releases, including supported storefronts and launch dates.",steam:"Upcoming full games with a listed Steam release.",playstation:"Upcoming full PlayStation game releases, including PS5 and PS4 titles.",xbox:"Upcoming full Xbox game releases, including Xbox Series titles.",nintendo:"Upcoming full Nintendo game releases across the Switch family."};
  const renderPlatformCalendar=platform=>{
    const value=platform||"all";activePlatform=value;
    const heading=document.getElementById("games-platform-calendar-title"),description=document.getElementById("games-platform-calendar-description"),releaseHeading=document.getElementById("games-platform-release-heading"),status=document.getElementById("games-platform-data-status");
    if(heading)heading.textContent=platformNames[value]+" releases.";if(description)description.textContent=platformDescriptions[value]||platformDescriptions.all;if(releaseHeading)releaseHeading.textContent="Upcoming full game releases";
    if(status)status.textContent=document.getElementById("games-data-status")?.textContent||"Loading platform releases…";
    renderUpcomingReleases(allUpcomingGames,{target:document.getElementById("games-platform-release-list"),platform:value,additionalTarget:document.getElementById("games-platform-additional-list"),additionalDetails:document.getElementById("games-platform-additional-details"),additionalCount:document.getElementById("games-platform-additional-count"),fullCount:document.getElementById("games-platform-release-count")});
  };
  const openPlatformPage=value=>{currentPlatformPage=value||"all";renderPlatformCalendar(currentPlatformPage);window.showScreen?.("games-platform-calendar-screen");};
  platformHub?.addEventListener("click",event=>{const button=event.target.closest("button[data-games-platform]");if(!button||!platformHub.contains(button))return;openPlatformPage(button.dataset.gamesPlatform);});
  document.getElementById("games-platform-back")?.addEventListener("click",()=>{currentPlatformPage=null;activePlatform="all";renderUpcomingReleases(allUpcomingGames);window.showScreen?.("games-calendar-screen");});
  if (featuredTicker) {
    const pauseTickerForManualScroll = () => featuredTicker.classList.add("is-paused");
    const resumeTickerAfterManualScroll = () => featuredTicker.classList.remove("is-paused");
    featuredTicker.addEventListener("pointerdown",pauseTickerForManualScroll,{passive:true});
    featuredTicker.addEventListener("pointerup",resumeTickerAfterManualScroll,{passive:true});
    featuredTicker.addEventListener("pointercancel",resumeTickerAfterManualScroll,{passive:true});
    featuredTicker.addEventListener("touchstart",pauseTickerForManualScroll,{passive:true});
    featuredTicker.addEventListener("touchend",resumeTickerAfterManualScroll,{passive:true});
    featuredTicker.addEventListener("touchcancel",resumeTickerAfterManualScroll,{passive:true});
    const SUPABASE_URL = "https://dyulhgfpbnyotxjstwcq.supabase.co";
    const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_8oB9tn7Y86fsAIzLvi1aYg_jHjhlq_8";
    const gamesDataStatus = document.getElementById("games-data-status");
    const setGamesDataStatus = message => { if (gamesDataStatus) gamesDataStatus.textContent = message; };
    const mapDatabaseReleases = rows => {
      const games = new Map();
      rows.forEach(row => {
        if (!row.game || !row.game_id || !row.platform?.name || !row.release_date) return;
        let game = games.get(row.game_id);
        if (!game) {
          game = {id:row.game.slug,title:row.game.title,developer:row.game.developer,publisher:row.game.publisher,
            artwork_url:row.game.artwork_url,logo_url:row.game.logo_url,platforms:[],release_dates:[],
            release_date:row.release_date,release_date_precision:row.date_precision === "exact" ? "day" : row.date_precision,
            release_status:row.is_estimated || row.verification_status !== "verified" ? "estimated" : "confirmed",
            verification_status:row.verification_status,source_url:row.source_url || "",short_name:row.game.title};
          games.set(row.game_id,game);
        }
        if (!game.platforms.includes(row.platform.name)) game.platforms.push(row.platform.name);
        game.release_dates.push({platform:row.platform.name,region:row.region_code,date:row.release_date,
          precision:row.date_precision === "exact" ? "day" : row.date_precision,status:row.release_status,
          verification_status:row.verification_status});
        if (row.release_date < game.release_date) game.release_date = row.release_date;
        if (!game.source_url && row.source_url) game.source_url = row.source_url;
      });
      return [...games.values()].sort((a,b)=>a.release_date.localeCompare(b.release_date));
    };
    const loadGamesFromSupabase = async () => {
      const query = "game_releases?select=game_id,region_code,release_date,date_precision,release_status,is_estimated,verification_status,source_url,game:games!inner(title,slug,developer,publisher,artwork_url,logo_url),platform:platforms!inner(name)&region_code=in.(GB,WW)&release_date=not.is.null&release_status=in.(announced,early_access,delayed)&order=release_date.asc";
      const response = await fetch(SUPABASE_URL + "/rest/v1/" + query,{headers:{apikey:SUPABASE_PUBLISHABLE_KEY,
        Authorization:"Bearer "+SUPABASE_PUBLISHABLE_KEY,Accept:"application/json"},cache:"no-store"});
      if (!response.ok) { const detail=await response.text(); throw new Error("Supabase returned "+response.status+(detail?": "+detail.slice(0,160):"")); }
      const rows=await response.json();
      if (!Array.isArray(rows)) throw new Error("Supabase returned an unexpected release-data response");
      return mapDatabaseReleases(rows);
    };
    const loadGamesPopularity = async () => {
      const response = await fetch("./data/games-popularity.json?t=" + Date.now(), {cache:"no-store"});
      if (!response.ok) return [];
      const data = await response.json();
      return Array.isArray(data.games) ? data.games : [];
    };
    const enrichGameArtwork = (games, popularity) => {
      const norm = value => String(value || "").toLowerCase().replace(/[^a-z0-9]+/g," ").trim();
      const assets = new Map((Array.isArray(popularity) ? popularity : []).map(game => [norm(game.title),game]));
      return (Array.isArray(games) ? games : []).map(game => {
        const asset = assets.get(norm(game.title));
        if (!asset) return game;
        return {
          ...game,
          artwork_url: game.artwork_url || asset.artwork_url || asset.igdb_artwork_url || null,
          logo_url: game.logo_url || asset.logo_url || asset.igdb_logo_url || null
        };
      });
    };
    const loadGamesFallback = async () => {
      const response=await fetch("./data/games-featured.json?t="+Date.now(),{cache:"no-store"});
      if (!response.ok) throw new Error("Saved release feed unavailable");
      const data=await response.json();
      return Array.isArray(data.games)?data.games:[];
    };
    const loadCompanyUpcomingReleases = async () => {
      const response=await fetch("./data/company-profiles.json?t="+Date.now(),{cache:"no-store"});
      if (!response.ok) return [];
      const data=await response.json();
      const today=new Intl.DateTimeFormat("en-CA",{timeZone:"Europe/London",year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date());
      const byGame=new Map();
      (Array.isArray(data.companies)?data.companies:[]).forEach(company=>{
        (Array.isArray(company.releases)?company.releases:[]).forEach(release=>{
          if(!release.title||!/^\d{4}-\d{2}-\d{2}$/.test(String(release.release_date||""))||release.release_date<today)return;
          const key=String(release.title).toLowerCase();
          const existing=byGame.get(key)||{
            id:"igdb-"+(release.igdb_id||key.replace(/[^a-z0-9]+/g,"-")),
            title:release.title,developer:release.developer?company.name:"",publisher:release.publisher?company.name:"",
            release_date:release.release_date,igdb_category:release.igdb_category,category_name:release.category_name,release_type:release.release_type,release_date_precision:/^\d{4}$/.test(String(release.release_label||""))?"year":"day",
            platforms:[],release_dates:[],artwork_url:release.artwork_url||null,logo_url:release.logo_url||null,
            release_status:"announced",verification_status:"estimated",is_estimated:true,source_url:"",short_name:release.title
          };
          existing.platforms=[...new Set([...(existing.platforms||[]),...(release.platforms||[])])];
          (release.platforms||[]).forEach(platform=>existing.release_dates.push({
            platform,region:"WW",date:release.release_date,precision:existing.release_date_precision,
            status:"announced",verification_status:"estimated"
          }));
          if(!existing.artwork_url)existing.artwork_url=release.artwork_url||null;
          byGame.set(key,existing);
        });
      });
      return [...byGame.values()];
    };
    const mergeReleaseFeeds = (live, supplemental, companyUpcoming = []) => {
      const byTitle = new Map();
      (Array.isArray(live) ? live : []).forEach(game => byTitle.set(String(game.title || "").toLowerCase(),{...game}));
      [...(Array.isArray(supplemental) ? supplemental : []),...(Array.isArray(companyUpcoming) ? companyUpcoming : [])].forEach(game => {
        const key = String(game.title || "").toLowerCase();
        if (!key) return;
        const existing = byTitle.get(key);
        if (!existing) { byTitle.set(key,{...game}); return; }
        existing.platforms = [...new Set([...(existing.platforms || []),...(game.platforms || [])])];
        existing.release_dates = [...(existing.release_dates || []),...(game.release_dates || [])]
          .filter((entry,index,array)=>entry && entry.date && array.findIndex(other=>other && other.platform===entry.platform && other.date===entry.date && other.region===entry.region)===index);
        if (!existing.artwork_url) existing.artwork_url = game.artwork_url || null;
        if (!existing.logo_url) existing.logo_url = game.logo_url || null;
        if (!existing.source_url) existing.source_url = game.source_url || "";
        if (existing.verification_status !== "verified" && game.verification_status === "verified") existing.verification_status = "verified";
      });
      return [...byTitle.values()].sort((a,b)=>String(a.release_date || "").localeCompare(String(b.release_date || "")));
    };
    loadGamesFromSupabase().then(async games=>{
      const [supplemental,popularity,companyUpcoming] = await Promise.all([
        loadGamesFallback().catch(()=>[]),
        loadGamesPopularity().catch(()=>[]),
        loadCompanyUpcomingReleases().catch(error=>{console.warn("Company release catalogue unavailable",error);return [];})
      ]);
      allUpcomingGames=enrichGameArtwork(mergeReleaseFeeds(games,supplemental,companyUpcoming),popularity); renderFeaturedGames(allUpcomingGames); renderUpcomingReleases(allUpcomingGames);
      if(currentPlatformPage)renderPlatformCalendar(currentPlatformPage);
      updateReleaseCountdowns(); setGamesDataStatus("LIVE DATABASE + IGDB COMPANY CATALOGUE · Showing tracked and additional announced releases.");
    }).catch(async error=>{
      console.warn("Games Calendar database connection failed; using saved feed.",error);
      try {
        const [saved,popularity,companyUpcoming] = await Promise.all([
          loadGamesFallback(),loadGamesPopularity().catch(()=>[]),
          loadCompanyUpcomingReleases().catch(error=>{console.warn("Company release catalogue unavailable",error);return [];})
        ]);
        allUpcomingGames=enrichGameArtwork(mergeReleaseFeeds([],saved,companyUpcoming),popularity); renderFeaturedGames(allUpcomingGames); renderUpcomingReleases(allUpcomingGames);
        if(currentPlatformPage)renderPlatformCalendar(currentPlatformPage);
        updateReleaseCountdowns(); setGamesDataStatus("DATABASE OFFLINE · Showing saved releases and the IGDB company catalogue.");
      } catch(fallbackError) {
        allUpcomingGames=[]; renderFeaturedGames([]); renderUpcomingReleases([]);
        setGamesDataStatus("RELEASE DATA UNAVAILABLE · The database and saved release feed could not be reached.");
        console.error("Games Calendar release feeds unavailable.",fallbackError);
      }
    });
    window.setInterval(updateReleaseCountdowns, 1000);
  }
  const API_URL = "https://api.github.com/repos/JimmyHZz1/Boxing-Fight-Calendar/pulls?state=closed&sort=updated&direction=desc&per_page=100";
  const CACHE_KEY = "gamesCalendarMergedHistoryV1";
  const CACHE_TTL = 60 * 60 * 1000;
  const isGamesChange = pr => /games/i.test(String(pr.title || "") + " " + (pr.labels || []).map(label => label.name || "").join(" "));
  const formatDate = value => {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? "Date not available" : new Intl.DateTimeFormat("en-GB", {day:"numeric",month:"short",year:"numeric"}).format(date);
  };
  const render = (items, cached = false) => {
    const merged = (Array.isArray(items) ? items : []).filter(pr => pr && pr.merged_at && !pr.draft && isGamesChange(pr)).sort((a,b) => new Date(b.merged_at)-new Date(a.merged_at)).slice(0,12);
    list.replaceChildren();
    if (!merged.length) {
      const empty = document.createElement("div");
      empty.className = "games-empty-state compact";
      const title = document.createElement("h3");
      title.textContent = "No additional merged updates yet";
      const copy = document.createElement("p");
      copy.textContent = "The Games version list will grow independently as Games Calendar work is merged.";
      empty.append(title, copy);
      list.appendChild(empty);
    } else {
      merged.forEach(pr => {
        const article = document.createElement("article");
        article.className = "games-recent-release";
        const meta = document.createElement("div");
        meta.className = "games-release-meta";
        meta.textContent = formatDate(pr.merged_at) + " · PR #" + pr.number;
        const title = document.createElement("h3");
        title.textContent = pr.title || "Games update";
        const summary = document.createElement("p");
        const body = String(pr.body || "").replace(/<!--[\s\S]*?-->/g," ").replace(/https?:\/\/\S+/g,"").replace(/\s+/g," ").trim();
        summary.textContent = body ? (body.length > 220 ? body.slice(0,217).trimEnd()+"…" : body) : "Merged Games Calendar update.";
        const link = document.createElement("a");
        link.href = pr.html_url;
        link.target = "_blank";
        link.rel = "noopener noreferrer";
        link.textContent = "VIEW CHANGE ↗";
        article.append(meta,title,summary,link);
        list.appendChild(article);
      });
    }
    if (status) status.textContent = cached ? "Showing the latest saved Games updates." : "Automatically refreshed from Games-related merged GitHub pull requests.";
  };
  let cachedItems = null;
  try {
    const saved = JSON.parse(localStorage.getItem(CACHE_KEY) || "null");
    if (saved && Array.isArray(saved.items)) {
      cachedItems = saved.items;
      render(cachedItems, true);
      if (Date.now() - Number(saved.savedAt || 0) < CACHE_TTL) return;
    }
  } catch (_) {}
  fetch(API_URL, {headers:{Accept:"application/vnd.github+json"}})
    .then(response => { if (!response.ok) throw new Error("GitHub returned " + response.status); return response.json(); })
    .then(items => {
      render(items);
      try { localStorage.setItem(CACHE_KEY, JSON.stringify({savedAt:Date.now(),items})); } catch (_) {}
    })
    .catch(() => {
      if (cachedItems) render(cachedItems, true);
      else if (status) status.textContent = "Games update history is temporarily unavailable. The Games v1.0 entry remains available below.";
    });
})();
