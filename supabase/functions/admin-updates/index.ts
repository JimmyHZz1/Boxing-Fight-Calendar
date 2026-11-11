import { withSupabase } from "npm:@supabase/server";

const REPO = "JimmyHZz1/Boxing-Fight-Calendar";
const ALLOWED_ORIGINS = new Set([
  "https://jimmyhzz1.github.io",
  "http://localhost:8000",
  "http://127.0.0.1:8000"
]);
const WORKFLOWS: Record<string, string> = {
  "sync-fights.yml": "sports",
  "sync-pdc-calendar.yml": "darts",
  "enrich-images.yml": "images",
  "update-games-popularity.yml": "games",
  "sync-company-profiles.yml": "companies"
};

const corsHeaders = (origin: string) => ({
  "Access-Control-Allow-Origin": ALLOWED_ORIGINS.has(origin) ? origin : "https://jimmyhzz1.github.io",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Vary": "Origin"
});
const json = (body: unknown, status: number, origin: string) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders(origin), "Content-Type": "application/json" }
  });

async function githubJson(path: string, token: string) {
  const response = await fetch("https://api.github.com/repos/" + REPO + path, {
    headers: {
      "Accept": "application/vnd.github+json",
      "Authorization": "Bearer " + token,
      "X-GitHub-Api-Version": "2022-11-28"
    }
  });
  const body = await response.text();
  if (!response.ok) throw new Error("GitHub status lookup failed (HTTP " + response.status + ").");
  return JSON.parse(body);
}

async function findDispatchedRun(workflow: string, since: string, token: string) {
  const data = await githubJson(
    "/actions/workflows/" + encodeURIComponent(workflow) + "/runs?event=workflow_dispatch&per_page=10",
    token
  );
  const cutoff = Date.parse(since) - 20000;
  return (data.workflow_runs ?? [])
    .filter((run: any) => run.event === "workflow_dispatch" &&
      run.head_branch === "main" && Date.parse(run.created_at) >= cutoff)
    .sort((a: any, b: any) => Date.parse(b.created_at) - Date.parse(a.created_at))[0] ?? null;
}

async function imageBatchMetrics(run: any) {
  try {
    const response = await fetch(
      "https://raw.githubusercontent.com/" + REPO + "/main/data/sports-images.json?status_run=" + run.id,
      { headers: { "Cache-Control": "no-cache" } }
    );
    if (!response.ok) return null;
    const payload = await response.json();
    const enrichment = payload.enrichment ?? {};
    const cutoff = Date.parse(run.created_at) - 5000;
    const batches = (enrichment.history ?? []).filter((batch: any) =>
      Date.parse(batch.at) >= cutoff
    );
    if (!batches.length) return {
      batches: [],
      batch_count: 0,
      attempted: 0,
      found: 0,
      missing: 0,
      rate_limited: false,
      cumulative_found: enrichment.cumulative_found ?? null
    };
    return {
      batches,
      batch_count: batches.length,
      attempted: batches.reduce((sum: number, batch: any) => sum + Number(batch.attempted || 0), 0),
      found: batches.reduce((sum: number, batch: any) => sum + Number(batch.found || 0), 0),
      missing: batches.reduce((sum: number, batch: any) => sum + Number(batch.missing || 0), 0),
      rate_limited: batches.some((batch: any) => batch.rate_limited === true),
      cumulative_found: enrichment.cumulative_found ?? null,
      cumulative_attempted: enrichment.cumulative_attempted ?? null,
      batch_number: enrichment.batch_number ?? null
    };
  } catch (error) {
    console.warn("Could not read image enrichment metrics", error);
    return null;
  }
}

const authenticatedHandler = withSupabase({ auth: "user" }, async (req, ctx) => {
  const origin = req.headers.get("origin") ?? "";
  if (!ALLOWED_ORIGINS.has(origin)) return json({ error: "Origin not allowed." }, 403, origin);
  if (req.method !== "POST") return json({ error: "Method not allowed." }, 405, origin);

  const email = String(ctx.userClaims?.email ?? "").trim().toLowerCase();
  const admins = (Deno.env.get("ADMIN_EMAILS") ?? "")
    .split(",").map(value => value.trim().toLowerCase()).filter(Boolean);
  if (!email || !admins.includes(email)) {
    return json({ error: "This account is not authorised to run updates." }, 403, origin);
  }

  const githubToken = Deno.env.get("GITHUB_ACTIONS_TOKEN");
  if (!githubToken) {
    return json({ error: "The server is missing its GitHub Actions credential. Contact the site administrator." }, 503, origin);
  }

  let body: { action?: string; workflow?: string; inputs?: Record<string, unknown>; since?: string };
  try {
    body = await req.json();
  } catch {
    return json({ error: "Invalid request body." }, 400, origin);
  }

  const workflow = String(body.workflow ?? "");
  if (!Object.hasOwn(WORKFLOWS, workflow)) {
    return json({ error: "That update workflow is not permitted." }, 400, origin);
  }

  if (body.action === "status") {
    const since = String(body.since ?? "");
    const sinceMs = Date.parse(since);
    if (!Number.isFinite(sinceMs) || sinceMs > Date.now() + 60000 || Date.now() - sinceMs > 30 * 60 * 1000) {
      return json({ error: "The update tracking window has expired. Open the workflow runs for the latest result." }, 400, origin);
    }
    try {
      const run = await findDispatchedRun(workflow, since, githubToken);
      if (!run) return json({ ok: true, workflow, status: "starting", run: null }, 200, origin);
      const metrics = workflow === "enrich-images.yml" && run.status === "completed"
        ? await imageBatchMetrics(run) : null;
      return json({
        ok: true,
        workflow,
        status: run.status,
        conclusion: run.conclusion,
        run: {
          id: run.id,
          number: run.run_number,
          url: run.html_url,
          created_at: run.created_at,
          updated_at: run.updated_at
        },
        metrics
      }, 200, origin);
    } catch (error) {
      console.error("GitHub workflow status lookup failed", error);
      return json({ error: error instanceof Error ? error.message : "Could not retrieve workflow status." }, 502, origin);
    }
  }

  const inputs: Record<string, string> = {};
  if (workflow === "enrich-images.yml") {
    const batches = String(body.inputs?.batches ?? "6");
    if (!["1", "3", "6", "10"].includes(batches)) {
      return json({ error: "Choose a supported image batch size." }, 400, origin);
    }
    inputs.batches = batches;
  } else if (body.inputs && Object.keys(body.inputs).length) {
    return json({ error: "This workflow does not accept custom inputs." }, 400, origin);
  }

  const requestedAt = new Date().toISOString();
  const response = await fetch(
    "https://api.github.com/repos/" + REPO + "/actions/workflows/" + encodeURIComponent(workflow) + "/dispatches",
    {
      method: "POST",
      headers: {
        "Accept": "application/vnd.github+json",
        "Authorization": "Bearer " + githubToken,
        "X-GitHub-Api-Version": "2022-11-28",
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ ref: "main", inputs })
    }
  );

  if (response.status !== 204) {
    const details = await response.text();
    console.error("GitHub workflow dispatch failed", response.status, details.slice(0, 500));
    return json({
      error: "GitHub could not queue that update (HTTP " + response.status + "). Check the GitHub token permissions and workflow configuration."
    }, 502, origin);
  }

  let run = null;
  try { run = await findDispatchedRun(workflow, requestedAt, githubToken); }
  catch (error) { console.warn("Update queued, but the run ID is not available yet", error); }
  return json({
    ok: true,
    workflow,
    category: WORKFLOWS[workflow],
    queued: true,
    requested_at: requestedAt,
    run: run ? { id: run.id, number: run.run_number, url: run.html_url, status: run.status } : null
  }, 200, origin);
});

Deno.serve((req: Request) => {
  const origin = req.headers.get("origin") ?? "";
  if (req.method === "OPTIONS") {
    if (!ALLOWED_ORIGINS.has(origin)) return new Response("Origin not allowed", { status: 403 });
    return new Response("ok", { headers: corsHeaders(origin) });
  }
  return authenticatedHandler(req);
});
