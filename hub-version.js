/* The Hub platform roadmap navigation. */
(() => {
  const open = document.getElementById("open-hub-version-history");
  const back = document.getElementById("hub-version-history-back");
  if (open) open.addEventListener("click", () => window.showScreen?.("hub-version-history-screen"));
  if (back) back.addEventListener("click", () => window.showScreen?.("home-screen"));
})();
