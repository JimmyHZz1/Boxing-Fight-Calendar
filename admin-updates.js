/* Administrator-only GitHub Actions launcher. Browser code contains public Supabase config only. */
(() => {
  "use strict";
  const PROJECT_URL = "https://dyulhgfpbnyotxjstwcq.supabase.co";
  const PUBLIC_KEY = "sb_publishable_8oB9tn7Y86fsAIzLvi1aYg_jHjhlq_8";
  const FUNCTION_URL = PROJECT_URL + "/functions/v1/admin-updates";
  const SESSION_KEY = "sports-calendar-admin-session-v1";
  const $ = id => document.getElementById(id);
  const form = $("admin-login-form");
  const controls = $("admin-controls");
  if (!form || !controls) return;
  let session = readSession();
  const workflows = {
    sports: { label: "Sports schedules", workflow: "sync-fights.yml" },
    darts: { label: "PDC calendar", workflow: "sync-pdc-calendar.yml" },
    images: { label: "Image enrichment", workflow: "enrich-images.yml" },
    games: { label: "Games popularity", workflow: "update-games-popularity.yml" },
    companies: { label: "Game company profiles", workflow: "sync-company-profiles.yml" }
  };
  function readSession() { try { return JSON.parse(sessionStorage.getItem(SESSION_KEY) || "null"); } catch (_) { return null; } }
  function saveSession(value) { session = value; if (value) sessionStorage.setItem(SESSION_KEY, JSON.stringify(value)); else sessionStorage.removeItem(SESSION_KEY); }
  function setStatus(message, kind = "") {
    const node = $("admin-update-status");
    if (!node) return;
    node.textContent = message;
    node.className = "admin-update-status" + (kind ? " is-" + kind : "");
  }
  function setLoginStatus(message, kind = "") {
    const node = $("admin-login-status");
    if (node) { node.textContent = message; node.className = kind ? "is-" + kind : ""; }
  }
  async function authFetch(path, options = {}, token) {
    const headers = { apikey: PUBLIC_KEY, ...(options.headers || {}) };
    if (token) headers.Authorization = "Bearer " + token;
    const response = await fetch(PROJECT_URL + path, { ...options, headers });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload.msg || payload.message || payload.error_description || payload.error || "Authentication request failed (" + response.status + ").");
    return payload;
  }
  async function freshAccessToken() {
    if (!session?.access_token) throw new Error("Please sign in again.");
    if (session.expires_at && session.expires_at > Math.floor(Date.now() / 1000) + 60) return session.access_token;
    if (!session.refresh_token) throw new Error("Your session has expired. Please sign in again.");
    const refreshed = await authFetch("/auth/v1/token?grant_type=refresh_token", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refresh_token: session.refresh_token })
    });
    saveSession({ ...refreshed, expires_at: Math.floor(Date.now() / 1000) + Number(refreshed.expires_in || 3600) });
    return session.access_token;
  }
  function showSignedIn(email) {
    form.hidden = true;
    controls.hidden = false;
    $("admin-auth-state").textContent = "SIGNED IN";
    $("admin-auth-state").classList.add("is-authenticated");
    $("admin-signed-in-as").textContent = email || "Authenticated administrator";
  }
  function showSignedOut() {
    form.hidden = false;
    controls.hidden = true;
    $("admin-auth-state").textContent = "SIGN IN REQUIRED";
    $("admin-auth-state").classList.remove("is-authenticated");
  }
  async function validateSession() {
    if (!session?.access_token) { showSignedOut(); return; }
    try {
      const token = await freshAccessToken();
      const user = await authFetch("/auth/v1/user", {}, token);
      showSignedIn(user.email);
    } catch (_) { saveSession(null); showSignedOut(); }
  }
  form.addEventListener("submit", async event => {
    event.preventDefault();
    const button = $("admin-login-button");
    button.disabled = true;
    setLoginStatus("Signing in…");
    try {
      const result = await authFetch("/auth/v1/token?grant_type=password", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: $("admin-email").value.trim(), password: $("admin-password").value })
      });
      saveSession({ ...result, expires_at: Math.floor(Date.now() / 1000) + Number(result.expires_in || 3600) });
      const user = await authFetch("/auth/v1/user", {}, session.access_token);
      showSignedIn(user.email);
      $("admin-password").value = "";
      setLoginStatus("");
      setStatus("Signed in. Choose an update pipeline when you are ready.");
    } catch (error) {
      saveSession(null);
      setLoginStatus(error.message, "error");
    } finally { button.disabled = false; }
  });
  $("admin-sign-out")?.addEventListener("click", async () => {
    try { if (session?.access_token) await authFetch("/auth/v1/logout", { method: "POST" }, session.access_token); } catch (_) {}
    saveSession(null);
    showSignedOut();
    setStatus("You have signed out.");
  });
  $("admin-image-batches")?.addEventListener("change", () => setStatus("Image enrichment will process " + (Number($("admin-image-batches").value) * 5) + " lookups at most."));
  document.querySelectorAll("[data-admin-workflow]").forEach(button => button.addEventListener("click", async () => {
    const config = workflows[button.dataset.adminWorkflow];
    if (!config) return;
    const imageMode = config.workflow === "enrich-images.yml";
    if (imageMode && !$("admin-image-batch-wrap").hidden) {
      // Selection is intentional; the button click below starts the chosen batch count.
    } else if (imageMode) {
      $("admin-image-batch-wrap").hidden = false;
      setStatus("Choose the image batch size, then select Image enrichment again.");
      return;
    }
    const inputs = imageMode ? { batches: $("admin-image-batches").value } : {};
    const previous = button.textContent;
    button.disabled = true;
    setStatus("Requesting " + config.label + " update…");
    try {
      const token = await freshAccessToken();
      const response = await fetch(FUNCTION_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json", apikey: PUBLIC_KEY, Authorization: "Bearer " + token },
        body: JSON.stringify({ workflow: config.workflow, inputs })
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || payload.message || "Update request failed (" + response.status + ").");
      setStatus(config.label + " has been queued successfully. It may take a few minutes to finish; check the workflow runs for its progress.", "success");
    } catch (error) {
      if (/sign in again|session/i.test(error.message)) { saveSession(null); showSignedOut(); }
      setStatus(error.message, "error");
    } finally { button.disabled = false; button.textContent = previous; }
  }));
  $("admin-image-batch-wrap").hidden = true;
  validateSession();
})();