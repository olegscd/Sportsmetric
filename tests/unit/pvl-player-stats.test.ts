import assert from "node:assert/strict";
import { test } from "node:test";
import {
  emptyCounts, parseLeaderConferences, parseLeaderTable, pvlSlugCandidates, recordFromRows,
  rowFromPlayerApi, type PvlConferenceStatRow,
} from "@/lib/pvl-player-stats";
import { collectPvlConferenceStats, type PvlFetcher } from "@/lib/pvl-player-stats-sync";

const apiLine = (slug: string, competitionId: number, atk: number) => ({
  slug, competitionId: String(competitionId), firstName: "Savannah Dawn", lastName: "Davison", jersey_number: "6",
  position: "OH", height: "173CM", school: "Oklahoma", teamName: "PLDT HIGH SPEED HITTERS",
  setsPlayed: "29", AtkPoint: String(atk), AtkFault: "41", AtkCont: "234", BlkPoint: "15", BlkCont: "31", BlkFault: "21",
  SrvPoint: "5", SrvFault: "11", SrvCont: "75", DigCont: "64", DigExcel: "74", DigFault: "45",
  SetExcel: "0", SetFault: "0", SetCont: "13", RecExcel: "127", RecCont: "141", RecFault: "15",
});

test("player lines map official columns; attempts are point + continue + fault", () => {
  const row = rowFromPlayerApi("savannah-dawn-davison", 21, "2026 All Filipino Conference", apiLine("savannah-dawn-davison", 21, 132))!;
  assert.equal(row.player_name, "Savannah Dawn Davison"); assert.equal(row.jersey, 6); assert.equal(row.team, "PLDT HIGH SPEED HITTERS");
  assert.equal(row.stats.setsPlayed, 29); assert.equal(row.stats.ptsAtk, 132); assert.equal(row.stats.totalAtk, 132 + 234 + 41);
  assert.equal(row.stats.totalRec, 127 + 141 + 15); assert.equal(row.stats.exeDig, 74);
  // A response for another player or conference is never stored.
  assert.equal(rowFromPlayerApi("someone-else", 21, "x", apiLine("savannah-dawn-davison", 21, 132)), null);
  assert.equal(rowFromPlayerApi("savannah-dawn-davison", 18, "x", apiLine("savannah-dawn-davison", 21, 132)), null);
});

const row = (conference: number, stats: Partial<ReturnType<typeof emptyCounts>>): PvlConferenceStatRow => ({
  player_slug: "alyssa-eroa", conference_id: conference, conference_name: "Conf " + conference, player_name: "Alyssa Eroa",
  team: "Team", position: "L", jersey: 16, height: null, school: null, stats: { ...emptyCounts(), ...stats },
});

test("averages, success and efficiency are derived; the career line sums every conference", () => {
  const record = recordFromRows([row(17, { setsPlayed: 20, exeRec: 50, faultRec: 5, totalRec: 100, ptsAtk: 4, totalAtk: 10 }), row(18, { setsPlayed: 35, exeRec: 97, faultRec: 12, totalRec: 196, exeDig: 126, totalDig: 278 })])!;
  assert.deepEqual(record.conferences.map(c => c.conferenceId), [18, 17]);
  const latest = record.conferences[0];
  // Matches the "Efficiency%" pvl.ph prints for receivers: (97 - 12) / 196.
  assert.equal(latest.efficiencyRec, 43.37); assert.equal(latest.successRec, 49.49); assert.equal(latest.avgRec, 2.77);
  assert.equal(record.career!.setsPlayed, 55); assert.equal(record.career!.exeRec, 147); assert.equal(record.career!.totalRec, 296);
  assert.equal(record.career!.totalPoints, 4); assert.equal(record.career!.statType, "career");
  assert.equal(recordFromRows([]), null);
});

const leaderRow = (slug: string, values: number[]) =>
  `<tr><th scope="row">1</th><td><a href="https://pvl.ph/players/${slug}"><img alt="x"></a><a href="https://pvl.ph/players/${slug}">NAME</a></td>${values.map(v => `<td>${v}</td>`).join("")}</tr>`;
const table = (rows: string) => `<table id="record-table"><tbody id="stats">${rows}</tbody></table>`;
const leadersPage = `<select id="selectedConferenceId"><option value="21" selected>2026 All Filipino Conference</option><option value="18">2026 All Filipino Conference</option></select>` + table(leaderRow("a-one", [10, 2, 1, 13]));

test("leader pages list conferences and players without a hand-kept list", () => {
  assert.deepEqual(parseLeaderConferences(leadersPage), [{ id: 21, name: "2026 All Filipino Conference", selected: true }, { id: 18, name: "2026 All Filipino Conference", selected: false }]);
  assert.deepEqual(parseLeaderTable(table(leaderRow("a-one", [10, 2, 1, 13]) + leaderRow("a-one", [1, 1, 1, 1]) + leaderRow("b-two", [43.37, 1, 2, 3]))),
    [{ slug: "a-one", values: [10, 2, 1, 13] }, { slug: "b-two", values: [43.37, 1, 2, 3] }]);
  assert.deepEqual(parseLeaderTable("<p>Stay tuned</p>"), []);
});

function fakeFetcher(lines: Record<string, number>): PvlFetcher & { calls: string[] } {
  const calls: string[] = [];
  return {
    calls,
    async get(url) {
      calls.push("GET " + url);
      if (url === "https://pvl.ph/leaders") return leadersPage;
      if (url === "https://pvl.ph/leaders/scorers") return table(leaderRow("a-one", [10, 15, 5, 30]) + leaderRow("b-two", [7, 15, 5, 27]));
      return table(leaderRow("c-three", [1, 0, 0, 1]));
    },
    async post(url, form) {
      calls.push("POST " + url);
      if (url.endsWith("-conference-filter")) return "<p>Stay tuned</p>";
      if (!(form.playerslug in lines)) return "false";
      return JSON.stringify(apiLine(form.playerslug, Number(form.conferenceId), lines[form.playerslug]));
    },
  };
}

test("a conference refresh discovers players from every leader table and cross-checks the scorers", async () => {
  const fetcher = fakeFetcher({ "a-one": 10, "b-two": 7, "c-three": 1 });
  const result = await collectPvlConferenceStats(fetcher, undefined, 2);
  assert.equal(result.conference.id, 21);
  assert.deepEqual(result.rows.map(r => r.player_slug).sort(), ["a-one", "b-two", "c-three"]);
  // The conference in progress reads the leader pages, not the filter endpoint.
  assert.ok(fetcher.calls.includes("GET https://pvl.ph/leaders/scorers"));
  assert.ok(!fetcher.calls.some(c => c.startsWith("POST https://pvl.ph/scorer-conference-filter")));

  // One drifting line is skipped with a warning; widespread drift aborts.
  const drift = await collectPvlConferenceStats(fakeFetcher({ "a-one": 99, "b-two": 7, "c-three": 1 }));
  assert.deepEqual(drift.rows.map(r => r.player_slug).sort(), ["b-two", "c-three"]);
  assert.match(drift.warnings.join(), /a-one: player line disagrees/);
  await assert.rejects(collectPvlConferenceStats(fakeFetcher({})), /do not match/);
  await assert.rejects(collectPvlConferenceStats(fakeFetcher({ "a-one": 10 }), 99), /not listed/);
});

test("site players resolve to official slugs: exact ids and name before trailing parts", () => {
  assert.deepEqual(pvlSlugCandidates("kat-tolentino", "pvl-2026-cmf-kat-tolentino", "Kat Tolentino"),
    ["kat-tolentino", "pvl-2026-cmf-kat-tolentino", "2026-cmf-kat-tolentino", "cmf-kat-tolentino"]);
  assert.deepEqual(pvlSlugCandidates("", "", ""), []);
});
