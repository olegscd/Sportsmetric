import assert from "node:assert/strict";
import { test } from "node:test";
import { parseBasketballGamePage } from "@/lib/game-extractor";
import { basketballBox } from "@/lib/game-sync/sources";
import { swapPlays, toPlayByPlayEvents } from "@/lib/play-by-play";
import type { SyncSource } from "@/lib/game-sync/types";

const source: SyncSource = { id: "uaap-s89-men", league: "UAAP", season_id: "uaap-s89-men", label: "UAAP", tournament_url: "https://uaap.livestats.ph/tournaments/uaap-season-89-men-s-basketball", year: 2026, starts_on: "2026-09-01", ends_on: "2027-02-28", conference_id: null, enabled: true };

// Mirrors the LiveStats markup: newest play first, score only on scoring plays.
const play = (team: 1 | 2, kind: string, extra: string, period: number, clock: string, text: string, score?: string) =>
  `<div id="${clock}" class="pbpa pbpt${team} pbpty${kind} per_p${period} ${extra}"><div class="team X"><div class="time"><span class="period"> P${period} </span> ${clock} ${score ? `<span class="score"> ${score} </span>` : ""}</div><div class="action"><strong> Name </strong> ${text} </div></div></div>`;
const plays = [
  play(2, "shot", "jump_shot shot", 2, "05:10", "B Guard 3PT Jump Shot (A Wing Assist)", "3 - 5"),
  play(1, "free_throw", "free_throw", 2, "06:00", "A Center Free Throw 2 of 2 MISSED"),
  play(1, "free_throw", "free_throw", 2, "06:00", "A Center Free Throw 1 of 2 MADE", "3 - 2"),
  play(2, "foul", "shooting foul", 2, "06:00", "B Big Foul (Shooting) on A Center"),
  play(2, "turnover", "bad_pass turnover", 1, "00:30", "B Guard Turnover (Bad Pass) (A Wing STL)"),
  play(1, "shot", "layup shot", 1, "09:40", "A Wing 2PT Layup", "2 - 0"),
  play(2, "shot", "jump_shot shot", 1, "09:50", "MISS B Guard 2PT Jump Shot"),
  play(1, "jump_ball", "jump_ball", 1, "10:00", "Jump Ball won"),
].join("");
const box = (title: string, score: number, player: string, pts: number) =>
  `<div class="box-score_title">${title} ${title} (M) Coach:</div><div class="boxscorewrap"><table><tbody><tr><td>7</td><td>${player}</td><td>20:00</td><td>${pts}</td><td>${pts}</td></tr><tr class="team-totals"><td></td><td></td><td></td><td></td><td>${score}</td></tr></tbody></table></div>`;
const page = (first: [string, number], second: [string, number], body = plays) =>
  box(first[0], first[1], "A Wing", first[1]) + box(second[0], second[1], "B Guard", second[1]) + `<div id="playbyplay">${body}</div>`;

test("LiveStats play-by-play is chronological with the running score carried forward", () => {
  const parsed = parseBasketballGamePage(page(["LA SALLE", 3], ["ADU", 5]), "UAAP");
  const pbp = parsed.playByPlay!;
  assert.deepEqual(pbp.map(p => p.type), ["FG_MISSED", "FG_MADE", "TURNOVER", "FOUL", "FT_MADE", "FT_MISSED", "3PT_MADE"]);
  assert.deepEqual(pbp.map(p => p.period), [1, 1, 1, 2, 2, 2, 2]);
  assert.equal(pbp[0].timestamp, "09:50");
  assert.equal(pbp[0].description, "MISS B Guard 2PT Jump Shot");
  assert.deepEqual(pbp.map(p => [p.score.home, p.score.away]), [[0, 0], [2, 0], [2, 0], [2, 0], [3, 2], [3, 2], [3, 5]]);
  assert.deepEqual(pbp.map(p => p.scoring), [false, true, false, false, true, false, true]);

  const events = toPlayByPlayEvents(pbp, "dlsu", "adu");
  assert.deepEqual(events.map(e => e.scoringTeamId), [null, "dlsu", null, null, "dlsu", null, "adu"]);
  assert.equal(new Set(events.map(e => e.id)).size, events.length);
  assert.deepEqual(events.at(-1)!.currentScore, { home: 3, away: 5 });
});

test("plays follow the box score orientation, and a reordered page is detected", () => {
  // The page lists ADU first, but the plays still use LA SALLE as team 1.
  const reordered = parseBasketballGamePage(page(["ADU", 5], ["LA SALLE", 3]), "UAAP").playByPlay!;
  assert.deepEqual(reordered.at(-1)!.score, { home: 5, away: 3 });
  assert.equal(reordered.at(-1)!.side, "home");
  assert.deepEqual(swapPlays(reordered).at(-1)!.score, { home: 3, away: 5 });

  // Sync orients plays with the box to the index card's home/away.
  const html = page(["LA SALLE", 3], ["ADU", 5]);
  const same = basketballBox(html, source, "LA SALLE", "ADU", null)!;
  const flipped = basketballBox(html, source, "ADU", "LA SALLE", null)!;
  assert.equal(same.home[0].playerName, "A Wing"); assert.equal(flipped.home[0].playerName, "B Guard");
  assert.deepEqual(same.playByPlay!.at(-1)!.score, { home: 3, away: 5 });
  assert.deepEqual(flipped.playByPlay!.at(-1)!.score, { home: 5, away: 3 });
  assert.equal(flipped.playByPlay!.at(-1)!.side, "home");
});

test("pages without play-by-play yield no plays", () => {
  assert.deepEqual(parseBasketballGamePage(page(["LA SALLE", 3], ["ADU", 5], ""), "UAAP").playByPlay, []);
  assert.deepEqual(toPlayByPlayEvents(undefined, "h", "a"), []);
});
