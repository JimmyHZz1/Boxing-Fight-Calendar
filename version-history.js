/* Populate Version History from merged pull requests. */
(() => {
  const list = document.getElementById("recent-release-list");
  const status = document.getElementById("recent-release-status");
  if (!list) return;

  const CACHE_KEY = "sportsCalendarMergedHistoryV1";
  const CACHE_TTL = 60 * 60 * 1000;
  const API_URL = "https://api.github.com/repos/JimmyHZz1/Boxing-Fight-Calendar/pulls?state=closed&sort=updated&direction=desc&per_page=100";

  function classify(pr) {
    const labels = (pr.labels || []).map(label => String(label.name || "").toLowerCase());
    const title = String(pr.title || "").toLowerCase();
    const labelText = labels.join(" ");
    if (/bug|fix|regression|hotfix/.test(labelText) || /^(fix|bugfix|hotfix)(\(|:|\s)/.test(title)) return "Fix";
    if (/feature|enhancement/.test(labelText) || /^(feat|feature)(\(|:|\s)/.test(title)) return "Feature";
    if (/improvement|maintenance|performance|ui/.test(labelText) || /^(improve|update|refactor|chore)(\(|:|\s)/.test(title)) return "Improvement";
    return "Update";
  }

  function cleanSummary(body, title) {
    const text = String(body || "")
      .replace(/<!--[\s\S]*?-->/g, " ")
      .replace(/^\s*#+\s*/gm, "")
      .replace(/^\s*[-*+]\s+/gm, "")
      .replace(/\[(.*?)\]\((https?:\/\/[^)]+)\)/g, "$1")
      .replace(/https?:\/\/\S+/g, "")
      .replace(/\s+/g, " ")
      .trim();
    if (!text) return "Merged into the main branch.";
    const first = text.split(/(?<=[.!?])\s+/)[0] || text;
    return first.length > 190 ? first.slice(0, 187).trimEnd() + "…" : first;
  }

  function formatDate(value) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "Date not available";
    return new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric" }).format(date);
  }

  function render(pullRequests, cached = false) {
    const merged = (Array.isArray(pullRequests) ? pullRequests : [])
      .filter(pr => pr && pr.merged_at && !pr.draft)
      .sort((a, b) => new Date(b.merged_at) - new Date(a.merged_at))
      .slice(0, 12);

    list.replaceChildren();
    if (!merged.length) {
      const empty = document.createElement("p");
      empty.className = "sport-hub-loading";
      empty.textContent = "No merged feature or fix pull requests have been found yet.";
      list.appendChild(empty);
    } else {
      merged.forEach(pr => {
        const article = document.createElement("article");
        article.className = "recent-release-item";
        const main = document.createElement("div");
        main.className = "recent-release-item-main";
        const meta = document.createElement("div");
        meta.className = "recent-release-meta";
        const type = document.createElement("span");
        type.className = "recent-release-type";
        type.textContent = classify(pr);
        const date = document.createElement("time");
        date.dateTime = pr.merged_at;
        date.textContent = formatDate(pr.merged_at);
        const number = document.createElement("span");
        number.textContent = "PR #" + pr.number;
        meta.append(type, date, number);
        const title = document.createElement("h4");
        title.textContent = pr.title || "Merged update";
        const summary = document.createElement("p");
        summary.textContent = cleanSummary(pr.body, pr.title);
        main.append(meta, title, summary);
        const link = document.createElement("a");
        link.className = "recent-release-link";
        link.href = pr.html_url;
        link.target = "_blank";
        link.rel = "noopener noreferrer";
        link.textContent = "VIEW CHANGE ↗";
        article.append(main, link);
        list.appendChild(article);
      });
    }
    if (status) status.textContent = cached
      ? "Showing the latest saved update list. It will refresh automatically when GitHub is reachable."
      : "Automatically refreshed from merged GitHub pull requests.";
  }

  let cachedData = null;
  try {
    const saved = JSON.parse(localStorage.getItem(CACHE_KEY) || "null");
    if (saved && Array.isArray(saved.items)) {
      cachedData = saved.items;
      if (Date.now() - Number(saved.savedAt || 0) < CACHE_TTL) {
        render(cachedData, true);
        return;
      }
      render(cachedData, true);
    }
  } catch (_) {}

  fetch(API_URL, { headers: { Accept: "application/vnd.github+json" } })
    .then(response => {
      if (!response.ok) throw new Error("GitHub returned " + response.status);
      return response.json();
    })
    .then(items => {
      const merged = items.filter(pr => pr && pr.merged_at && !pr.draft);
      render(merged);
      try { localStorage.setItem(CACHE_KEY, JSON.stringify({ savedAt: Date.now(), items: merged })); } catch (_) {}
    })
    .catch(() => {
      if (cachedData) render(cachedData, true);
      else {
        const message = document.createElement("p");
        message.className = "sport-hub-loading";
        message.textContent = "The live update feed is temporarily unavailable. The release history below is still available.";
        list.replaceChildren(message);
        if (status) status.textContent = "Could not refresh the GitHub update feed.";
      }
    });
})();
