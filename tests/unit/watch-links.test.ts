import { PGlite } from "@electric-sql/pglite";
import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { test } from "node:test";
import { gameActions, gameLinksFromRow, normalizeGameLinks, normalizeSeasonLinks } from "../../lib/watch-links";
import type { GameLinks, SeasonLinks } from "../../types/sports";

const season = { links: { watchUrl: "https://watch.example/live", watchLabel: "Cignal Play", watchNote: "Subscription",
  ticketsUrl: "https://tickets.example/uaap", ticketsLabel: "TicketNet" } satisfies SeasonLinks };
const none: GameLinks = { watchUrl: null, ticketsUrl: null, replayUrl: null, replayKind: null, replayLabel: null };

test("upcoming uses season defaults; live and final require game-specific links", () => {
  assert.deepEqual(gameActions({ status: "UPCOMING" }, season).map(a => [a.kind, a.label]), [["tickets", "TicketNet"], ["watch", "Cignal Play"]]);
  assert.deepEqual(gameActions({ status: "LIVE" }, season), []);
  assert.deepEqual(gameActions({ status: "FINAL" }, season), []);
  const links: GameLinks = { ...none, watchUrl: "https://watch.example/current-game", ticketsUrl: "https://tickets.example/game",
    replayUrl: "https://www.youtube.com/watch?v=x", replayKind: "highlights", replayLabel: "One Sports" };
  const final = gameActions({ status: "FINAL", links }, season);
  assert.deepEqual(final.map(a => [a.kind, a.label, a.detail]), [["replay", "One Sports", "Highlights"]]);
  assert.equal(final[0].url, links.replayUrl);
  assert.deepEqual(gameActions({ status: "LIVE", links }, season).map(a => [a.kind, a.url]), [["watch", links.watchUrl]]);
  assert.deepEqual(gameActions({ status: "LIVE", links: { ...links, watchUrl: null } }, season), []);
  assert.deepEqual(gameActions({ status: "FINAL", links: { ...links, replayUrl: null } }, season), []);
});

test("game overrides replace season links without borrowing the season broadcaster name", () => {
  const [watch] = gameActions({ status: "LIVE", links: { ...none, watchUrl: "https://www.other.tv/game" } }, season);
  assert.equal(watch.url, "https://www.other.tv/game");
  assert.equal(watch.label, "other.tv");
  assert.equal(watch.detail, null);
  assert.deepEqual(gameActions({ status: "UPCOMING" }, undefined), []);
});

test("link validation requires https and drops replay details without a replay", () => {
  assert.throws(() => normalizeSeasonLinks({ watchUrl: "http://insecure.tv" }), /https/);
  assert.throws(() => normalizeGameLinks({ replayUrl: "javascript:alert(1)" }), /https/);
  assert.throws(() => normalizeGameLinks({ replayUrl: "https://youtu.be/x", replayKind: "pirated" }), /Replay type/);
  assert.deepEqual(normalizeGameLinks({ replayKind: "full", replayLabel: "One Sports" }), none);
  assert.equal(normalizeGameLinks({ replayUrl: "https://youtu.be/x" }).replayKind, "highlights");
  assert.equal(gameLinksFromRow({ watch_url: null, replay_url: "" }), undefined);
});

test("link columns survive regular game and season saves", async () => {
  const db = new PGlite();
  try {
    await db.exec("CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role BYPASSRLS; CREATE PUBLICATION supabase_realtime; CREATE SCHEMA auth; CREATE FUNCTION auth.role() RETURNS text LANGUAGE sql AS $$ SELECT current_user::text $$;");
    for (const file of (await readdir("supabase/migrations")).sort()) {
      if (file.endsWith(".sql")) await db.exec(await readFile(`supabase/migrations/${file}`, "utf8"));
    }
    await db.exec(`INSERT INTO seasons(id,label,year,league,is_current) VALUES ('s1','S1','s1','UAAP',true);
      INSERT INTO teams(id,name,short_name,league,season_id) VALUES ('a','A','A','UAAP','s1'),('b','B','B','UAAP','s1');
      INSERT INTO games(id,league,season_id,home_team_id,away_team_id,status) VALUES ('g','UAAP','s1','a','b','FINAL');
      UPDATE games SET replay_url='https://youtu.be/x', replay_kind='full' WHERE id='g';
      UPDATE seasons SET watch_url='https://watch.example' WHERE id='s1';`);
    // Same shape as gameToRecord's upsert: link columns are not in the payload.
    await db.exec("INSERT INTO games(id,league,season_id,home_team_id,away_team_id,status,home_score) VALUES ('g','UAAP','s1','a','b','FINAL',70) ON CONFLICT (id) DO UPDATE SET home_score=EXCLUDED.home_score");
    await db.query("SELECT save_sports_seasons($1)", [JSON.stringify([{ id: "s1", label: "Renamed", year: "s1", league: "UAAP", is_current: true }])]);
    assert.equal((await db.query<{ replay_url: string }>("SELECT replay_url FROM games WHERE id='g'")).rows[0].replay_url, "https://youtu.be/x");
    assert.equal((await db.query<{ watch_url: string }>("SELECT watch_url FROM seasons WHERE id='s1'")).rows[0].watch_url, "https://watch.example");
    await assert.rejects(db.exec("UPDATE games SET replay_url='http://x' WHERE id='g'"), /check constraint/);
    await assert.rejects(db.exec("UPDATE games SET replay_url=NULL WHERE id='g'"), /check constraint/);
  } finally {
    await db.close();
  }
});
