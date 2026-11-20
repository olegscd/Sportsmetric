import assert from "node:assert/strict";
import { test } from "node:test";
import { buildTeamSchedule } from "@/lib/team-schedule";
import type { Game, GameStatus, Team } from "@/types/sports";

function makeTeam(id: string, seasonId = "uaap-s88"): Team {
  return {
    id,
    name: `Team ${id}`,
    shortName: id.toUpperCase(),
    logo: null,
    league: "UAAP",
    accentColor: "#123456",
    seasonId,
    record: { wins: 0, losses: 0 },
  };
}

const ours = makeTeam("ours");
const rivalA = makeTeam("a");
const rivalB = makeTeam("b");

function makeGame(
  id: string,
  home: Team,
  away: Team,
  status: GameStatus,
  startTime: string,
  homeScore = 0,
  awayScore = 0,
  seasonId = "uaap-s88"
): Game {
  return {
    id,
    league: "UAAP",
    homeTeam: home,
    awayTeam: away,
    homeScore,
    awayScore,
    status,
    quarterOrSet: status === "UPCOMING" ? 0 : 4,
    timeRemaining: null,
    startTime,
    boxScore: { home: [], away: [] },
    playByPlay: [],
    seasonId,
  };
}

const games: Game[] = [
  makeGame("final-old", ours, rivalA, "FINAL", "2026-09-01T10:00:00Z", 80, 70),
  makeGame("final-new", rivalB, ours, "FINAL", "2026-09-10T10:00:00Z", 90, 85),
  makeGame("final-tie", ours, rivalB, "FINAL", "2026-09-05T10:00:00Z", 2, 2),
  makeGame("up-late", ours, rivalB, "UPCOMING", "2026-10-20T10:00:00Z"),
  makeGame("up-soon", rivalA, ours, "UPCOMING", "2026-10-02T10:00:00Z"),
  makeGame("live", ours, rivalA, "LIVE", "2026-10-25T10:00:00Z", 40, 42),
  makeGame("other-teams", rivalA, rivalB, "FINAL", "2026-09-03T10:00:00Z", 60, 50),
  makeGame("other-season", ours, rivalA, "FINAL", "2025-09-03T10:00:00Z", 60, 50, "uaap-s87"),
];

test("buildTeamSchedule keeps only the team's games in its own season", () => {
  const { upcoming, completed } = buildTeamSchedule(games, ours);
  const ids = [...upcoming, ...completed].map((entry) => entry.game.id).sort();
  assert.deepEqual(ids, ["final-new", "final-old", "final-tie", "live", "up-late", "up-soon"]);
});

test("buildTeamSchedule orders live first, then upcoming soonest first", () => {
  const { upcoming } = buildTeamSchedule(games, ours);
  assert.deepEqual(upcoming.map((entry) => entry.game.id), ["live", "up-soon", "up-late"]);
  assert.ok(upcoming.every((entry) => entry.result === null));
});

test("buildTeamSchedule orders completed games latest first with results relative to the team", () => {
  const { completed } = buildTeamSchedule(games, ours);
  assert.deepEqual(completed.map((entry) => entry.game.id), ["final-new", "final-tie", "final-old"]);
  const [loss, tie, win] = completed;
  assert.equal(loss.result, "L");
  assert.equal(loss.isHome, false);
  assert.equal(loss.opponent.id, "b");
  assert.equal(loss.teamScore, 85);
  assert.equal(loss.opponentScore, 90);
  assert.equal(tie.result, "T");
  assert.equal(win.result, "W");
  assert.equal(win.isHome, true);
  assert.equal(win.teamScore, 80);
});

test("buildTeamSchedule exposes live scores from the team's side without a result", () => {
  const { upcoming } = buildTeamSchedule(games, ours);
  const live = upcoming[0];
  assert.equal(live.status, "LIVE");
  assert.equal(live.teamScore, 40);
  assert.equal(live.opponentScore, 42);
  assert.equal(live.result, null);
});

test("buildTeamSchedule returns empty groups when the team has no games", () => {
  assert.deepEqual(buildTeamSchedule(games, makeTeam("nobody")), { upcoming: [], completed: [] });
});
