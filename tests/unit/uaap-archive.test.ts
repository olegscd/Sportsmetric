import assert from "node:assert/strict";
import { test } from "node:test";
import archive from "../../data/uaap_archive_master.json";
import { mergeUAAPData, saveUAAPAdminOverride, type UAAPAdminOverrides } from "../../lib/uaap-data";
import { tableIntegrityIssues } from "../../lib/uaap-integrity";
import { recordSourceReview } from "../../lib/uaap-source-review";
import { archiveContentHash, preparePublicUAAPData, tablePublicationReview } from "../../lib/uaap-publication";
import { divisionExtra, leadersWithTies, makeDivisionKey, normalizeChessMedalists, resolveCellValue, toNumberOrNull,
  WIN_PCT_COLUMN, type MergedUAAPData, type UAAPArchiveExtras, type UAAPLeaderCategory, type UAAPTable } from "../../lib/uaap-schema";

const tables = archive.tables as unknown as UAAPTable[];
const extras = archive.extras as unknown as UAAPArchiveExtras;
const empty: UAAPAdminOverrides = { updated_at: "", tables_overrides: {}, standings_overrides: {}, deleted_divisions: [], extras_overrides: { awards: {}, chess_medalists: {} } };
const raw: MergedUAAPData = { tables, extras, seasons: [...new Set(tables.map(t => t.season))] };
const published = preparePublicUAAPData(raw);
const table = (season: string, sport: string, division = "Men's") => tables.find(t => t.season === season && t.sport === sport && t.division === division)!;
const order = (t: UAAPTable) => t.rows.map(r => r.team);

test("photo-checked final placements replace the confirmed erroneous orders", () => {
  assert.deepEqual(order(table("1998-1999", "Basketball")), ["DLSU", "FEU", "UE", "UST", "UP", "ADMU", "NU", "ADU"]);
  assert.deepEqual(order(table("1998-1999", "Football")), ["ADMU", "UST", "UP", "DLSU", "FEU", "UE"]);
  assert.deepEqual(order(table("2000-2001", "Basketball")), ["DLSU", "FEU", "ADMU", "UST", "UE", "UP", "NU", "ADU"]);
  assert.equal(table("2000-2001", "Basketball").columns.length, 0);
  assert.deepEqual(order(table("2003-2004", "Basketball")), ["FEU", "ADMU", "UE", "DLSU", "ADU", "UST", "UP", "NU"]);
  assert.deepEqual(order(table("2000-2001", "Fencing")), ["UE", "UP", "FEU", "DLSU", "ADMU", "UST"]);
});

test("missing divisions are recovered without conflating individual Judo matches with team standings", () => {
  assert.equal(table("2000-2001", "Basketball", "Women's").rows[0].team, "DLSU");
  assert.equal(table("2003-2004", "Basketball", "Women's").rows[0].team, "ADU");
  assert.equal(table("2003-2004", "Basketball", "Juniors").rows.length, 7);
  for (const division of ["Men's", "Women's"]) {
    const judo = table("1999-2000", "Judo", division);
    assert.equal(judo.rows.length, 6);
    assert.equal(new Set(order(judo)).size, 6);
    assert.equal(judo.columns.length, 0);
  }
});

test("original volleyball W/L values and divisions override the inaccurate transcription", () => {
  const men = table("1988-1989", "Volleyball");
  const women = table("1988-1989", "Volleyball", "Women's");
  assert.equal(men.rows[0].team, "FEU");
  assert.deepEqual(men.rows[1].values, { wins: 11, losses: 3 });
  assert.equal(women.rows[0].team, "UST");
  assert.deepEqual(women.rows[3].values, { wins: 8, losses: 6 });
  assert.equal(table("1989-1990", "Volleyball").rows[0].team, "UST");
  assert.equal(table("1989-1990", "Volleyball").columns.length, 0);
});

test("only source-reviewed awards are public and Badminton uses Kennie, not the men's Kennevic", () => {
  const bb = published.extras.awards!["Basketball|1998-1999"]["Men's"] as { mvp: { player: string } };
  assert.equal(bb.mvp.player, "Don Carlos Allado");
  const badminton = published.extras.awards!["Badminton|1998-1999"]["Women's"] as { mvp: { player: string }; rookie_of_the_year?: unknown };
  assert.equal(badminton.mvp.player, "Kennie C. Asuncion");
  assert.equal(badminton.rookie_of_the_year, undefined);
  assert.equal(published.extras.awards!["Badminton|1998-1999"]["Men's"], undefined);
  assert.ok(!JSON.stringify(published.extras).includes("Don Carlos Ailado"));
  assert.ok(!JSON.stringify(published.extras).includes('"player":""'));
});

test("scoring and qualified three-point leaders remain separate and scoped to the selected division", () => {
  const leaders = divisionExtra<Record<string, UAAPLeaderCategory>>(published.extras.leaderboards!["Basketball|2003-2004"], "Men");
  assert.equal(leaders!.scoring_average.entries[0].player, "Cardona, Mark");
  assert.equal(leaders!.scoring_average.entries[0].value, "17.9");
  assert.equal(leaders!.three_point_pct.entries[0].player, "Tang, Tyrone");
  assert.match(leaders!.three_point_pct.qualification, /12.*made/);
  assert.equal(divisionExtra(published.extras.leaderboards!["Basketball|2003-2004"], "Women's"), null);
});

test("ties survive the display cutoff and explicit co-champions pass structural checks", () => {
  const list = Array.from({ length: 12 }, (_, n) => ({ rank: n === 10 ? 10 : n + 1, player: `P${n}` }));
  assert.equal(leadersWithTies(list).length, 11);
  const co = table("1987-1988", "Lawn Tennis");
  assert.deepEqual(co.rows.map(r => r.rank), [1, 1]);
  assert.deepEqual(tableIntegrityIssues(co), []);
});

test("source conflicts are withheld while explicit board identities are retained", () => {
  const chess = published.tables.find(t => t.season === "2003-2004" && t.sport === "Chess" && t.division === "Juniors")!;
  assert.equal(chess.review?.status, "blocked");
  assert.deepEqual(chess.rows, []);
  assert.equal(normalizeChessMedalists([{ player: "Unknown board", school: "UP" }]), null);
  const boards = normalizeChessMedalists(published.extras.chess_medalists!["Chess|2003-2004"].Juniors)!;
  assert.equal(Object.keys(boards).length, 6);
  assert.equal(boards["6"][0].player, "Queseng, John");
});

test("review hashes bind exact data; remote overrides and source mismatch invalidate approvals", () => {
  const base = table("1998-1999", "Basketball");
  assert.equal(tablePublicationReview(base).status, "verified");
  const changed = structuredClone(base);
  changed.rows[0].values.wins = 999;
  assert.equal(tablePublicationReview(changed).status, "needs_review");
  const merged = mergeUAAPData(tables, extras, { ...empty, tables_overrides: { [makeDivisionKey(changed.season, changed.sport, changed.division)]: changed } });
  assert.equal(preparePublicUAAPData(merged).tables.find(t => t.season === changed.season && t.sport === changed.sport && t.division === changed.division)?.review?.status, "needs_review");
  const crossSport = structuredClone(raw);
  const key = "awards|1998-1999|Basketball|Men's";
  crossSport.extras.reviews![key].sources![0].sport = "Badminton";
  assert.equal(preparePublicUAAPData(crossSport).extras.awards!["Basketball|1998-1999"], undefined);
});

test("awards-only coverage survives while explicit division deletions remove its extras", () => {
  const withoutStandings = { ...raw, tables: tables.filter(t => !(t.season === "1998-1999" && t.sport === "Basketball")) };
  assert.ok(preparePublicUAAPData(withoutStandings).extras.awards!["Basketball|1998-1999"]["Men's"]);
  const deleted = mergeUAAPData(tables, extras, { ...empty, deleted_divisions: ["1998-1999|Basketball|Men's"] });
  assert.equal(preparePublicUAAPData(deleted).extras.awards!["Basketball|1998-1999"], undefined);
});

test("an explicit editor source review requires known original pages and binds the saved awards", () => {
  const scope = { season: "1998-1999", sport: "Basketball", division: "Men's" };
  const value = { mvp: { player: "Don Carlos Allado", school: "DLSU" } };
  assert.throws(() => recordSourceReview(value, scope, { reviewer: "", images: ["IMG_1312"], section: "Men's final results" }), /requires your name/);
  assert.throws(() => recordSourceReview(value, scope, { reviewer: "Editor", images: ["IMG_0592"], section: "Men's final results" }), /not an original source page/);
  const reviewed = { ...value, review: recordSourceReview(value, scope, { reviewer: "Editor", images: ["IMG_1312"], section: "Men's final results and awards" }) };
  const edited = structuredClone(raw);
  edited.extras.awards!["Basketball|1998-1999"]["Men's"] = reviewed;
  assert.ok(preparePublicUAAPData(edited).extras.awards!["Basketball|1998-1999"]["Men's"]);
  reviewed.mvp.player = "Changed after review";
  assert.equal(preparePublicUAAPData(edited).extras.awards!["Basketball|1998-1999"], undefined);
});

test("integrity gates reject duplicate schools and invalid records but allow source-specific schedules", async () => {
  const bad = structuredClone(table("1988-1989", "Volleyball"));
  bad.rows[1].team = "FEU";
  assert.match(tableIntegrityIssues(bad).join(" "), /Duplicate/);
  const result = await saveUAAPAdminOverride({ table: bad, expectedVersion: 0 });
  assert.equal(result.success, false);
  assert.match(result.error!, /Duplicate/);
  const football = table("1998-1999", "Football");
  assert.deepEqual(tableIntegrityIssues(football), []);
  assert.equal(resolveCellValue(football.rows[0], WIN_PCT_COLUMN), null);
  const broken = structuredClone(football);
  broken.rows[0].values.games = 12;
  assert.match(tableIntegrityIssues(broken).join(" "), /Games do not equal/);
  assert.equal(table("1998-1999", "Basketball").record_scope, "After two rounds");
});

test("null, zero, half-points and incomplete source coverage retain their meaning", () => {
  assert.equal(toNumberOrNull("  "), null);
  assert.equal(toNumberOrNull("0"), 0);
  assert.equal(toNumberOrNull(false), null);
  assert.equal(table("2000-2001", "Fencing").rows[0].values.silver, null);
  assert.equal(table("1987-1988", "Track and Field").coverage, "champion_only");
  assert.equal(table("1989-1990", "Swimming", "Women's").rows.length, 4);
  assert.equal(tables.some(t => t.season === "2002-2003"), false);
  for (const t of tables.filter(t => t.review?.status === "verified")) {
    assert.equal(archiveContentHash(t), t.review!.content_hash);
    assert.equal(tablePublicationReview(t).status, "verified", `${t.season}/${t.sport}/${t.division}`);
  }
});
