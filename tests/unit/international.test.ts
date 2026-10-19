import { PGlite } from "@electric-sql/pglite";
import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { test } from "node:test";
import {
  athleteFromRow, athleteToRow, formatResultHeadline, ordinal, parseStats, selectTopPerformers, slugify, sortResultsNewestFirst,
  type IntlAthlete, type IntlCompetition, type IntlResult,
} from "../../lib/international";
import { normalizeIntlAthlete, normalizeIntlResult } from "../../lib/international-validation";
import { BUNDLED_ATHLETE_PHOTOS, withBundledAthletePhoto } from "../../lib/international-photos";

const baseResult: IntlResult = {
  id: "r1", athleteId: "ej-obiena", competitionId: "wc-2023", event: "Men's pole vault", representation: "national_team",
  represented: "Philippines", resultType: "placement", placement: 2, fieldSize: 12, medal: "silver", markValue: null,
  markUnit: null, stats: null, scope: "Final", resultDate: "2023-08-26", sourceUrl: "https://example.org/r",
  sourcePublisher: null, reviewedAt: null, notes: null, published: true,
};

test("international result formatting", () => {
  assert.equal(ordinal(1), "1st"); assert.equal(ordinal(12), "12th"); assert.equal(ordinal(23), "23rd"); assert.equal(ordinal(111), "111th");
  assert.equal(formatResultHeadline(baseResult), "Silver · 2nd of 12");
  assert.equal(formatResultHeadline({ ...baseResult, resultType: "mark", medal: null, placement: null, markValue: 6.1, markUnit: "m" }), "6.1 m");
  assert.equal(formatResultHeadline({ ...baseResult, resultType: "ranking", medal: null, placement: 54 }), "No. 54");
  assert.equal(formatResultHeadline({ ...baseResult, resultType: "stat_line", medal: null, stats: { gp: 30, ppg: 12.4 } }), "30 GP · 12.4 PPG");
  assert.deepEqual(parseStats("gp=30, ppg=12.4\nrole=Starter"), { gp: 30, ppg: 12.4, role: "Starter" });
  assert.equal(parseStats("  "), null);
  assert.throws(() => parseStats("ppg"), /name=value/);
  assert.equal(slugify("Ernest John Obiena"), "ernest-john-obiena");
  assert.equal(slugify("Ålex Éala!"), "alex-eala");
});

test("results sort newest first using competition dates when the result has none", () => {
  const comps = new Map<string, IntlCompetition>([
    ["a", { id: "a", name: "A", sport: "X", level: "other", hostCountry: null, season: null, startDate: "2024-01-01", endDate: "2024-01-05", sourceUrl: null }],
  ]);
  const sorted = sortResultsNewestFirst([{ ...baseResult, id: "old", resultDate: "2023-01-01" }, { ...baseResult, id: "new", competitionId: "a", resultDate: null }], comps);
  assert.deepEqual(sorted.map(r => r.id), ["new", "old"]);
});

test("top performers rank by weighted medals, then golds and podiums", () => {
  const athlete = (id: string, name: string): IntlAthlete => ({
    id, name, sports: ["Sport"], filipinoConnection: "citizen", connectionNote: null,
    connectionSourceUrl: "https://example.org/bio", personId: null, photoUrl: null,
    photoCredit: null, photoLicense: null, photoSourceUrl: null, bio: null,
    coverageNote: null, published: true, reviewedAt: null,
  });
  const medal = (id: string, athleteId: string, color: IntlResult["medal"], date: string, placement = 1): IntlResult =>
    ({ ...baseResult, id, athleteId, medal: color, placement, resultDate: date });
  const athletes = [
    athlete("yulo", "Carlos Yulo"), athlete("diaz", "Hidilyn Diaz"), athlete("petecio", "Nesthy Petecio"),
    athlete("obiena", "EJ Obiena"), athlete("villegas", "Aira Villegas"), athlete("rookie", "New Athlete"),
  ];
  const results = [
    medal("y1", "yulo", "gold", "2024-08-03"), medal("y2", "yulo", "gold", "2024-08-04"),
    medal("d1", "diaz", "gold", "2021-07-26"),
    medal("p1", "petecio", "silver", "2021-08-03", 2), medal("p2", "petecio", "bronze", "2024-08-07", 3),
    medal("o1", "obiena", "silver", "2023-08-26", 2), medal("v1", "villegas", "bronze", "2024-08-06", 3),
  ];

  const { top, rest } = selectTopPerformers(athletes, results, 3);
  assert.deepEqual(top.map(p => p.athlete.id), ["yulo", "diaz", "petecio"]);
  assert.deepEqual(rest.map(p => p.athlete.id), ["obiena", "villegas", "rookie"]);
  assert.equal(top[0].medalPoints, 6);
  assert.equal(top[0].medals.gold, 2);
  assert.equal(top[2].medalPoints, 3);
  assert.equal(top[2].medals.gold, 0);
  assert.equal(top[2].bestResult?.id, "p1");
  assert.equal(top[2].latestResult?.id, "p2");
  assert.equal(rest[2].results.length, 0);
});

test("bundled athlete portraits are local and fully attributed", () => {
  for (const [id, photo] of Object.entries(BUNDLED_ATHLETE_PHOTOS)) {
    assert.match(id, /^[a-z0-9-]+$/);
    assert.match(photo.photoUrl, /^\/athletes\/[a-z0-9-]+\.jpg$/);
    assert.ok(photo.photoCredit.trim(), id);
    assert.ok(photo.photoLicense.trim(), id);
    assert.match(photo.photoSourceUrl, /^https:\/\/commons\.wikimedia\.org\/wiki\/File:/);
  }
  const athlete: IntlAthlete = {
    id: "carlos-yulo", name: "Carlos Yulo", sports: ["Artistic Gymnastics"], filipinoConnection: "citizen",
    connectionNote: null, connectionSourceUrl: "https://example.org/bio", personId: null, photoUrl: null,
    photoCredit: null, photoLicense: null, photoSourceUrl: null, bio: null, coverageNote: null, published: true, reviewedAt: null,
  };
  assert.equal(withBundledAthletePhoto(athlete).photoUrl, "/athletes/carlos-yulo.jpg");
  const databasePhoto = withBundledAthletePhoto({ ...athlete, photoUrl: "/athletes/custom.jpg", photoCredit: "Editor",
    photoLicense: "Permission", photoSourceUrl: "https://example.org/photo" });
  assert.equal(databasePhoto.photoUrl, "/athletes/custom.jpg");
  assert.equal(databasePhoto.photoCredit, "Editor");
});

test("validation requires sources and type-specific fields", () => {
  const athlete = { id: "ej-obiena", name: "EJ Obiena", sports: ["Athletics"], filipinoConnection: "citizen", connectionSourceUrl: "https://example.org/bio" };
  assert.equal(normalizeIntlAthlete(athlete).id, "ej-obiena");
  assert.throws(() => normalizeIntlAthlete({ ...athlete, connectionSourceUrl: "" }), /Connection source is required/);
  assert.throws(() => normalizeIntlAthlete({ ...athlete, connectionSourceUrl: "http://example.org" }), /https/);
  assert.throws(() => normalizeIntlAthlete({ ...athlete, id: "EJ Obiena" }), /lowercase/);
  assert.throws(() => normalizeIntlAthlete({ ...athlete, filipinoConnection: "surname" }), /Filipino connection/);
  const photo = { ...athlete, photoUrl: "/images/athletes/ej-obiena.jpg" };
  assert.throws(() => normalizeIntlAthlete(photo), /photo needs a credit/i);
  assert.throws(() => normalizeIntlAthlete({ ...photo, photoCredit: "Jane Doe / Wikimedia Commons" }), /license/i);
  assert.throws(() => normalizeIntlAthlete({ ...photo, photoCredit: "Jane Doe / Wikimedia Commons", photoLicense: "CC BY-SA 4.0" }), /source link/i);
  assert.throws(() => normalizeIntlAthlete({ ...photo, photoCredit: "Jane Doe / Wikimedia Commons", photoLicense: "CC BY-SA 4.0",
    photoSourceUrl: "http://commons.wikimedia.org/wiki/File:Example.jpg" }), /https/);
  const withPhoto = normalizeIntlAthlete({ ...photo, photoCredit: "Jane Doe / Wikimedia Commons", photoLicense: "CC BY-SA 4.0",
    photoSourceUrl: "https://commons.wikimedia.org/wiki/File:Example.jpg" });
  assert.equal(withPhoto.photoUrl, "/images/athletes/ej-obiena.jpg");
  assert.equal(withPhoto.photoCredit, "Jane Doe / Wikimedia Commons");
  assert.equal(withPhoto.photoLicense, "CC BY-SA 4.0");
  assert.equal(athleteFromRow(athleteToRow(withPhoto)).photoSourceUrl, "https://commons.wikimedia.org/wiki/File:Example.jpg");
  assert.equal(normalizeIntlAthlete({ ...athlete, photoCredit: "Stale", photoLicense: "Stale", photoSourceUrl: "https://example.org/photo" }).photoCredit, null);
  assert.equal(normalizeIntlResult(baseResult).placement, 2);
  assert.throws(() => normalizeIntlResult({ ...baseResult, placement: null }), /finishing position/);
  assert.throws(() => normalizeIntlResult({ ...baseResult, resultType: "mark", markValue: 6 }), /unit/);
  assert.throws(() => normalizeIntlResult({ ...baseResult, resultType: "stat_line", stats: {} }), /at least one stat/);
  assert.throws(() => normalizeIntlResult({ ...baseResult, placement: 13 }), /field size/);
  assert.throws(() => normalizeIntlResult({ ...baseResult, sourceUrl: "javascript:alert(1)" }), /https/);
});

test("international migration hides drafts from the public and enforces sources", async () => {
  const db = new PGlite();
  try {
    await db.exec("CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role BYPASSRLS; CREATE PUBLICATION supabase_realtime; CREATE SCHEMA auth; CREATE FUNCTION auth.role() RETURNS text LANGUAGE sql AS $$ SELECT current_user::text $$;");
    for (const file of (await readdir("supabase/migrations")).sort()) {
      if (file.endsWith(".sql")) await db.exec(await readFile(`supabase/migrations/${file}`, "utf8"));
    }
    await db.exec(`
      INSERT INTO intl_athletes(id,name,filipino_connection,connection_source_url,published) VALUES
        ('pub','Published','citizen','https://example.org/a',true), ('draft','Draft','heritage','https://example.org/b',false);
      INSERT INTO intl_competitions(id,name,sport,level) VALUES ('wc','World Champs','Athletics','world_championship');
      INSERT INTO intl_results(id,athlete_id,competition_id,event,representation,represented,result_type,placement,source_url,published) VALUES
        ('r-pub','pub','wc','Pole vault','national_team','Philippines','placement',3,'https://example.org/r',true),
        ('r-draft','pub','wc','Pole vault','national_team','Philippines','placement',4,'https://example.org/r',false),
        ('r-hidden-athlete','draft','wc','100m','national_team','Philippines','placement',5,'https://example.org/r',true);`);
    await assert.rejects(db.exec("INSERT INTO intl_athletes(id,name,filipino_connection,connection_source_url) VALUES ('x','X','citizen','http://insecure')"), /check constraint/);
    await assert.rejects(db.exec("UPDATE intl_athletes SET photo_url='https://example.org/p.jpg' WHERE id='pub'"), /check constraint/);
    await assert.rejects(db.exec("UPDATE intl_athletes SET photo_url='https://example.org/p.jpg', photo_credit='Jane Doe', photo_license='CC BY 4.0', photo_source_url='http://example.org/p' WHERE id='pub'"), /check constraint/);
    await db.exec("UPDATE intl_athletes SET photo_url='https://example.org/p.jpg', photo_credit='Jane Doe', photo_license='CC BY 4.0', photo_source_url='https://example.org/p' WHERE id='pub'");
    await assert.rejects(db.exec("INSERT INTO intl_results(id,athlete_id,competition_id,event,representation,represented,result_type,source_url) VALUES ('bad','pub','wc','E','club','C','placement','https://e.org')"), /check constraint/);
    await assert.rejects(db.exec("DELETE FROM intl_competitions WHERE id='wc'"), /foreign key/);

    await db.exec("SET ROLE anon");
    try {
      assert.deepEqual((await db.query<{ id: string }>("SELECT id FROM intl_athletes ORDER BY id")).rows.map(r => r.id), ["pub"]);
      assert.deepEqual((await db.query<{ id: string }>("SELECT id FROM intl_results ORDER BY id")).rows.map(r => r.id), ["r-pub"]);
      await assert.rejects(db.exec("INSERT INTO intl_competitions(id,name,sport,level) VALUES ('y','Y','Y','other')"), /permission denied/);
    } finally { await db.exec("RESET ROLE"); }

    await db.exec("DELETE FROM intl_athletes WHERE id='pub'");
    assert.equal((await db.query("SELECT id FROM intl_results WHERE athlete_id='pub'")).rows.length, 0);
  } finally {
    await db.close();
  }
});
