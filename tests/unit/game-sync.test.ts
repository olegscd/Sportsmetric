import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { test } from "node:test";
import { PGlite } from "@electric-sql/pglite";
import { livePeriod, planObservation } from "@/lib/game-sync/plan";
import { collectObservations, parseBasketballGame, parseBasketballIndex, parseGameClock, parsePbaSchedule, parsePvlCards, sourceDay, sourceTime } from "@/lib/game-sync/sources";
import { resolveSyncBox } from "@/lib/game-sync/box";
import type { Observation, StoredGame, SyncLink, SyncSource, SyncTeam } from "@/lib/game-sync/types";

const source: SyncSource = { id: "uaap-s89-men", league: "UAAP", season_id: "uaap-s89-men", label: "UAAP Season 89 Men's Basketball", tournament_url: "https://uaap.livestats.ph/tournaments/uaap-season-89-men-s-basketball", year: 2026, starts_on: "2026-09-01", ends_on: "2027-02-28", conference_id: null, enabled: true };
const teams: SyncTeam[] = [{ id: "home", name: "DLSU Green Archers", short_name: "DLSU", season_id: source.season_id, league: "UAAP" }, { id: "away", name: "Adamson Soaring Falcons", short_name: "ADU", season_id: source.season_id, league: "UAAP" }];
const item: Observation = { key: "match:29", home: "LA SALLE", away: "ADU", day: "2026-10-18", startTime: "2026-10-18T10:00:00.000Z", status: "FINAL", homeScore: 60, awayScore: 63, venue: "Blue Eagle Gym", stage: "ELIMINATION", url: source.tournament_url + "?game_id=29" };
const fixture: StoredGame = { id: "existing", league: "UAAP", season_id: source.season_id, home_team_id: "home", away_team_id: "away", status: "UPCOMING", home_score: 0, away_score: 0, start_time: item.startTime!, venue: "Old venue", stage: "ELIMINATION", is_playoff: false };
const link: SyncLink = { source_id: source.id, source_key: item.key, game_id: fixture.id, paused: false, snapshot: fixture, last_checked_at: "2026-10-18T01:00:00Z" };

test("updater reuses fixtures, preserves home/away orientation and refuses bad finals", () => {
  const result = planObservation(source, item, teams, [fixture], []);
  assert.equal(result.kind, "save");
  if (result.kind === "save") { assert.equal(result.game.id, "existing"); assert.equal(result.game.status, "FINAL"); }
  const reversed = planObservation(source, item, teams, [{ ...fixture, home_team_id: "away", away_team_id: "home" }], []);
  assert.equal(reversed.kind, "save");
  if (reversed.kind === "save") { assert.equal(reversed.game.home_score, 63); assert.equal(reversed.game.away_score, 60); }
  for (const changes of [{ homeScore: null }, { homeScore: 63 }, { homeScore: -1 }, { homeScore: 1.5 }, { homeScore: 500 }, { day: "2028-10-18" }, { away: "Unknown" }]) {
    assert.equal(planObservation(source, { ...item, ...changes }, teams, [fixture], []).kind, "review");
  }
});

test("reschedules preserve identity; repeats and manual edits are held", () => {
  const moved = { ...item, day: "2026-10-20", startTime: "2026-10-20T10:00:00Z", status: "UPCOMING" as const };
  const result = planObservation(source, moved, teams, [fixture], [link]);
  assert.equal(result.kind, "save"); if (result.kind === "save") assert.equal(result.game.id, fixture.id);
  assert.equal(planObservation(source, item, teams, [fixture, { ...fixture, id: "duplicate" }], []).kind, "review");
  assert.equal(planObservation(source, { ...moved, key: "new-alias" }, teams, [{ ...fixture, venue: "My correction" }], [link]).kind, "review");
  assert.equal(planObservation(source, item, teams, [fixture], [{ ...link, paused: true }]).kind, "skip");
  assert.equal(planObservation(source, item, teams, [], [link]).kind, "review");
  assert.equal(planObservation(source, moved, teams, [{ ...fixture, stage: "FINALS" }, { ...fixture, id: "later", start_time: "2026-10-22T10:00:00Z", stage: "FINALS" }], []).kind, "save");
  assert.equal(planObservation(source, { ...moved, stage: "FINALS" }, teams, [{ ...fixture, stage: "FINALS" }], []).kind, "review");
});

test("published finals stay protected and date-less results require a fixture", () => {
  const final = { ...fixture, status: "FINAL", home_score: 60, away_score: 63 };
  assert.equal(planObservation(source, item, teams, [final], []).kind, "save");
  assert.equal(planObservation(source, { ...item, homeScore: 61 }, teams, [final], []).kind, "review");
  assert.equal(planObservation(source, { ...item, status: "UPCOMING" }, teams, [final], []).kind, "skip");
  assert.equal(planObservation(source, { ...item, startTime: null }, teams, [], []).kind, "review");
  const saved = planObservation(source, { ...item, startTime: null }, teams, [fixture], []);
  assert.equal(saved.kind, "save"); if (saved.kind === "save") assert.equal(saved.game.start_time, fixture.start_time);
});

const basketballHtml = (label = "Final") => '<a class="schedule-box" href="?game_id=29"><div class="scheduled-team"><div class="team">LA SALLE</div>60</div><div class="schedule-details">' + label + '</div><div class="scheduled-team"><div class="team">ADU</div>63</div></a><div id="scoreboard"><div class="team-0"><div class="team_code">LA SALLE</div><div class="team_score">60</div></div><div class="team-1"><div class="team_code">ADU</div><div class="team_score">63</div></div></div><div class="game-detail"><h6>Competition</h6><span>UAAP Season 89 MEN\'S BASKETBALL</span></div><div class="game-detail"><h6>Game Details</h6><span>10/18/26 06:00 PM</span></div>';
test("official basketball finality and dates are explicit, never inferred", () => {
  const html = basketballHtml();
  const ref = parseBasketballIndex(html, source.tournament_url)[0];
  const game = parseBasketballGame(html, ref, source);
  assert.equal(game.startTime, item.startTime); assert.equal(game.status, "FINAL"); assert.equal(game.homeScore, 60);
  const pending = basketballHtml("Scheduled");
  assert.equal(parseBasketballGame(pending, parseBasketballIndex(pending, source.tournament_url)[0], source).status, "UPCOMING");
  assert.throws(() => parseBasketballGame(pending, ref, source), /changed during/);
  assert.throws(() => parseBasketballGame(html.replace("10/18/26", "Date TBA"), ref, source), /date/);
  assert.throws(() => parseBasketballGame(html.replace('<div class="team_score">60', '<div class="team_score">61'), ref, source), /inconsistent/);
  assert.throws(() => parseBasketballIndex("<html>Service unavailable</html>", source.tournament_url), /No official/);
  assert.throws(() => parseBasketballIndex(html.replace("?game_id=29", "https://evil.example/tournaments/x?game_id=29"), source.tournament_url), /Unexpected/);
});

const pvl = { ...source, id: "pvl", league: "PVL" as const, year: 2026, starts_on: "2026-10-01", ends_on: "2027-06-30" };
const pvlCard = (home: string, away: string) => '<div><div class="match-card"><div class="match-card-teams"><h3>' + home + '</h3><h3>' + away + '</h3></div><div class="match-card-footer"><div class="match-card-time">01:00 PM</div><div>Preliminary Round</div></div></div></div>';
test("Philippine date grouping, year rollover, TBA and conditional fixtures", () => {
  assert.equal(sourceDay("Tue Oct 20", pvl), "2026-10-20");
  assert.equal(sourceDay("Tue Jan 05", pvl), "2027-01-05");
  assert.throws(() => sourceDay("Mon Oct 20", pvl), /weekday/);
  assert.throws(() => sourceTime("2026-10-20", "TBA"), /time/);
  const html = '<div><div class="match-date">Tue Oct 20 | Arena A</div></div>' + pvlCard("CCS", "AKA") + '<div><div class="match-date">Thu Oct 22 | Arena B</div></div>' + pvlCard("CAP", "HSH") + pvlCard("TBD", "TBD");
  const parsed = parsePvlCards(html, pvl, false);
  assert.equal(parsed.length, 2); assert.equal(parsed[0].day, "2026-10-20"); assert.equal(parsed[1].day, "2026-10-22"); assert.equal(parsed[1].venue, "Arena B");
  assert.equal(parsePvlCards(html.replaceAll("Preliminary Round", "Semi-Final Round - If Necessary"), pvl, false).length, 0);
  assert.throws(() => parsePvlCards(html, pvl, true), /score/);
  assert.throws(() => parsePbaSchedule("<html>OUT OF BOUNDS</html>", { ...source, league: "PBA" }), /unavailable/);
  const pbaCard = '<div class="schedule-day"><div><div class="schedule-time-venue"><p>05:15 PM</p><p>Arena</p></div><div class="schedule-teams"><div class="schedule-team"><p>SAN MIGUEL BEERMEN</p></div><div class="schedule-team"><p>NLEX ROAD WARRIORS</p></div></div></div></div>';
  const pbaCards = parsePbaSchedule(pbaCard.replace('<div class="schedule-day">', '<div class="schedule-day"><h2>Wed, Oct 21</h2>') + pbaCard, source);
  assert.equal(pbaCards.length, 2); assert.equal(pbaCards[1].day, "2026-10-21");
});

test("PBA uses the scheduler's official cache when the app host cannot access schedules", async () => {
  const pbaSource = { ...source, league: "PBA" as const, tournament_url: "https://pba-api01.actech2.com/tournaments/pba-50th-season-governors-cup" };
  const html = basketballHtml().replaceAll("LA SALLE", "GIN").replaceAll("ADU", "PHX").replace("UAAP Season 89 MEN'S BASKETBALL", "PBA 50th Season Governors' Cup");
  const schedule = '<div class="schedule-day"><h2>Wed, Oct 21</h2><div><div class="schedule-time-venue"><p>05:15 PM</p><p>Arena</p></div><div class="schedule-teams"><div class="schedule-team"><p>SAN MIGUEL BEERMEN</p></div><div class="schedule-team"><p>NLEX ROAD WARRIORS</p></div></div></div></div>';
  const original = globalThis.fetch;
  const urls: string[] = [];
  globalThis.fetch = async input => {
    const url = String(input); urls.push(url);
    if (url === "https://www.pba.ph/schedule") return new Response("Denied", { status: 403 });
    return new Response(html);
  };
  try {
    const cached = await collectObservations(pbaSource, [], new Date("2026-10-20"), undefined, async () => schedule);
    assert.equal(cached.items.length, 2); assert.deepEqual(cached.warnings, []);
    assert.ok(!urls.includes("https://www.pba.ph/schedule"));
    const unavailable = await collectObservations(pbaSource, [], new Date("2026-10-20"), undefined, async () => null);
    assert.equal(unavailable.items.length, 1);
    assert.match(unavailable.warnings[0], /403/);
  } finally { globalThis.fetch = original; }
});

test("database sync: private state, leases, atomic manual-edit protection and retained box scores", async () => {
  const db = new PGlite();
  try {
    await db.exec("CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role BYPASSRLS; CREATE PUBLICATION supabase_realtime; CREATE SCHEMA auth; CREATE FUNCTION auth.role() RETURNS text LANGUAGE sql AS $$ SELECT current_user::text $$;");
    for (const file of (await readdir("supabase/migrations")).sort()) {
      if (file.endsWith(".sql")) await db.exec(await readFile("supabase/migrations/" + file, "utf8"));
    }
    // The original production schema stores start_time as text. Both layouts
    // must support the same atomic updater without a disruptive type migration.
    await db.exec("ALTER TABLE games ALTER COLUMN start_time DROP DEFAULT; ALTER TABLE games ALTER COLUMN start_time TYPE text USING start_time::text;");
    await db.exec("INSERT INTO seasons(id,label,league,is_current) VALUES ('uaap-s89-men','UAAP','UAAP',true); INSERT INTO teams(id,name,short_name,league,season_id) VALUES ('home','Home','H','UAAP','uaap-s89-men'),('away','Away','A','UAAP','uaap-s89-men');");
    await db.query("INSERT INTO game_sync_sources(id,league,season_id,label,tournament_url,year,starts_on,ends_on) VALUES ($1,'UAAP',$1,'UAAP',$2,2026,'2026-09-01','2027-02-28')", [source.id, source.tournament_url]);
    await db.query("INSERT INTO games(id,league,season_id,home_team_id,away_team_id,status,start_time,venue,stage,is_playoff,box_score) VALUES ('existing','UAAP','uaap-s89-men','home','away','UPCOMING',$1,'Old venue','ELIMINATION',false,$2)", [fixture.start_time, { home: [{ pts: 10, playerId: "keep" }], away: [] }]);
    assert.equal((await db.query<{ id: string | null }>("SELECT begin_game_sync() id")).rows[0].id, null);
    await db.exec("UPDATE game_sync_settings SET enabled=true");
    const run = (await db.query<{ id: string }>("SELECT begin_game_sync() id")).rows[0].id;
    assert.ok(run); assert.equal((await db.query<{ id: string | null }>("SELECT begin_game_sync() id")).rows[0].id, null);
    const decision = planObservation(source, item, teams, [fixture], []);
    assert.equal(decision.kind, "save"); if (decision.kind !== "save") return;
    const apply = (proposed: StoredGame, expected: StoredGame | null = fixture) => db.query<{ result: string }>("SELECT apply_game_sync($1,$2,$3,$4,$5) result", [run, source.id, item.key, proposed, expected]);
    await db.exec("UPDATE games SET venue='Manual change' WHERE id='existing'");
    await assert.rejects(apply(decision.game), /changed during/);
    assert.equal((await db.query("SELECT * FROM game_sync_links")).rows.length, 0);
    await db.exec("UPDATE games SET venue='Old venue' WHERE id='existing'");
    await apply(decision.game);
    const stored = (await db.query<{ box_score: { home: { playerId: string }[] }; status: string }>("SELECT box_score,status FROM games WHERE id='existing'")).rows[0];
    assert.equal(stored.box_score.home[0].playerId, "keep"); assert.equal(stored.status, "FINAL");
    await assert.rejects(apply({ ...decision.game, home_score: 61 }, decision.game), /finals require manual/);
    await db.exec("UPDATE game_sync_links SET paused=true");
    assert.equal((await apply(decision.game, decision.game)).rows[0].result, "paused");
    await db.exec("SET ROLE anon");
    await assert.rejects(db.query("SELECT * FROM game_sync_settings"), /permission denied/);
    await assert.rejects(db.query("SELECT begin_game_sync()"), /permission denied/);
    await db.exec("RESET ROLE");
    await db.query("SELECT finish_game_sync($1,'success','{}')", [run]);
    assert.ok((await db.query<{ id: string }>("SELECT begin_game_sync() id")).rows[0].id);
  } finally { await db.close(); }
});

test("live games: clock parsing, live scores from the scoreboard, never backwards", () => {
  assert.deepEqual(parseGameClock("PERIOD 2 04:03 Live"), { period: 2, clock: "04:03" });
  assert.deepEqual(parseGameClock("OT 1 2:11"), { period: 5, clock: "2:11" });
  assert.deepEqual(parseGameClock("Halftime"), { period: 2, clock: "Halftime" });
  assert.deepEqual(parseGameClock("Oct 24 05:00 PM"), { period: null, clock: null });
  const live = basketballHtml("Live").replace('<a class="schedule-box" href="?game_id=29">', '<a class="schedule-box" href="?game_id=29"><div class="period">PERIOD 3 07:15</div>')
    .replace('<div class="team_score">60', '<div class="team_score">48').replace('<div class="team_score">63', '<div class="team_score">51');
  const ref = parseBasketballIndex(live, source.tournament_url)[0];
  assert.equal(ref.live, true); assert.equal(ref.final, false);
  const game = parseBasketballGame(live, ref, source);
  assert.equal(game.status, "LIVE"); assert.equal(game.homeScore, 48); assert.equal(game.awayScore, 51);
  assert.equal(game.period, 3); assert.equal(game.clock, "07:15");
  const liveItem: Observation = { ...item, status: "LIVE", homeScore: 48, awayScore: 51, period: 3, clock: "07:15" };
  const saved = planObservation(source, liveItem, teams, [fixture], []);
  assert.equal(saved.kind, "save");
  if (saved.kind === "save") { assert.equal(saved.game.status, "LIVE"); assert.equal(saved.game.home_score, 48); assert.equal(saved.game.quarter_or_set, 3); assert.equal(saved.game.time_remaining, "07:15"); }
  const inProgress = { ...fixture, status: "LIVE", home_score: 48, away_score: 51 };
  assert.equal(planObservation(source, { ...item, status: "UPCOMING", homeScore: null, awayScore: null }, teams, [inProgress], []).kind, "skip");
  assert.equal(planObservation(source, liveItem, teams, [{ ...fixture, status: "FINAL", home_score: 60, away_score: 63 }], []).kind, "skip");
  assert.equal(planObservation(source, { ...liveItem, homeScore: null }, teams, [fixture], []).kind, "review");
  assert.deepEqual(livePeriod({ ...source, league: "PVL" }, { ...item, homeScore: 3, awayScore: 1 }), { quarter_or_set: 4, time_remaining: null });
});

test("a stale source alias is not a manual edit; a real edit still is", () => {
  const final = { ...fixture, status: "FINAL", home_score: 60, away_score: 63 };
  const stale: SyncLink = { ...link, source_key: "fixture:2026-10-18:LA SALLE:ADU", snapshot: fixture };
  const current: SyncLink = { ...link, snapshot: final };
  assert.equal(planObservation(source, item, teams, [final], [stale, current]).kind, "save");
  assert.equal(planObservation(source, item, teams, [{ ...final, venue: "Edited" }], [stale, current]).kind, "review");
});

test("automatic box scores reuse roster ids and the importer's id scheme for new athletes", () => {
  const players = [{ id: "dlsu-s89-m-cortez", person_id: "m-cortez", name: "M. Cortez", jersey_number: 11, team_id: "home", season_id: source.season_id }];
  const row = { playerName: "M. Cortez", jersey: 11, min: "30:00", pts: 12, reb: 4, ast: 4, stl: 0, blk: 0, fgM: 5, fgA: 16 };
  const { items, created } = resolveSyncBox([row, { ...row, playerName: "J. Newcomer", jersey: 99 }], "home", "UAAP", players);
  assert.equal(items[0].playerId, "dlsu-s89-m-cortez");
  assert.equal(items[1].playerId, "home-j-newcomer"); assert.equal(created.length, 1);
  assert.equal(resolveSyncBox([{ ...row, playerName: "J. Newcomer", jersey: 99 }], "home", "UAAP", [...players, { ...players[0], id: "home-j-newcomer", person_id: "j-newcomer", name: "J. Newcomer", jersey_number: 99 }]).created.length, 0);
});

test("database sync: live progression, alias refresh and box score protection", async () => {
  const db = new PGlite();
  try {
    await db.exec("CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role BYPASSRLS; CREATE PUBLICATION supabase_realtime; CREATE SCHEMA auth; CREATE FUNCTION auth.role() RETURNS text LANGUAGE sql AS $$ SELECT current_user::text $$;");
    for (const file of (await readdir("supabase/migrations")).sort()) {
      if (file.endsWith(".sql")) await db.exec(await readFile("supabase/migrations/" + file, "utf8"));
    }
    await db.exec("ALTER TABLE games ALTER COLUMN start_time DROP DEFAULT; ALTER TABLE games ALTER COLUMN start_time TYPE text USING start_time::text;");
    await db.exec("INSERT INTO seasons(id,label,league,is_current) VALUES ('uaap-s89-men','UAAP','UAAP',true); INSERT INTO teams(id,name,short_name,league,season_id) VALUES ('home','Home','H','UAAP','uaap-s89-men'),('away','Away','A','UAAP','uaap-s89-men');");
    await db.query("INSERT INTO game_sync_sources(id,league,season_id,label,tournament_url,year,starts_on,ends_on) VALUES ($1,'UAAP',$1,'UAAP',$2,2026,'2026-09-01','2027-02-28')", [source.id, source.tournament_url]);
    await db.query("INSERT INTO games(id,league,season_id,home_team_id,away_team_id,status,start_time,venue,stage,is_playoff) VALUES ('existing','UAAP','uaap-s89-men','home','away','UPCOMING',$1,'Old venue','ELIMINATION',false)", [fixture.start_time]);
    await db.exec("UPDATE game_sync_settings SET enabled=true");
    const run = (await db.query<{ id: string }>("SELECT begin_game_sync() id")).rows[0].id;
    const apply = (key: string, proposed: StoredGame, expected: StoredGame | null) => db.query<{ result: string }>("SELECT apply_game_sync($1,$2,$3,$4,$5) result", [run, source.id, key, proposed, expected]);
    const box = (game: string, payload: unknown, players: unknown[] = []) => db.query<{ result: string }>("SELECT apply_game_box_score($1,$2,$3,$4) result", [run, game, payload, players]);
    const row = (playerId: string) => ({ playerId, pts: 2, reb: 0, ast: 0, stl: 0, blk: 0, fgM: 1, fgA: 1, min: "1:00" });
    // The schedule alias links first; then the live entry takes over.
    await apply("fixture:a", fixture, fixture);
    const live = { ...fixture, status: "LIVE", home_score: 20, away_score: 18, quarter_or_set: 2, time_remaining: "04:03" };
    assert.equal((await apply("match:29", live, fixture)).rows[0].result, "updated");
    let stored = (await db.query<{ status: string; quarter_or_set: number; time_remaining: string }>("SELECT status,quarter_or_set,time_remaining FROM games WHERE id='existing'")).rows[0];
    assert.equal(stored.status, "LIVE"); assert.equal(stored.quarter_or_set, 2); assert.equal(stored.time_remaining, "04:03");
    const aliases = (await db.query<{ snapshot: { status: string } }>("SELECT snapshot FROM game_sync_links ORDER BY source_key")).rows;
    assert.deepEqual(aliases.map(a => a.snapshot.status), ["LIVE", "LIVE"]);
    // Clock-only changes still save; schedule listings never revert a live game.
    assert.equal((await apply("match:29", { ...live, time_remaining: "02:10" }, live)).rows[0].result, "updated");
    assert.equal((await apply("fixture:a", fixture, live)).rows[0].result, "unchanged");
    assert.equal((await db.query<{ status: string }>("SELECT status FROM games WHERE id='existing'")).rows[0].status, "LIVE");
    // Live box scores refresh, and unknown athletes are added to the roster once.
    await assert.rejects(box("existing", { home: [], away: [] }), /Invalid box/);
    assert.equal((await box("existing", { home: [row("home-new-guy")], away: [row("p2")] }, [{ id: "home-new-guy", person_id: "new-guy", name: "New Guy", jersey_number: 7, position: "SG", team_id: "home", season_averages: {} }, { id: "evil", person_id: "x", name: "X", jersey_number: 1, position: "SG", team_id: "home" }])).rows[0].result, "updated");
    assert.deepEqual((await db.query<{ id: string }>("SELECT id FROM players ORDER BY id")).rows.map(r => r.id), ["home-new-guy"]);
    // Final keeps the furthest period, clears the clock and keeps refreshing the automatic box score.
    const final = { ...live, status: "FINAL", home_score: 70, away_score: 65, quarter_or_set: 4, time_remaining: null };
    await db.exec("UPDATE games SET quarter_or_set=5 WHERE id='existing'");
    assert.equal((await apply("match:29", final, { ...live, time_remaining: "02:10" })).rows[0].result, "updated");
    stored = (await db.query<{ status: string; quarter_or_set: number; time_remaining: string }>("SELECT status,quarter_or_set,time_remaining FROM games WHERE id='existing'")).rows[0];
    assert.equal(stored.status, "FINAL"); assert.equal(stored.quarter_or_set, 5); assert.equal(stored.time_remaining, null);
    assert.equal((await box("existing", { home: [row("a")], away: [row("b")] })).rows[0].result, "updated");
    // A hand-imported final box score is never replaced.
    await db.exec(`UPDATE games SET box_score='{"home":[{"playerId":"manual"}],"away":[]}' WHERE id='existing'`);
    assert.equal((await box("existing", { home: [row("a")], away: [row("b")] })).rows[0].result, "kept");
    await db.exec("SET ROLE anon");
    await assert.rejects(db.query("SELECT apply_game_box_score($1,'existing','{}','[]')", [run]), /permission denied/);
    await db.exec("RESET ROLE");
  } finally { await db.close(); }
});
