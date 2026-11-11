/* Administrator-only GitHub Actions launcher. Browser code contains public Supabase config only. */
(() => {
  "use strict";
  const PROJECT_URL = "https://dyulhgfpbnyotxjstwcq.supabase.co";
  const PUBLIC_KEY = "sb_publishable_8oB9tn7Y86fsAIzLvi1aYg_jHjhlq_8";
  const FUNCTION_URL = PROJECT_URL + "/functions/v1/admin-updates";
  const SESSION_KEY = "sports-calendar-admin-session-v1";
  const REMEMBER_KEY = "sports-calendar-admin-remember-v1";
  let rememberSession = localStorage.getItem(REMEMBER_KEY) === "true";
  const $ = id => document.getElementById(id);
  const form = $("admin-login-form");
  const controls = $("admin-controls");
  if (!form || !controls) return;
  let session = readSession();
  const rememberControl = $("admin-remember-login");
  if (rememberControl) rememberControl.checked = rememberSession;
  const workflows = {
    sports: { label: "Sports schedules", workflow: "sync-fights.yml" },
    darts: { label: "PDC calendar", workflow: "sync-pdc-calendar.yml" },
    images: { label: "Image enrichment", workflow: "enrich-images.yml" },
    games: { label: "Games popularity", workflow: "update-games-popularity.yml" },
    companies: { label: "Game company profiles", workflow: "sync-company-profiles.yml" }
  };
  function readSession() {
    try {
      const primary = rememberSession ? localStorage : sessionStorage;
      const secondary = rememberSession ? sessionStorage : localStorage;
      return JSON.parse(primary.getItem(SESSION_KEY) || secondary.getItem(SESSION_KEY) || "null");
    } catch (_) { return null; }
  }
  function saveSession(value, persist = rememberSession) {
    session = value;
    if (!value) {
      localStorage.removeItem(SESSION_KEY);
      sessionStorage.removeItem(SESSION_KEY);
      return;
    }
    const destination = persist ? localStorage : sessionStorage;
    const other = persist ? sessionStorage : localStorage;
    destination.setItem(SESSION_KEY, JSON.stringify(value));
    other.removeItem(SESSION_KEY);
    rememberSession = persist;
    localStorage.setItem(REMEMBER_KEY, String(persist));
  }
  function setStatus(message, kind = "") {
    const node = $("admin-update-status");
    if (!node) return;
    node.textContent = message;
    node.className = "admin-update-status" + (kind ? " is-" + kind : "");
  }
  function showRunResult(url, metrics, workflow, conclusion) {
    const panel = $("admin-update-result");
    const details = $("admin-update-metrics");
    const link = $("admin-update-run-link");
    if (!panel || !details || !link) return;
    panel.hidden = false;
    link.href = url || "https://github.com/JimmyHZz1/Boxing-Fight-Calendar/actions";
    details.replaceChildren();
    if (workflow === "enrich-images.yml" && metrics) {
      const lines = metrics.batch_count
        ? [
            metrics.batch_count + " batch(es) completed",
            metrics.attempted + " image lookups attempted",
            metrics.found + " new images found",
            metrics.missing + " no-match lookups",
            metrics.cumulative_found == null ? "" : metrics.cumulative_found + " images in the library overall"
          ].filter(Boolean)
        : ["No new batch record was published; the queue may already be empty."];
      lines.forEach(line => {
        const item = document.createElement("div");
        item.textContent = line;
        details.append(item);
      });
      if (metrics.rate_limited) {
        const note = document.createElement("div");
        note.className = "admin-update-warning";
        note.textContent = "Wikimedia Commons rate limit detected. The next scheduled run will retry later.";
        details.append(note);
      }
    } else if (conclusion && conclusion !== "success") {
      const item = document.createElement("div");
      item.textContent = "Workflow result: " + conclusion.replace(/_/g, " ");
      details.append(item);
    }
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
  async function adminRequest(body) {
    const token = await freshAccessToken();
    const response = await fetch(FUNCTION_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", apikey: PUBLIC_KEY, Authorization: "Bearer " + token },
      body: JSON.stringify(body)
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload.error || payload.message || "Update request failed (" + response.status + ").");
    return payload;
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
      rememberSession = $("admin-remember-login")?.checked === true;
      saveSession({ ...result, expires_at: Math.floor(Date.now() / 1000) + Number(result.expires_in || 3600) }, rememberSession);
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
  $("admin-image-batches")?.addEventListener("change", () => setStatus("Image enrichment will process up to " + (Number($("admin-image-batches").value) * 5) + " lookups."));
  function delay(ms) { return new Promise(resolve => setTimeout(resolve, ms)); }
  async function trackWorkflow(config, requestedAt) {
    const deadline = Date.now() + 15 * 60 * 1000;
    let runUrl = null;
    let lastStatus = "";
    while (Date.now() < deadline) {
      await delay(runUrl ? 7000 : 3500);
      const payload = await adminRequest({ action: "status", workflow: config.workflow, since: requestedAt });
      if (!payload.run) {
        setStatus(config.label + " has been queued. Waiting for GitHub to start the run…");
        continue;
      }
      runUrl = payload.run.url;
      if (payload.status !== lastStatus) {
        lastStatus = payload.status;
        setStatus(config.label + (payload.status === "queued" ? " is queued…" : payload.status === "in_progress" ? " is running…" : " has finished checking."));
      }
      if (payload.status === "completed") {
        if (payload.conclusion === "success") {
          if (config.workflow === "enrich-images.yml" && payload.metrics) {
            const m = payload.metrics;
            if (m.batch_count && m.found > 0) {
              setStatus("Image enrichment completed successfully. " + m.found + " new image(s) were added.", "success");
            } else if (m.batch_count) {
              setStatus("Image enrichment completed successfully, but this batch found no new matching images.", "success");
            } else {
              setStatus("Image enrichment completed successfully. No eligible lookups remained in the queue.", "success");
            }
          } else {
            setStatus(config.label + " completed successfully.", "success");
          }
        } else {
          setStatus(config.label + " finished with status: " + (payload.conclusion || "unknown") + ". Open the run for details.", "error");
        }
        showRunResult(runUrl, payload.metrics, config.workflow, payload.conclusion);
        return;
      }
    }
    setStatus(config.label + " is taking longer than expected. You can follow its live progress in GitHub Actions.", "warning");
    showRunResult(runUrl, null, config.workflow, null);
  }
  document.querySelectorAll("[data-admin-workflow]").forEach(button => button.addEventListener("click", async () => {
    const config = workflows[button.dataset.adminWorkflow];
    if (!config) return;
    const imageMode = config.workflow === "enrich-images.yml";
    if (imageMode && !$("admin-image-batch-wrap").hidden) {
      // The chosen batch count is sent with the next click.
    } else if (imageMode) {
      $("admin-image-batch-wrap").hidden = false;
      setStatus("Choose the image batch size, then select Image enrichment again.");
      return;
    }
    const inputs = imageMode ? { batches: $("admin-image-batches").value } : {};
    const previous = button.textContent;
    button.disabled = true;
    document.querySelectorAll("[data-admin-workflow]").forEach(item => { item.disabled = true; });
    $("admin-update-result")?.setAttribute("hidden", "");
    setStatus("Sending " + config.label + " request…");
    try {
      const payload = await adminRequest({ workflow: config.workflow, inputs });
      if (!payload.queued) throw new Error("GitHub did not confirm that the update was queued.");
      setStatus(config.label + " has been accepted by GitHub. Waiting for its result…", "success");
      await trackWorkflow(config, payload.requested_at);
    } catch (error) {
      if (/sign in again|session/i.test(error.message)) { saveSession(null); showSignedOut(); }
      setStatus(error.message, "error");
    } finally {
      button.textContent = previous;
      document.querySelectorAll("[data-admin-workflow]").forEach(item => { item.disabled = false; });
    }
  }));
  $("admin-image-batch-wrap").hidden = true;
  validateSession();
})();