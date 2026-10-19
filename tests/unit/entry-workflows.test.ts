import assert from "node:assert/strict";
import { test } from "node:test";
import { parseRosterEntry, rosterConflicts } from "@/lib/roster-entry";
import { isDraftFixture, validateFixtures, type DraftFixture } from "@/lib/schedule-builder";
import type { Game, Player, Team } from "@/types/sports";

const home: Team = { id: "home", name: "Home", shortName: "HOM", league: "UAAP", logo: null, accentColor: "#123456", seasonId: "2026", record: { wins: 0, losses: 0 } };
const away: Team = { ...home, id: "away", name: "Away", shortName: "AWY" };
const draft: DraftFixture = { id: "draft", homeTeamId: home.id, awayTeamId: away.id, date: "2026-10-20", time: "16:00", venue: "Test Arena", stage: "ELIMINATION" };

test("fixture validation rejects invalid dates, stale teams, and same-team matches before writes", () => {
  assert.deepEqual(validateFixtures([draft], [home, away], []), []);
  for (const changes of [{ date: "2026-02-30" }, { time: "25:00" }, { homeTeamId: "old-season-team" }, { awayTeamId: home.id }, { venue: " " }]) {
    assert.ok(validateFixtures([{ ...draft, ...changes }], [home, away], []).length > 0);
  }
});

test("fixture validation catches reversed duplicates and double-booked teams, with PHT conversion", () => {
  const reversed = { ...draft, id: "second", homeTeamId: away.id, awayTeamId: home.id };
  assert.match(validateFixtures([draft, reversed], [home, away], [])[0].message, /match 1/);
  const existing = { homeTeam: home, awayTeam: away, startTime: "2026-10-20T08:00:00.000Z" } as Game;
  assert.match(validateFixtures([draft], [home, away], [existing])[0].message, /already has a match/);
  assert.deepEqual(validateFixtures([{ ...draft, time: "18:00" }], [home, away], [existing]), []);
});

test("browser draft parsing rejects malformed and unexpected records", () => {
  assert.equal(isDraftFixture(draft), true);
  for (const value of [null, {}, { ...draft, homeTeamId: 123 }, { ...draft, stage: "bogus" }, { ...draft, venue: "x".repeat(501) }]) assert.equal(isDraftFixture(value), false);
});

test("roster paste supports spreadsheets, empty height columns, and names containing spaces", () => {
  const result = parseRosterEntry("Jersey,Name,Position,Height\n7, Kevin Quiambao, SF, 6-6\n10\tJD Cagulangan\tPG\t\n#12 Mike Phillips C 6-8");
  assert.deepEqual(result.issues, []);
  assert.deepEqual(result.rows.map(row => row.name), ["Kevin Quiambao", "JD Cagulangan", "Mike Phillips"]);
  assert.equal(result.rows[1].height, "");
  assert.equal(parseRosterEntry("#7 Full Name F 6-6").rows[0].position, "SF");
});

test("roster paste reports every bad line instead of silently importing a partial batch", () => {
  const result = parseRosterEntry("7, First Player, PG, 6-0\n7, Second Player, SG, 6-1\ninvalid line\n100, Third Player, C, 6-8\n8, Volleyball Player, OH, 5-9");
  assert.equal(result.rows.length, 1);
  assert.equal(result.issues.length, 4);
  assert.match(result.issues[0], /Line 2/);
  assert.match(result.issues[3], /Line 5/);
  assert.deepEqual(parseRosterEntry("0, First Player, OH,\n0, Second Player, L,", true).issues, []);
});

test("roster conflicts respect the target roster and allow unknown jersey numbers", () => {
  const existing = [{ name: "First Player", jerseyNumber: 7 }] as Player[];
  assert.equal(rosterConflicts([{ name: "first player", jerseyNumber: 0 }], existing).length, 1);
  assert.equal(rosterConflicts([{ name: "Another Player", jerseyNumber: 7 }], existing).length, 1);
  assert.deepEqual(rosterConflicts([{ name: "Another Player", jerseyNumber: 0 }], existing), []);
});
