import { createServer } from "node:http";

// Deterministic local PostgREST stand-in. Browser tests never contact production.
const seasons = [
  { id: "2025-26", label: "Season 88", league: "UAAP", is_current: true, sort_order: 1 },
  { id: "pvl-2026", label: "PVL 2026", league: "PVL", is_current: true, sort_order: 2 },
  { id: "pba-2026", label: "PBA 2026", league: "PBA", is_current: true, sort_order: 3 },
];
const teams = seasons.flatMap(s => ["home", "away"].map(side => ({
  id: `${s.id}-${side}`, name: `${s.league} ${side === "home" ? "Home" : "Away"}`,
  short_name: side === "home" ? "HOM" : "AWY", logo: null, league: s.league,
  accent_color: "#123456", season_id: s.id, record: { wins: side === "home" ? 1 : 0, losses: side === "away" ? 1 : 0 },
})));
const players = teams.map(t => ({ id: `${t.id}-player`, person_id: `${t.id}-person`, name: `${t.name} Player`,
  jersey_number: 1, position: t.league === "PVL" ? "OH" : "PG", team_id: t.id, season_id: t.season_id,
  height: "", photo_url: null, season_averages: { ppg: 20, rpg: 5, apg: 3, spg: 1, bpg: 0, fgPct: 50, threePtPct: 25, ftPct: 80 }, rank_badges: [] }));
const games = seasons.map(s => ({ id: `${s.id}-g1`, league: s.league, season_id: s.id,
  home_team_id: `${s.id}-home`, away_team_id: `${s.id}-away`, home_score: 80, away_score: 70,
  status: "FINAL", start_time: "2026-10-18T10:00:00Z", stage: "ELIMINATION", is_playoff: false,
  venue: "Test Arena", quarter_or_set: 4, time_remaining: null,
  box_score: { venue: "Test Arena", stage: "ELIMINATION", isPlayoff: false,
    home: [{ playerId: `${s.id}-home-player`, min: "30:00", pts: 20, reb: 5, ast: 3,
    stl: 1, blk: 0, fgM: 8, fgA: 16, threeM: 2, threeA: 8, ftM: 2, ftA: 2 }], away: [] },
  play_by_play: [],
}));
const tables: Record<string, Record<string, unknown>[]> = {
  seasons, teams, players, games, admin_sessions: [], uaap_overrides: [], uaap_division_overrides: [],
};

let databaseUnavailable = false;
createServer(async (request, response) => {
  const url = new URL(request.url ?? "/", "http://127.0.0.1:54329");
  if (url.pathname === "/health") { response.end("ok"); return; }
  if (url.pathname === "/_test/database") {
    databaseUnavailable = url.searchParams.get("fail") === "1";
    response.end("ok"); return;
  }
  if (databaseUnavailable) {
    response.writeHead(503, { "Content-Type": "application/json" });
    response.end(JSON.stringify({ message: "Test database unavailable" })); return;
  }
  const table = url.pathname.split("/").at(-1)!;
  let rows = tables[table] ?? [];
  const matches = (row: Record<string, unknown>) => [...url.searchParams].every(([key, value]) => {
    if (value.startsWith("eq.")) return String(row[key]) === value.slice(3);
    if (value.startsWith("gt.")) return String(row[key]) > value.slice(3);
    if (value.startsWith("in.(")) return value.slice(4, -1).split(",").map(v => v.replaceAll('"', "")).includes(String(row[key]));
    return true;
  });
  if (request.method === "POST") {
    let body = "";
    for await (const chunk of request) body += chunk;
    const value = JSON.parse(body);
    rows.push(...(Array.isArray(value) ? value : [value]));
    response.writeHead(201); response.end(); return;
  }
  if (request.method === "DELETE") {
    tables[table] = rows.filter(row => !matches(row));
    response.writeHead(204); response.end(); return;
  }
  rows = rows.filter(matches);
  const select = url.searchParams.get("select");
  // Model the live legacy schema: metadata exists only inside box_score.
  if (table === "games") {
    const missing = ["venue", "stage", "is_playoff"].find(column => select?.split(",").includes(column));
    if (missing) {
      response.writeHead(400, { "Content-Type": "application/json" });
      response.end(JSON.stringify({ code: "42703", message: `column games.${missing} does not exist` })); return;
    }
    rows = rows.map(row => Object.fromEntries(Object.entries(row).filter(([key]) => !["venue", "stage", "is_playoff"].includes(key))));
  }
  if (select && select !== "*") rows = rows.map(row => Object.fromEntries(select.split(",").map(key => [key, row[key]])));
  const rangeFrom = Number(url.searchParams.get("offset") ?? 0);
  const rangeSize = Number(url.searchParams.get("limit") ?? 1000);
  rows = rows.slice(rangeFrom, rangeFrom + rangeSize);
  const singular = request.headers.accept?.includes("application/vnd.pgrst.object+json");
  response.setHeader("Content-Type", "application/json");
  response.end(JSON.stringify(singular ? rows[0] ?? null : rows));
}).listen(54329, "127.0.0.1", () => console.log("Local smoke-test data ready"));
