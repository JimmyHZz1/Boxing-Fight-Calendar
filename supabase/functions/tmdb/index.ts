const ALLOWED_ORIGINS = new Set([
  "https://jimmyhzz1.github.io",
  "http://localhost:8000",
  "http://127.0.0.1:8000"
]);

const corsHeaders = (origin: string) => ({
  "Access-Control-Allow-Origin": ALLOWED_ORIGINS.has(origin) ? origin : "https://jimmyhzz1.github.io",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Vary": "Origin"
});

const json = (body: unknown, status: number, origin: string, cache = "no-store") =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders(origin),
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": cache
    }
  });

const ALLOWED_PATHS = [
  /^\/3\/trending\/(movie|tv)\/(day|week)$/,
  /^\/3\/(movie|tv)\/(popular|top_rated|now_playing|upcoming|airing_today|on_the_air)$/,
  /^\/3\/(movie|tv)\/\d+(\/(credits|videos|watch\/providers|similar|recommendations))?$/,
  /^\/3\/search\/(movie|tv)$/,
  /^\/3\/discover\/(movie|tv)$/
];

const ALLOWED_PARAMS = new Set([
  "language", "page", "region", "query", "include_adult",
  "watch_region", "with_watch_providers", "sort_by", "primary_release_year",
  "first_air_date_year", "with_genres", "append_to_response"
]);

Deno.serve(async (req: Request) => {
  const origin = req.headers.get("origin") ?? "";

  if (req.method === "OPTIONS") {
    if (origin && !ALLOWED_ORIGINS.has(origin)) {
      return new Response("Origin not allowed", { status: 403 });
    }
    return new Response("ok", { headers: corsHeaders(origin) });
  }

  if (req.method !== "GET") {
    return json({ error: "Method not allowed." }, 405, origin);
  }

  if (origin && !ALLOWED_ORIGINS.has(origin)) {
    return json({ error: "Origin not allowed." }, 403, origin);
  }

  const token = Deno.env.get("TMDB_ACCESS_TOKEN");
  if (!token) {
    return json({ error: "TMDB is not configured on the server." }, 503, origin);
  }

  const incoming = new URL(req.url);
  const path = incoming.searchParams.get("path") ?? "";
  if (!ALLOWED_PATHS.some((pattern) => pattern.test(path))) {
    return json({ error: "That TMDB endpoint is not permitted." }, 400, origin);
  }

  const target = new URL("https://api.themoviedb.org" + path);
  for (const [key, value] of incoming.searchParams.entries()) {
    if (key === "path") continue;
    if (!ALLOWED_PARAMS.has(key)) {
      return json({ error: "Unsupported TMDB query parameter." }, 400, origin);
    }
    target.searchParams.set(key, value);
  }

  if (!target.searchParams.has("language")) target.searchParams.set("language", "en-GB");
  if (/^\/3\/(movie|tv)\//.test(path) && !target.searchParams.has("region")) {
    target.searchParams.set("region", "GB");
  }
  if (/^\/3\/(discover|search)\//.test(path) && !target.searchParams.has("watch_region")) {
    target.searchParams.set("watch_region", "GB");
  }

  try {
    const upstream = await fetch(target.toString(), {
      headers: {
        "Authorization": "Bearer " + token,
        "Accept": "application/json"
      }
    });

    const body = await upstream.text();
    if (!upstream.ok) {
      console.error("TMDB request failed", upstream.status, path);
      return json({
        error: upstream.status === 401
          ? "TMDB rejected the saved access token. Check the token in Supabase."
          : "TMDB request failed.",
        upstream_status: upstream.status
      }, upstream.status === 401 ? 502 : upstream.status, origin);
    }

    return new Response(body, {
      status: 200,
      headers: {
        ...corsHeaders(origin),
        "Content-Type": "application/json; charset=utf-8",
        "Cache-Control": "public, max-age=300, s-maxage=300"
      }
    });
  } catch (error) {
    console.error("TMDB proxy request failed", error);
    return json({ error: "Could not reach TMDB. Please try again." }, 502, origin);
  }
});
