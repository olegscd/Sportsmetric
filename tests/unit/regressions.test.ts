import assert from "node:assert/strict";
import { test } from "node:test";
import { scryptSync } from "node:crypto";
import { countLiveGames, derivePlayerAverages, derivePlayerGameLog, deriveStandings, getEffectiveGameStatus } from "@/lib/derivations";
import { normalizeGame, normalizeTeam, ValidationError } from "@/lib/admin-validation";
import { parseBoxScoreText } from "@/lib/box-score-parser";
import { assertAllowedSourceUrl, fetchAllowedSource } from "@/lib/game-extractor";
import { passwordMatches } from "@/lib/admin-token";
import { buildContentSecurityPolicy } from "@/lib/content-security-policy";
import { safeImageSource } from "@/lib/image-policy";
import { createEmptyTable, makeDivisionKey, resolveCellValue, WIN_PCT_COLUMN } from "@/lib/uaap-schema";
import type { Game, Player, Team } from "@/types/sports";

const home: Team = { id: "home", name: "Home", shortName: "H", league: "PBA", logo: null,
  accentColor: "#123456", seasonId: "pba-2026", record: { wins: 0, losses: 0 } };
const away: Team = { ...home, id: "away", name: "Away", shortName: "A" };
const player: Player = { id: "player-2026", personId: "person", name: "Test Player", jerseyNumber: 1,
  position: "PG", teamId: home.id, height: "", photoUrl: null, seasonId: home.seasonId,
  rankBadges: [], seasonAverages: { ppg: 0, rpg: 0, apg: 0, spg: 0, bpg: 0, fgPct: 0, threePtPct: 0, ftPct: 0 } };
const game = (changes: Partial<Game> = {}): Game => ({ id: "pba-g1", league: "PBA", seasonId: home.seasonId,
  homeTeam: home, awayTeam: away, homeScore: 100, awayScore: 90, status: "FINAL",
  startTime: "2026-10-19T00:00:00Z", quarterOrSet: 4, timeRemaining: null,
  boxScore: { home: [], away: [] }, playByPlay: [], stage: "ELIMINATION", isPlayoff: false, ...changes });

test("PVL never auto-goes live; elapsed unconfirmed fixtures never become final", () => {
  const startTime = "2026-10-19T00:00:00Z";
  const now = Date.parse(startTime) + 3600000;
  assert.equal(getEffectiveGameStatus({ status: "UPCOMING", startTime, league: "PVL" }, now), "UPCOMING");
  assert.equal(getEffectiveGameStatus({ status: "UPCOMING", startTime, league: "PBA" }, now), "LIVE");
  assert.equal(getEffectiveGameStatus({ status: "UPCOMING", startTime, league: "PBA" }, now + 24 * 3600000), "UPCOMING");
  assert.equal(getEffectiveGameStatus({ status: "FINAL", startTime, league: "PVL" }, now), "FINAL");
});

test("navigation live count uses effective status and skips PVL", () => {
  const startTime = "2026-10-19T00:00:00Z";
  const now = Date.parse(startTime) + 3600000;
  assert.equal(countLiveGames([
    { status: "LIVE", startTime, league: "PBA" },
    { status: "UPCOMING", startTime, league: "PBA" },
    { status: "FINAL", startTime, league: "PBA" },
    { status: "UPCOMING", startTime, league: "PVL" },
  ], now), 2);
});

test("standings exclude playoffs and unfinished games", () => {
  const rows = deriveStandings([home, away], [game(), game({ id: "g2", homeScore: 1, awayScore: 2,
    stage: "FINALS", isPlayoff: true }), game({ id: "g3", status: "UPCOMING" })], "PBA", home.seasonId);
  assert.equal(rows.find(r => r.team.id === home.id)?.wins, 1);
  assert.equal(rows.find(r => r.team.id === home.id)?.losses, 0);
});

test("lifetime stats match person identity across season IDs and weight shooting attempts", () => {
  const oldPlayer = { ...player, id: "player-2025", seasonId: "pba-2025" };
  const lifetime = { ...player, seasonId: "lifetime" };
  const makeBox = (id: string, pts: number, fgM: number, fgA: number) => ({ playerId: id, min: "30:00", pts,
    reb: 1, ast: 2, stl: 0, blk: 0, fgM, fgA, threeM: 0, threeA: 0, ftM: 0, ftA: 0 });
  const games = [game({ boxScore: { home: [makeBox(player.id, 20, 8, 10)], away: [] } }),
    game({ id: "pba-g2", seasonId: oldPlayer.seasonId,
      boxScore: { home: [makeBox(oldPlayer.id, 10, 2, 10)], away: [] } })];
  const avg = derivePlayerAverages(lifetime, games, [home, away], [lifetime, oldPlayer]);
  assert.equal(avg.ppg, 15);
  assert.equal(avg.fgPct, 50);
  assert.equal(derivePlayerGameLog(lifetime.id, games, [home, away], [lifetime, oldPlayer]).length, 2);
});

test("admin validation rejects invalid enums, dates and image URLs", () => {
  assert.throws(() => normalizeGame({ ...game(), status: "GARBAGE" }), ValidationError);
  assert.throws(() => normalizeGame({ ...game(), startTime: "not a date" }), ValidationError);
  assert.throws(() => normalizeTeam({ ...home, logo: "https://unapproved.example/image.png" }), ValidationError);
  assert.equal(safeImageSource("//localhost/image.png"), null);
  assert.equal(safeImageSource("https://pba.ph@evil.example/image.png"), null);
  assert.equal(safeImageSource("/team.png"), "/team.png");
});

test("pasted box scores match roster and report unmatched names", () => {
  const result = parseBoxScoreText("Test Player, 30:00, 20, 5, 4, 1, 0, 8-12, 2-3, 2-2\nUnknown Name, 10:00, 2", [player]);
  assert.equal(result.matched.length, 1);
  assert.equal(result.matched[0].stat.pts, 20);
  assert.equal(result.matched[0].stat.fgA, 12);
  assert.equal(result.unmatched.length, 1);
});

test("source allowlist blocks private hosts, credentials and deceptive suffixes", () => {
  for (const url of ["http://127.0.0.1/x", "https://pba.ph.evil.example/x", "file:///tmp/a", "https://user:pass@pba.ph/x", "https://pba.ph:8443/x"]) {
    assert.throws(() => assertAllowedSourceUrl(url));
  }
  assert.equal(assertAllowedSourceUrl("https://uaap.livestats.ph/match/1"), "https://uaap.livestats.ph/match/1");
});

test("source redirects cannot escape the allowlist", async () => {
  const originalFetch = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = async () => { calls++; return new Response(null, { status: 302, headers: { location: "http://127.0.0.1/private" } }); };
  try {
    await assert.rejects(fetchAllowedSource("https://pba.ph/start"), /Unsupported source host/);
    assert.equal(calls, 1);
  } finally { globalThis.fetch = originalFetch; }
});

test("scrypt password hashes work and malformed hashes fail closed", async () => {
  const salt = "test-salt";
  const encoded = `scrypt$${salt}$${scryptSync("correct-password", salt, 64).toString("hex")}`;
  assert.equal(await passwordMatches("correct-password", encoded), true);
  assert.equal(await passwordMatches("wrong", encoded), false);
  assert.equal(await passwordMatches("anything", "scrypt$broken"), false);
});

test("production CSP uses a nonce and does not allow inline script execution", () => {
  const scriptPolicy = buildContentSecurityPolicy("random-nonce").split(";").find(p => p.trim().startsWith("script-src"))!;
  assert.match(scriptPolicy, /'nonce-random-nonce'/);
  assert.doesNotMatch(scriptPolicy, /unsafe-inline|unsafe-eval/);
});

test("archive keys normalize divisions and derived percentages handle empty records", () => {
  const table = createEmptyTable("2025-2026", "Basketball", "Men", []);
  assert.equal(makeDivisionKey(table.season, table.sport, table.division), "2025-2026|Basketball|Men's");
  assert.equal(resolveCellValue({ rank: 1, team: "UP", values: { wins: 3, losses: 1 }, details: null }, WIN_PCT_COLUMN), 0.75);
  assert.equal(resolveCellValue({ rank: 1, team: "UP", values: { wins: 0, losses: 0 }, details: null }, WIN_PCT_COLUMN), null);
});
