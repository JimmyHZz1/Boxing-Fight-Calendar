/* Cross-platform popularity ordering and resilient Games Calendar release-card layout. */
(() => {
  const ticker = document.getElementById("games-up-next-ticker");
  const releaseList = document.getElementById("games-release-list");
  if (!ticker && !releaseList) return;

  const normalise = value => String(value || "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
  let popularity = new Map();
  let imageAssets = new Map();
  let popularityReady = false;
  let isApplyingTicker = false;
  let applyQueued = false;
  let tickerObserver = null;

  const injectLayoutStyles = () => {
    if (document.getElementById("games-popularity-layout-styles")) return;
    const style = document.createElement("style");
    style.id = "games-popularity-layout-styles";
    style.textContent = `
      .games-release-card{display:grid!important;grid-template-columns:62px minmax(0,1fr)!important;grid-template-rows:auto!important;align-items:stretch!important;gap:0 13px!important}
      .games-release-artwork{grid-column:1!important;grid-row:1!important;align-self:stretch!important;width:62px!important;height:100%!important;min-height:82px!important}
      .games-release-copy{grid-column:2!important;grid-row:1!important;display:flex!important;flex-direction:column!important;justify-content:center!important;align-items:flex-start!important;gap:5px!important;min-width:0!important}
      .games-release-copy .games-release-date,.games-release-copy .games-release-details,.games-release-copy .games-release-source{grid-column:auto!important;min-width:0!important}
      .games-release-copy .games-release-details h3{overflow-wrap:anywhere}
      .games-release-copy .games-release-details p{line-height:1.45}
      .games-release-copy .games-release-source{align-self:flex-start!important}
      .games-up-next-label .games-popularity-caption{color:#8fc1ff;font-size:8px;font-weight:900;letter-spacing:.8px;text-align:right}
      .next-event-ticker.is-auto-scrolling.games-up-next-ticker .games-up-next-item{display:flex!important;flex-direction:row!important;align-items:center!important;justify-content:flex-start!important;gap:10px!important;min-height:82px!important;padding:10px 12px!important;white-space:normal!important}
      .games-up-next-ticker .games-up-next-logo{order:0!important;flex:0 0 52px!important;width:52px!important;height:52px!important;min-width:52px!important;max-width:52px!important;display:flex!important;align-items:center!important;justify-content:center!important;padding:0!important;margin:0!important;border:0!important;background:transparent!important;overflow:hidden}
      .games-up-next-ticker .games-up-next-logo img,.games-up-next-ticker .games-up-next-logo-image{display:block!important;width:100%!important;height:100%!important;max-width:100%!important;max-height:100%!important;object-fit:contain!important;padding:2px!important}
      .games-up-next-ticker .games-up-next-logo-text,.games-up-next-ticker .games-up-next-logo-fallback{font-size:12px!important;font-weight:900!important;color:#9bcaff!important;text-align:center}
      .games-up-next-ticker .next-event-info{order:1!important;flex:1 1 auto!important;width:auto!important;min-width:0!important;display:grid!important;gap:4px!important}
      .games-up-next-ticker .next-event-name{display:block!important;white-space:normal!important;overflow-wrap:anywhere!important}
      .games-up-next-ticker .games-trending-rank{display:inline-block;margin-left:5px;padding:2px 4px;border:1px solid rgba(38,133,232,.35);color:#9bcaff;font-size:7px;letter-spacing:.5px;vertical-align:middle}
      @media(max-width:620px){.games-release-card{grid-template-columns:54px minmax(0,1fr)!important;gap:0 10px!important;padding:11px!important}.games-release-artwork{width:54px!important;min-height:76px!important}.games-release-copy .games-release-details h3{font-size:16px!important}.games-release-copy .games-release-date{font-size:11px!important}}
    `;
    document.head.append(style);
  };

  const enhanceReleaseCards = () => {
    if (!releaseList) return;
    releaseList.querySelectorAll(".games-release-card").forEach(card => {
      if (card.querySelector(".games-release-copy")) return;
      const artwork = card.querySelector(".games-release-artwork");
      if (!artwork) return;
      const copy = document.createElement("div");
      copy.className = "games-release-copy";
      [...card.children].forEach(child => {
        if (child !== artwork) copy.append(child);
      });
      card.replaceChildren(artwork, copy);
    });
  };

  const applyArtworkFallbacks = () => {
    const addImage = (container, title, asset, isTicker) => {
      if (!container || container.dataset.imageFallbackFailed === "true") return;
      const candidates = [...new Set((isTicker
        ? [asset.logo_url,asset.artwork_url]
        : [asset.artwork_url,asset.logo_url]).filter(url=>typeof url==="string"&&url.startsWith("https://")))];
      if (!candidates.length) return;
      const current = container.querySelector("img");
      if (current && current.complete && current.naturalWidth > 0) return;
      const fallbackText = container.dataset.fallbackText || container.textContent || title.slice(0,3).toUpperCase();
      container.dataset.fallbackText = fallbackText;
      const image = document.createElement("img");
      image.alt = title + (isTicker ? " logo" : " artwork");
      image.referrerPolicy = "no-referrer";
      image.loading = "eager";
      image.decoding = "async";
      if (isTicker) image.className = "games-up-next-logo-image";
      else {
        image.className = "games-release-artwork-image";
        image.dataset.imageType = asset.artwork_url ? "artwork" : "logo";
      }
      let candidateIndex = 0;
      image.onerror = () => {
        candidateIndex++;
        if (candidateIndex < candidates.length) image.src = candidates[candidateIndex];
        else {
          image.remove();
          container.dataset.imageFallbackFailed = "true";
          if (!container.querySelector("img")) container.textContent = fallbackText;
        }
      };
      image.src = candidates[candidateIndex];
      container.replaceChildren(image);
    };
    releaseList?.querySelectorAll(".games-release-card").forEach(card => {
      const title = card.querySelector(".games-release-details h3")?.textContent || "";
      const asset = imageAssets.get(normalise(title));
      if (asset) addImage(card.querySelector(".games-release-artwork"),title,asset,false);
    });
    ticker?.querySelectorAll(".games-up-next-item").forEach(item => {
      const title = item.querySelector(".next-event-name")?.textContent || "";
      const asset = imageAssets.get(normalise(title));
      if (asset) addImage(item.querySelector(".games-up-next-logo"),title,asset,true);
    });
  };

  const applyTicker = () => {
    if (!ticker || isApplyingTicker || !popularityReady) return;
    const track = ticker.querySelector(".next-event-track");
    const group = track?.querySelector(".next-event-group:not([data-ticker-clone])");
    if (!track || !group || !group.children.length) return;
    isApplyingTicker = true;
    tickerObserver?.disconnect();
    track.querySelectorAll("[data-ticker-clone]").forEach(clone => clone.remove());
    const items = [...group.children];
    items.sort((a,b) => {
      const aTitle = normalise(a.querySelector(".next-event-name")?.textContent);
      const bTitle = normalise(b.querySelector(".next-event-name")?.textContent);
      const aScore = popularity.get(aTitle)?.score;
      const bScore = popularity.get(bTitle)?.score;
      const aHas = Number.isFinite(aScore);
      const bHas = Number.isFinite(bScore);
      if (aHas && bHas && aScore !== bScore) return bScore - aScore;
      if (aHas !== bHas) return aHas ? -1 : 1;
      const aDate = a.querySelector("[data-release-date]")?.dataset.releaseDate || "";
      const bDate = b.querySelector("[data-release-date]")?.dataset.releaseDate || "";
      return aDate.localeCompare(bDate);
    });
    const topFour = items.slice(0,4);
    group.replaceChildren(...topFour);
    topFour.forEach((item,index) => {
      const title = normalise(item.querySelector(".next-event-name")?.textContent);
      const score = popularity.get(title);
      const label = item.querySelector(".next-event-sport");
      const name = item.querySelector(".next-event-name");
      if (label) {
        const original = label.textContent.includes("VERIFIED") ? "GAMES · VERIFIED" :
          label.textContent.includes("ESTIMATED") ? "GAMES · ESTIMATED" : "GAMES";
        label.textContent = score ? original + " · TRENDING #" + (score.rank || index+1) : original + " · POPULARITY PENDING";
      }
      if (score && name) name.title = "Cross-platform popularity score " + score.score + "/100 · " + (score.signals || []).join(", ");
    });
    const groupWidth = group.getBoundingClientRect().width || group.scrollWidth;
    const groupGap = parseFloat(getComputedStyle(group).columnGap || getComputedStyle(group).gap) || 0;
    const loopDistance = groupWidth + groupGap;
    if (loopDistance) {
      track.style.setProperty("--ticker-distance", loopDistance + "px");
      track.style.setProperty("--ticker-offset", "-" + loopDistance + "px");
      track.style.setProperty("--ticker-duration", Math.max(14, loopDistance / 38) + "s");
    }
    if (topFour.length) {
      const clone = group.cloneNode(true);
      clone.dataset.tickerClone = "true";
      clone.setAttribute("aria-hidden","true");
      clone.querySelectorAll("a,button").forEach(node=>{node.tabIndex=-1;});
      track.append(clone);
      if (topFour.length < 3) {
        const secondClone = group.cloneNode(true);
        secondClone.dataset.tickerClone = "true";
        secondClone.setAttribute("aria-hidden","true");
        secondClone.querySelectorAll("a,button").forEach(node=>{node.tabIndex=-1;});
        track.append(secondClone);
      }
    }
    const caption = document.querySelector(".games-up-next-label>span:last-child");
    if (caption) { caption.textContent = popularity.size ? "TOP 4 · IGDB CROSS-PLATFORM TRENDING" : "TOP 4 UPCOMING · POPULARITY DATA PENDING"; caption.title = "Popularity source: IGDB PopScore. Steam-only signals are excluded; the score ranks games in this upcoming release list, not the entire games market."; }
    ticker.classList.add("is-auto-scrolling");
    isApplyingTicker = false;
    tickerObserver?.observe(ticker,{childList:true,subtree:true});
  };

  const queueApply = () => {
    if (applyQueued) return;
    applyQueued = true;
    requestAnimationFrame(() => {
      applyQueued = false;
      injectLayoutStyles();
      enhanceReleaseCards();
      applyArtworkFallbacks();
      applyTicker();
    });
  };

  injectLayoutStyles();
  enhanceReleaseCards();
  if (ticker) {
    tickerObserver = new MutationObserver(queueApply);
    tickerObserver.observe(ticker,{childList:true,subtree:true});
    ticker.addEventListener("load",queueApply,true);
  }
  if (releaseList) {
    const observer = new MutationObserver(queueApply);
    observer.observe(releaseList,{childList:true,subtree:true});
  }

  fetch("./data/games-popularity.json?updated=" + Date.now(),{cache:"no-store"})
    .then(response => {if(!response.ok)throw new Error("Popularity snapshot unavailable");return response.json();})
    .then(data => {
      (Array.isArray(data.games)?data.games:[]).forEach(game => {
        if (!game.title) return;
        if (game.artwork_url || game.logo_url) imageAssets.set(normalise(game.title),{artwork_url:game.artwork_url||null,logo_url:game.logo_url||null});
        if (game.popularity_score === null || game.popularity_score === undefined || !Number.isFinite(Number(game.popularity_score))) return;
        popularity.set(normalise(game.title),{
          score:Number(game.popularity_score),
          rank:Number(game.popularity_rank)||null,
          signals:Array.isArray(game.popularity_signals)?game.popularity_signals:[]
        });
      });
      popularityReady = true;
      queueApply();
    })
    .catch(error => {
      console.info("Games Calendar popularity data is not ready yet.",error);
      popularityReady = true;
      queueApply();
    });
})();
