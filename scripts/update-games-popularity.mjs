/**
 * Daily cross-platform popularity snapshot for the Games Calendar.
 * IGDB PopScore IGDB-native signals + Twitch only; Steam-only primitives are excluded.
 */
const SUPABASE_URL = "https://dyulhgfpbnyotxjstwcq.supabase.co";
const SUPABASE_KEY = process.env.SUPABASE_PUBLISHABLE_KEY || "sb_publishable_8oB9tn7Y86fsAIzLvi1aYg_jHjhlq_8";
const IGDB_CLIENT_ID = process.env.IGDB_CLIENT_ID;
const IGDB_CLIENT_SECRET = process.env.IGDB_CLIENT_SECRET;
const OUTPUT = "data/games-popularity.json";
const PLATFORM_ALLOW = /^(pc|playstation|playstation 5|playstation 4|xbox|xbox series x\|s|nintendo switch|nintendo switch 2)$/i;
const WEIGHTS = new Map([
  ["want to play", 0.40],
  ["visits", 0.30],
  ["playing", 0.15],
  ["played", 0.05],
  ["twitch hours watched", 0.10]
]);
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const normalise = value => String(value || "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
const tokenSimilarity = (a, b) => {
  const aa = new Set(normalise(a).split(" ").filter(Boolean));
  const bb = new Set(normalise(b).split(" ").filter(Boolean));
  if (!aa.size || !bb.size) return 0;
  const overlap = [...aa].filter(token => bb.has(token)).length;
  return overlap / new Set([...aa, ...bb]).size;
};
async function checkedFetch(url, options = {}) {
  const response = await fetch(url, options);
  if (!response.ok) throw new Error(`${response.status} ${response.statusText}: ${(await response.text()).slice(0, 300)}`);
  return response;
}
async function igdbPost(endpoint, token, body) {
  const response = await checkedFetch(`https://api.igdb.com/v4/${endpoint}`, {
    method: "POST",
    headers: {
      "Client-ID": IGDB_CLIENT_ID,
      "Authorization": `Bearer ${token}`,
      "Accept": "application/json",
      "Content-Type": "text/plain"
    },
    body
  });
  return response.json();
}
async function main() {
  if (!SUPABASE_KEY) throw new Error("Missing SUPABASE_PUBLISHABLE_KEY.");
  if (!IGDB_CLIENT_ID || !IGDB_CLIENT_SECRET) throw new Error("Missing IGDB_CLIENT_ID or IGDB_CLIENT_SECRET GitHub Actions secrets.");
  const today = new Intl.DateTimeFormat("en-CA", {timeZone:"Europe/London",year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date());
  const query = new URLSearchParams({
    select: "game_id,release_date,release_status,is_estimated,verification_status,game:games!inner(id,slug,title,metadata,game_type,is_archived),platform:platforms!inner(name)",
    "region_code": "in.(GB,WW)",
    "release_date": `gte.${today}`,
    "release_status": "in.(announced,early_access,delayed)",
    "order": "release_date.asc",
    "limit": "500"
  });
  const releaseRows = await (await checkedFetch(`${SUPABASE_URL}/rest/v1/game_releases?${query}`, {
    headers: {apikey:SUPABASE_KEY, Authorization:`Bearer ${SUPABASE_KEY}`, Accept:"application/json"}
  })).json();
  const candidates = new Map();
  for (const row of releaseRows) {
    const platform = row.platform?.name || "";
    const game = row.game;
    if (!game || game.is_archived || !PLATFORM_ALLOW.test(platform)) continue;
    if (!candidates.has(row.game_id)) candidates.set(row.game_id, {
      slug: game.slug, title: game.title, release_date: row.release_date,
      platforms: [], verification_status: row.verification_status,
      igdb_game_id: game.metadata?.igdb_game_id || game.metadata?.igdb_id || null
    });
    const item = candidates.get(row.game_id);
    if (!item.platforms.includes(platform)) item.platforms.push(platform);
    if (row.release_date && (!item.release_date || row.release_date < item.release_date)) item.release_date = row.release_date;
  }
  const games = [...candidates.values()];
  if (!games.length) {
    await Bun.write(OUTPUT, JSON.stringify({schema_version:1,provider:"IGDB PopScore",updated_at:new Date().toISOString(),status:"empty",methodology:"Cross-platform IGDB interest and Twitch signals; Steam-only signals excluded.",games:[]}, null, 2)+"\n");
    return;
  }
  const tokenData = await (await checkedFetch("https://id.twitch.tv/oauth2/token", {
    method:"POST",
    headers:{"Content-Type":"application/x-www-form-urlencoded"},
    body:new URLSearchParams({client_id:IGDB_CLIENT_ID,client_secret:IGDB_CLIENT_SECRET,grant_type:"client_credentials"})
  })).json();
  const token = tokenData.access_token;
  if (!token) throw new Error("Twitch OAuth did not return an access token.");
  const types = await igdbPost("popularity_types", token, "fields id,name,popularity_source; limit 100;");
  const wantedTypes = types.filter(type => WEIGHTS.has(normalise(type.name)));
  const typeById = new Map(wantedTypes.map(type => [Number(type.id), normalise(type.name)]));
  for (const game of games) {
    if (!game.igdb_game_id) {
      const safeTitle = game.title.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
      const matches = await igdbPost("games", token, `search "${safeTitle}"; fields id,name,cover.url,artworks.url; limit 10;`);
      const ranked = matches.map(match => ({match, score:normalise(match.name) === normalise(game.title) ? 1 : tokenSimilarity(match.name, game.title)}))
        .sort((a,b)=>b.score-a.score);
      if (ranked[0] && ranked[0].score >= 0.65) {
        const match = ranked[0].match;
        game.igdb_game_id = Number(match.id);
        const imageUrl = value => value?.url ? ("https:" + value.url).replace("/t_thumb/","/t_720p/") : null;
        game.igdb_logo_url = imageUrl(match.logo);
        game.igdb_artwork_url = imageUrl(match.artworks?.[0]) || imageUrl(match.cover);
      }
      await sleep(275);
    }
  }
  const ids = [...new Set(games.filter(game=>game.igdb_game_id !== null && game.igdb_game_id !== undefined).map(game=>Number(game.igdb_game_id)).filter(Number.isFinite))];
  const typeIds = [...typeById.keys()];
  const primitives = ids.length && typeIds.length
    ? await igdbPost("popularity_primitives", token, `fields game_id,popularity_type,value; where game_id = (${ids.join(",")}) & popularity_type = (${typeIds.join(",")}); limit 500;`)
    : [];
  const valuesByGame = new Map(games.filter(game=>game.igdb_game_id !== null && game.igdb_game_id !== undefined).map(game=>[Number(game.igdb_game_id), new Map()]));
  for (const primitive of primitives) {
    const metric = typeById.get(Number(primitive.popularity_type));
    const value = Number(primitive.value);
    if (!metric || !Number.isFinite(value)) continue;
    valuesByGame.get(Number(primitive.game_id))?.set(metric, value);
  }
  const metricRanks = new Map();
  for (const metric of WEIGHTS.keys()) {
    const ranked = games.map(game=>({id:Number(game.igdb_game_id),value:valuesByGame.get(Number(game.igdb_game_id))?.get(metric)}))
      .filter(item=>Number.isFinite(item.value)).sort((a,b)=>b.value-a.value);
    const rankMap = new Map();
    ranked.forEach((item,index)=>rankMap.set(item.id, ranked.length <= 1 ? 100 : 100 * (ranked.length - 1 - index) / (ranked.length - 1)));
    metricRanks.set(metric, rankMap);
  }
  const scored = games.map(game => {
    const metrics = valuesByGame.get(Number(game.igdb_game_id)) || new Map();
    let weighted = 0, totalWeight = 0;
    const signals = [];
    for (const [metric, weight] of WEIGHTS) {
      if (!metrics.has(metric)) continue;
      weighted += (metricRanks.get(metric)?.get(Number(game.igdb_game_id)) || 0) * weight;
      totalWeight += weight;
      signals.push(metric);
    }
    return {...game, logo_url:game.igdb_logo_url, artwork_url:game.igdb_artwork_url, popularity_score:totalWeight ? Math.round(weighted / totalWeight) : null,
      popularity_signals:signals, popularity_coverage:signals.length};
  }).sort((a,b)=>(b.popularity_score ?? -1)-(a.popularity_score ?? -1) || a.release_date.localeCompare(b.release_date));
  scored.forEach((game,index)=>{game.popularity_rank=game.popularity_score===null?null:index+1;});
  const snapshot = {
    schema_version:1, provider:"IGDB PopScore",
    updated_at:new Date().toISOString(),
    status:scored.some(game=>game.popularity_score!==null)?"ok":"no-matched-signals",
    methodology:"Daily relative ranking across the upcoming PC and console release list. Weighted IGDB Visits (30%), Want to Play (40%), Playing (15%), Played (5%) and Twitch Hours Watched (10%). Steam-only player, review and sales signals are deliberately excluded so console-only games are not penalised. Missing metrics are omitted and remaining weights are renormalised.",
    games:scored
  };
  await Bun.write(OUTPUT, JSON.stringify(snapshot,null,2)+"\n");
  console.log(`Wrote popularity snapshot for ${scored.length} upcoming games; ${scored.filter(game=>game.popularity_score!==null).length} have usable signals.`);
}
main().catch(error=>{console.error(error);process.exitCode=1;});
