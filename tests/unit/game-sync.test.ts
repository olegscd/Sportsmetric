import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { test } from "node:test";
import { PGlite } from "@electric-sql/pglite";
import { planObservation } from "@/lib/game-sync/plan";
import { parseBasketballGame, parseBasketballIndex, parsePbaSchedule, parsePvlCards, sourceDay, sourceTime } from "@/lib/game-sync/sources";
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

test("database sync: private state, leases, atomic manual-edit protection and retained box scores", async () => {
  const db = new PGlite();
  try {
    await db.exec("CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role BYPASSRLS; CREATE PUBLICATION supabase_realtime; CREATE SCHEMA auth; CREATE FUNCTION auth.role() RETURNS text LANGUAGE sql AS $$ SELECT current_user::text $$;");
    for (const file of (await readdir("supabase/migrations")).sort()) {
      if (file.endsWith(".sql")) await db.exec(await readFile("supabase/migrations/" + file, "utf8"));
    }
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
