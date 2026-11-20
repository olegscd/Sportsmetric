import assert from "node:assert/strict";
import { test } from "node:test";
import { derivePlayerAverages } from "@/lib/derivations";
import { describeGameMargin, summarizeTeamBoxScore } from "@/lib/game-overview";
import { resolveShellScope } from "@/lib/shell-scope";
import { exportStatTiles } from "@/lib/stat-card";
import type { BoxScoreItem, Game, Player, SeasonAverages, Team } from "@/types/sports";

const baseAverages: SeasonAverages = {
  ppg: 0,
  rpg: 0,
  apg: 0,
  spg: 0,
  bpg: 0,
  fgPct: 0,
  threePtPct: 0,
  ftPct: 0,
};

const pvlTeam: Team = {
  id: "pvl-home",
  name: "PVL Home",
  shortName: "PVH",
  logo: null,
  league: "PVL",
  accentColor: "#112233",
  seasonId: "pvl-2026",
  record: { wins: 3, losses: 1 },
};

const pvlAway: Team = {
  ...pvlTeam,
  id: "pvl-away",
  name: "PVL Away",
  shortName: "PVA",
};

const uaapTeam: Team = {
  ...pvlTeam,
  id: "uaap-home",
  name: "UAAP Home",
  shortName: "HOM",
  league: "UAAP",
  seasonId: "2025-26",
};

const uaapAway: Team = {
  ...uaapTeam,
  id: "uaap-away",
  name: "UAAP Away",
  shortName: "AWY",
};

test("derivePlayerAverages preserves extended PVL fields when box scores exist", () => {
  const player: Player = {
    id: "pvl-p1",
    personId: "pvl-p1",
    name: "Alyssa Sample",
    jerseyNumber: 2,
    position: "OH",
    teamId: pvlTeam.id,
    height: "5'9\"",
    photoUrl: null,
    seasonId: pvlTeam.seasonId,
    rankBadges: [],
    seasonAverages: {
      ...baseAverages,
      setsPlayed: 42,
      avgPerSet: 4.8,
      avgAtk: 4.1,
      avgDig: 2.6,
      efficiencyAtk: 34.5,
      killsPerSet: 4.1,
      digsPerSet: 2.6,
      blocksPerSet: 0.4,
    },
  };

  const games: Game[] = [
    {
      id: "pvl-g1",
      league: "PVL",
      seasonId: pvlTeam.seasonId,
      homeTeam: pvlTeam,
      awayTeam: pvlAway,
      homeScore: 3,
      awayScore: 1,
      status: "FINAL",
      startTime: "2026-10-20T10:00:00Z",
      quarterOrSet: 4,
      timeRemaining: null,
      playByPlay: [],
      stage: "ELIMINATION",
      isPlayoff: false,
      boxScore: {
        home: [
          {
            playerId: player.id,
            pts: 22,
            reb: 11,
            ast: 2,
            stl: 1,
            blk: 2,
            fgM: 18,
            fgA: 40,
            min: "0:00",
          },
        ],
        away: [],
      },
    },
  ];

  const derived = derivePlayerAverages(player, games, [pvlTeam, pvlAway], [player]);
  assert.equal(derived.ppg, 22);
  assert.equal(derived.rpg, 11);
  assert.equal(derived.fgPct, 45);
  assert.equal(derived.setsPlayed, 42);
  assert.equal(derived.avgPerSet, 4.8);
  assert.equal(derived.avgAtk, 4.1);
  assert.equal(derived.avgDig, 2.6);
  assert.equal(derived.efficiencyAtk, 34.5);
});

test("exportStatTiles prefers supplied derived averages across basketball and volleyball positions", () => {
  const zeroPlayer = (position: Player["position"]): Player => ({
    id: `p-${position}`,
    personId: `p-${position}`,
    name: `Player ${position}`,
    jerseyNumber: 7,
    position,
    teamId: uaapTeam.id,
    height: "",
    photoUrl: null,
    seasonId: uaapTeam.seasonId,
    rankBadges: [],
    seasonAverages: { ...baseAverages },
  });

  const pgTiles = exportStatTiles(zeroPlayer("PG"), {
    ...baseAverages,
    ppg: 18.4,
    rpg: 4.2,
    apg: 6.5,
    threePtPct: 39.1,
  });
  assert.deepEqual(pgTiles, [
    { label: "PPG", value: "18.4" },
    { label: "RPG", value: "4.2" },
    { label: "APG", value: "6.5" },
    { label: "3P%", value: "39.1%" },
  ]);

  const ohTiles = exportStatTiles(zeroPlayer("OH"), {
    ...baseAverages,
    avgPerSet: 4.7,
    avgAtk: 3.9,
    efficiencyAtk: 31.2,
  });
  assert.deepEqual(ohTiles, [
    { label: "PTS / Set", value: "4.7" },
    { label: "Kills / Set", value: "3.9" },
    { label: "Atk Efficiency", value: "31.2%" },
  ]);

  const mbTiles = exportStatTiles(zeroPlayer("MB"), {
    ...baseAverages,
    avgPerSet: 3.1,
    avgBlk: 0.9,
    efficiencyAtk: 28.4,
  });
  assert.deepEqual(mbTiles, [
    { label: "PTS / Set", value: "3.1" },
    { label: "Blocks / Set", value: "0.9" },
    { label: "Atk Efficiency", value: "28.4%" },
  ]);

  const setterTiles = exportStatTiles(zeroPlayer("S"), {
    ...baseAverages,
    avgSet: 6.8,
    successSet: 27.5,
    avgDig: 2.1,
  });
  assert.deepEqual(setterTiles, [
    { label: "Sets / Set", value: "6.8" },
    { label: "Setting %", value: "27.5%" },
    { label: "Digs / Set", value: "2.1" },
  ]);

  const liberoTiles = exportStatTiles(zeroPlayer("L"), {
    ...baseAverages,
    avgDig: 4.3,
    successDig: 55.2,
    successRec: 49.8,
  });
  assert.deepEqual(liberoTiles, [
    { label: "Digs / Set", value: "4.3" },
    { label: "Dig Success", value: "55.2%" },
    { label: "Rec Success", value: "49.8%" },
  ]);
});

test("describeGameMargin distinguishes scheduled, tied, live, and final margins", () => {
  const base = {
    startTime: "2026-10-20T10:00:00Z",
    league: "UAAP" as const,
    homeTeam: uaapTeam,
    awayTeam: uaapAway,
  };

  assert.equal(
    describeGameMargin({ ...base, status: "UPCOMING", homeScore: 0, awayScore: 0 }),
    "Scheduled matchup"
  );
  assert.equal(
    describeGameMargin({ ...base, status: "LIVE", homeScore: 54, awayScore: 54 }),
    "Tied game"
  );
  assert.equal(
    describeGameMargin({ ...base, status: "LIVE", homeScore: 61, awayScore: 68 }),
    "AWY leads by 7"
  );
  assert.equal(
    describeGameMargin({ ...base, status: "FINAL", homeScore: 82, awayScore: 75 }),
    "HOM won by 7"
  );
});

test("summarizeTeamBoxScore totals stats and handles zero-attempt shooting safely", () => {
  const rows: BoxScoreItem[] = [
    {
      playerId: "p1",
      pts: 15,
      reb: 4,
      ast: 6,
      stl: 2,
      blk: 1,
      to: 3,
      fgM: 5,
      fgA: 10,
      threeM: 2,
      threeA: 5,
      ftM: 3,
      ftA: 4,
      min: "28:00",
    },
    {
      playerId: "p2",
      pts: 9,
      reb: 7,
      ast: 1,
      stl: 0,
      blk: 2,
      to: 1,
      fgM: 4,
      fgA: 11,
      threeM: 1,
      threeA: 4,
      ftM: 0,
      ftA: 0,
      min: "22:00",
    },
  ];

  assert.deepEqual(summarizeTeamBoxScore(rows), {
    pts: 24,
    reb: 11,
    ast: 7,
    stl: 2,
    blk: 3,
    to: 4,
    fgM: 9,
    fgA: 21,
    fgPct: 42.9,
    threeM: 3,
    threeA: 9,
    threePtPct: 33.3,
    ftM: 3,
    ftA: 4,
    ftPct: 75,
  });

  assert.deepEqual(summarizeTeamBoxScore([]), {
    pts: 0,
    reb: 0,
    ast: 0,
    stl: 0,
    blk: 0,
    to: 0,
    fgM: 0,
    fgA: 0,
    fgPct: 0,
    threeM: 0,
    threeA: 0,
    threePtPct: 0,
    ftM: 0,
    ftA: 0,
    ftPct: 0,
  });
});

test("resolveShellScope scopes metadata, admin, detail, league, and default routes", () => {
  for (const path of [
    "/about",
    "/international",
    "/athletes/carlos-yulo",
    "/admin/updater",
    "/uaap",
    "/news",
    "/news/some-slug",
  ]) {
    const resolved = resolveShellScope(path, false);
    assert.deepEqual(resolved.scope, { metadata: true });
    assert.equal(resolved.query, "metadata=1");
  }

  // /admin/updater stays metadata-only even for authenticated admins.
  assert.deepEqual(resolveShellScope("/admin/updater", true).scope, { metadata: true });
  assert.deepEqual(resolveShellScope("/admin", false).scope, { metadata: true });
  assert.deepEqual(resolveShellScope("/admin", true).scope, { admin: true });

  assert.deepEqual(resolveShellScope("/players/pba-2026-p1", false), {
    kind: "player",
    id: "pba-2026-p1",
    scope: { playerId: "pba-2026-p1" },
    query: "player=pba-2026-p1",
  });
  assert.deepEqual(resolveShellScope("/teams/pvl-2026-home", false), {
    kind: "team",
    id: "pvl-2026-home",
    scope: { teamId: "pvl-2026-home" },
    query: "team=pvl-2026-home",
  });
  assert.deepEqual(resolveShellScope("/leagues/pba", false), {
    kind: "league",
    league: "PBA",
    scope: { league: "PBA" },
    query: "league=PBA",
  });

  for (const path of ["/", "/standings", "/teams", "/players"]) {
    const resolved = resolveShellScope(path, false);
    assert.deepEqual(resolved.scope, { league: "UAAP" });
    assert.equal(resolved.query, "league=UAAP");
  }
});
