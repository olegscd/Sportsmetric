import { PGlite } from "@electric-sql/pglite";
import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { test } from "node:test";
import { inProgressSeasons, isSeasonInProgress } from "../../lib/season-status";
import { mapSeasonRows } from "../../lib/supabase-data";
import type { Season } from "../../types/sports";

test("current and marked seasons are in progress; others are archived", () => {
  const seasons: Season[] = [
    { id: "men", label: "Men", league: "UAAP", isCurrent: true, isActive: true },
    { id: "u16", label: "U16", league: "UAAP", isCurrent: false, isActive: true },
    { id: "s88", label: "S88", league: "UAAP", isCurrent: false, isActive: false },
    { id: "pba", label: "PBA", league: "PBA", isCurrent: true },
  ];
  assert.deepEqual(seasons.map(isSeasonInProgress), [true, true, false, true]);
  assert.deepEqual(inProgressSeasons(seasons, "UAAP").map(s => s.id), ["men", "u16"]);
  assert.equal(isSeasonInProgress(undefined), false);
});

test("databases without is_active treat only the current season as in progress", () => {
  const mapped = mapSeasonRows([{ id: "a", label: "A", league: "UAAP", is_current: true }, { id: "b", label: "B", league: "UAAP", is_current: false }]);
  const byId = new Map(mapped.map(s => [s.id, s.isActive]));
  assert.equal(byId.get("a"), true);
  assert.equal(byId.get("b"), false);
});

test("is_active: backfill, current implies in progress, and the updater accepts in-progress seasons", async () => {
  const db = new PGlite();
  try {
    await db.exec("CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role BYPASSRLS; CREATE PUBLICATION supabase_realtime; CREATE SCHEMA auth; CREATE FUNCTION auth.role() RETURNS text LANGUAGE sql AS $$ SELECT current_user::text $$;");
    const files = (await readdir("supabase/migrations")).filter(f => f.endsWith(".sql")).sort();
    const target = files.findIndex(f => f.startsWith("20261020040000"));
    for (const file of files.slice(0, target)) await db.exec(await readFile(`supabase/migrations/${file}`, "utf8"));
    // State before the migration: one current season, one parallel season with
    // future fixtures, and an old season with a stale unfinished game.
    await db.exec(`INSERT INTO seasons(id,label,year,league,is_current) VALUES ('men','Men','men','UAAP',true),('u16','U16','u16','UAAP',false),('s88','S88','s88','UAAP',false);
      INSERT INTO teams(id,name,short_name,league,season_id) VALUES ('a','A','A','UAAP','u16'),('b','B','B','UAAP','u16'),('c','C','C','UAAP','s88'),('d','D','D','UAAP','s88');
      INSERT INTO games(id,league,season_id,home_team_id,away_team_id,status,start_time) VALUES
        ('future','UAAP','u16','a','b','UPCOMING',now() + interval '4 days'),
        ('stale','UAAP','s88','c','d','LIVE',now() - interval '80 days');`);
    await db.exec(await readFile(`supabase/migrations/${files[target]}`, "utf8"));
    const active = async () => (await db.query<{ id: string }>("SELECT id FROM seasons WHERE is_active ORDER BY id")).rows.map(r => r.id);
    assert.deepEqual(await active(), ["men", "u16"]);

    // Making S88 current through the existing RPC also marks it in progress,
    // and the previous current season stays in progress until marked finished.
    await db.query("SELECT save_sports_seasons($1)", [JSON.stringify([{ id: "s88", label: "S88", year: "s88", league: "UAAP", is_current: true }])]);
    assert.deepEqual(await active(), ["men", "s88", "u16"]);
    await db.exec("UPDATE seasons SET is_active=false WHERE id='s88'");
    assert.deepEqual(await active(), ["men", "s88", "u16"], "the current season cannot be archived");
    await db.exec("UPDATE seasons SET is_active=false WHERE id='men'");
    assert.deepEqual(await active(), ["s88", "u16"]);

    const def = (await db.query<{ d: string }>("SELECT pg_get_functiondef('public.apply_game_sync(uuid,text,text,jsonb,jsonb)'::regprocedure) d")).rows[0].d;
    assert.match(def, /is_active AND league=src\.league/);
    assert.doesNotMatch(def, /is_current AND league=src\.league/);
  } finally {
    await db.close();
  }
});
