import { createSupabaseContext } from "npm:@supabase/server";

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
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders(origin), "Content-Type": "application/json" } });

Deno.serve(async (req: Request) => {
  const origin = req.headers.get("origin") ?? "";
  if (req.method === "OPTIONS") {
    if (!ALLOWED_ORIGINS.has(origin)) return new Response("Origin not allowed", { status: 403 });
    return new Response("ok", { headers: corsHeaders(origin) });
  }
  if (req.method !== "POST") return json({ error: "Method not allowed." }, 405, origin);
  if (!ALLOWED_ORIGINS.has(origin)) return json({ error: "Origin not allowed." }, 403, origin);

  const { data: authContext, error: authError } = await createSupabaseContext(req, { auth: "user" });
  if (authError || !authContext?.userClaims) return json({ error: "Please sign in with the administrator account." }, 401, origin);

  const email = String(authContext.userClaims.email ?? "").trim().toLowerCase();
  const admins = (Deno.env.get("ADMIN_EMAILS") ?? "").split(",").map(value => value.trim().toLowerCase()).filter(Boolean);
  if (!email || !admins.includes(email)) return json({ error: "This account is not authorised to run updates." }, 403, origin);

  const githubToken = Deno.env.get("GITHUB_ACTIONS_TOKEN");
  if (!githubToken) return json({ error: "The server is missing its GitHub Actions credential. Contact the site administrator." }, 503, origin);

  let body: { workflow?: string; inputs?: Record<string, unknown> };
  try { body = await req.json(); } catch { return json({ error: "Invalid request body." }, 400, origin); }
  const workflow = String(body.workflow ?? "");
  if (!Object.hasOwn(WORKFLOWS, workflow)) return json({ error: "That update workflow is not permitted." }, 400, origin);

  const inputs: Record<string, string> = {};
  if (workflow === "enrich-images.yml") {
    const batches = String(body.inputs?.batches ?? "6");
    if (!["1", "3", "6", "10"].includes(batches)) return json({ error: "Choose a supported image batch size." }, 400, origin);
    inputs.batches = batches;
  } else if (body.inputs && Object.keys(body.inputs).length) {
    return json({ error: "This workflow does not accept custom inputs." }, 400, origin);
  }

  const response = await fetch(`https://api.github.com/repos/${REPO}/actions/workflows/${workflow}/dispatches`, {
    method: "POST",
    headers: {
      "Accept": "application/vnd.github+json",
      "Authorization": `Bearer ${githubToken}`,
      "X-GitHub-Api-Version": "2022-11-28",
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ ref: "main", inputs })
  });
  if (response.status !== 204) {
    const details = await response.text();
    console.error("GitHub workflow dispatch failed", response.status, details.slice(0, 500));
    return json({ error: "GitHub could not queue that update (HTTP " + response.status + "). Check the GitHub token permissions and workflow configuration." }, 502, origin);
  }
  return json({ ok: true, workflow, category: WORKFLOWS[workflow], queued: true }, 200, origin);
});