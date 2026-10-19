import { PGlite } from "@electric-sql/pglite";
import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { test } from "node:test";

test("migrations, atomic mutations, archive concurrency and session privacy", async t => {
  const db = new PGlite();
  try {
    await db.exec("CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role BYPASSRLS; CREATE PUBLICATION supabase_realtime; CREATE SCHEMA auth; CREATE FUNCTION auth.role() RETURNS text LANGUAGE sql AS $$ SELECT current_user::text $$;");
    const migrate = async (file: string) => db.exec(await readFile(`supabase/migrations/${file}`, "utf8"));
    for (const file of (await readdir("supabase/migrations")).sort()) {
      if (file.endsWith(".sql") && file < "20261019000200") await migrate(file);
    }
    await db.query("INSERT INTO seasons(id,label,is_current) VALUES ('2025','Old',true),('2026','New',true)");
    await db.query("INSERT INTO uaap_overrides(id,payload) VALUES ('default',$1)", [JSON.stringify({
      tables_overrides: { "2025|Basketball|Men's": { season: "2025", sport: "Basketball", division: "Men's", rows: [] } },
      deleted_divisions: ["2025|Chess|Women's"],
      extras_overrides: { awards: { "Basketball|2025": { "Men's": { mvp: { player: "Original" } } } } },
    })]);
    await migrate("20261019000200_sessions_and_atomic_writes.sql");
    await migrate("20261019000300_division_overrides.sql");

    await t.test("backfills league and resolves duplicate currents", async () => {
      const { rows } = await db.query<{ league: string; n: number }>("SELECT league,count(*)::int n FROM seasons WHERE is_current GROUP BY league");
      assert.deepEqual(rows, [{ league: "UAAP", n: 1 }]);
      await assert.rejects(db.query("UPDATE seasons SET is_current=true WHERE id='2025'"), /unique constraint/);
      await db.query("SELECT save_sports_seasons($1)", [JSON.stringify([
        { id: "2025", label: "Old", year: "2025", league: "UAAP", is_current: true },
        { id: "2026", label: "New", year: "2026", league: "UAAP", is_current: false },
      ])]);
      assert.equal((await db.query<{ id: string }>("SELECT id FROM seasons WHERE is_current")).rows[0].id, "2025");
    });

    await t.test("migrates tables, extras, and deletion tombstones", async () => {
      const { rows } = await db.query<{ payload: { awards: { mvp: { player: string } }; deleted: boolean } }>(
        "SELECT payload FROM uaap_division_overrides WHERE sport='Basketball'");
      assert.equal(rows[0].payload.awards.mvp.player, "Original");
      assert.equal((await db.query<{ payload: { deleted: boolean } }>("SELECT payload FROM uaap_division_overrides WHERE sport='Chess'")).rows[0].payload.deleted, true);
    });

    await t.test("division CAS rejects stale saves and preserves other divisions", async () => {
      const sql = "SELECT save_uaap_division($1,$2,$3,$4,$5)";
      await db.query(sql, ["2025", "Basketball", "Men's", { awards: { mvp: { player: "New" } } }, 1]);
      await assert.rejects(db.query(sql, ["2025", "Basketball", "Men's", { deleted: true }, 1]), /another editor/);
      await db.query(sql, ["2026", "Volleyball", "Women's", { deleted: false }, 0]);
      await assert.rejects(db.query(sql, ["2026", "Volleyball", "Women's", {}, 0]), /another editor/);
      assert.equal((await db.query("SELECT * FROM uaap_division_overrides")).rows.length, 3);
    });

    await db.exec("INSERT INTO teams(id,name,short_name,league,season_id) VALUES ('a','A','A','UAAP','2025'),('b','B','B','UAAP','2025'),('c','C','C','UAAP','2025');");
    const record = async (id: string) => (await db.query<{ record: { wins: number; losses: number } }>("SELECT record FROM teams WHERE id=$1", [id])).rows[0].record;
    await t.test("game writes recompute old and new teams and exclude playoffs", async () => {
      await db.exec("INSERT INTO games(id,league,season_id,home_team_id,away_team_id,home_score,away_score,status) VALUES ('g1','UAAP','2025','a','b',10,5,'FINAL');");
      assert.deepEqual(await record("a"), { wins: 1, losses: 0 });
      await db.exec("UPDATE games SET away_team_id='c' WHERE id='g1'");
      assert.deepEqual(await record("b"), { wins: 0, losses: 0 });
      assert.deepEqual(await record("c"), { wins: 0, losses: 1 });
      await db.exec("UPDATE games SET stage='FINALS',is_playoff=true WHERE id='g1'");
      assert.deepEqual(await record("a"), { wins: 0, losses: 0 });
      await db.exec("UPDATE games SET stage='ELIMINATION',is_playoff=false WHERE id='g1'");
    });

    await t.test("team deletion with games fails without removing players", async () => {
      await db.exec("INSERT INTO players(id,person_id,name,team_id,season_id,jersey_number) VALUES ('p1','p1','Player','a','2025',1)");
      await assert.rejects(db.query("SELECT delete_sports_team('a')"), /still has games/);
      assert.equal((await db.query("SELECT id FROM players WHERE id='p1'")).rows.length, 1);
      await db.query("SELECT delete_sports_team('b')");
      assert.equal((await db.query("SELECT id FROM teams WHERE id='b'")).rows.length, 0);
    });

    await t.test("season deletion rolls back on a mid-delete error", async () => {
      await db.exec(`CREATE FUNCTION fail_player_delete() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'test failure'; END; $$;
        CREATE TRIGGER fail_delete BEFORE DELETE ON players FOR EACH ROW EXECUTE FUNCTION fail_player_delete();`);
      await assert.rejects(db.query("SELECT delete_sports_season('2025')"), /test failure/);
      assert.equal((await db.query("SELECT id FROM games WHERE id='g1'")).rows.length, 1);
      assert.equal((await db.query("SELECT id FROM seasons WHERE id='2025'")).rows.length, 1);
      await db.exec("DROP TRIGGER fail_delete ON players");
      await db.query("SELECT delete_sports_season('2025')");
      for (const table of ["seasons", "teams", "players", "games"]) {
        const column = table === "seasons" ? "id" : "season_id";
        assert.equal((await db.query(`SELECT * FROM ${table} WHERE ${column}='2025'`)).rows.length, 0);
      }
    });

    await t.test("sessions are not readable by public roles", async () => {
      await db.exec("SET ROLE anon");
      try { await assert.rejects(db.query("SELECT * FROM admin_sessions"), /permission denied/); }
      finally { await db.exec("RESET ROLE"); }
      await db.exec("SET ROLE authenticated");
      try { await assert.rejects(db.query("SELECT delete_sports_season('2026')"), /permission denied/); }
      finally { await db.exec("RESET ROLE"); }
    });
  } finally { await db.close(); }
});
