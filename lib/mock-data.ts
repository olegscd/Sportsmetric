import type {
  BoxScoreItem,
  Game,
  Player,
  PlayByPlayEvent,
  PlayByPlayEventType,
  Season,
  Team,
} from "@/types/sports";
import { buildAllTeams } from "@/lib/team-catalog";
import {
  applyPbaCommCupTeamRecords,
  hydratePbaCommCupGames,
  pbaCommCupGames,
  pbaCommCupPlayers,
  pbaCommCupTeams,
} from "@/lib/pba-comm-cup-data";
import {
  applyPbaGovCupTeamRecords,
  hydratePbaGovCupGames,
  pbaGovCupGames,
  pbaGovCupPlayers,
  pbaGovCupTeams,
} from "@/lib/pba-gov-cup-data";
import {
  applyUaapS87TeamRecords,
  hydrateUaapS87Games,
  uaapS87Games,
  uaapS87Players,
} from "@/lib/uaap-s87-data";
import {
  applyUaapS88TeamRecords,
  hydrateUaapS88Games,
  uaapS88Games,
  uaapS88Players,
} from "@/lib/uaap-s88-data";
import {
  applyUaapS89TeamRecords,
  hydrateUaapS89Games,
  uaapS89Games,
  uaapS89Players,
} from "@/lib/uaap-s89-data";
import {
  pvl2021Games,
  pvl2021Players,
  pvl2021Season,
  pvl2021Teams,
} from "@/lib/pvl-2021-data";
import {
  pvl2022OpenGames,
  pvl2022OpenPlayers,
  pvl2022OpenSeason,
  pvl2022OpenTeams,
} from "@/lib/pvl-2022-open-data";
import {
  pvl2022InvitationalGames,
  pvl2022InvitationalPlayers,
  pvl2022InvitationalSeason,
  pvl2022InvitationalTeams,
} from "@/lib/pvl-2022-invitational-data";
import {
  pvl2022ReinforcedGames,
  pvl2022ReinforcedPlayers,
  pvl2022ReinforcedSeason,
  pvl2022ReinforcedTeams,
} from "@/lib/pvl-2022-reinforced-data";

function deduplicateById<T extends { id: string }>(items: T[]): T[] {
  const seen = new Set<string>();
  const result: T[] = [];
  for (const item of items) {
    if (item && item.id && !seen.has(item.id)) {
      seen.add(item.id);
      result.push(item);
    }
  }
  return result;
}

// ---------------------------------------------------------------------------
// Seasons
// ---------------------------------------------------------------------------

/** All mock rosters/games below belong to this season. */
const CURRENT_SEASON_ID = "2025-26";

export const mockSeasons: Season[] = deduplicateById([
  { id: "2026-27", label: "2026-27 Season (UAAP S89)", isCurrent: false, league: "UAAP" },
  { id: "2025-26", label: "2025-26 Season (UAAP S88)", isCurrent: true, league: "UAAP" },
  { id: "2024-25", label: "2024-25 Season (UAAP S87)", isCurrent: false, league: "UAAP" },
  { id: "2023-24", label: "2023-24 Season", isCurrent: false, league: "UAAP" },
  {
    id: "pba-gov-cup-50",
    label: "PBA 50th Season Governors' Cup",
    isCurrent: true,
    league: "PBA",
  },
  {
    id: "pba-comm-cup-50",
    label: "PBA 50th Season Commissioner's Cup",
    isCurrent: false,
    league: "PBA",
  },
  pvl2021Season,
  pvl2022OpenSeason,
  pvl2022InvitationalSeason,
  pvl2022ReinforcedSeason,
]);

// ---------------------------------------------------------------------------
// Teams (all UAAP / PBA / PVL teams, current + previous 2 seasons)
// ---------------------------------------------------------------------------

export const mockTeams: Team[] = deduplicateById([
  ...applyUaapS89TeamRecords(applyUaapS88TeamRecords(applyUaapS87TeamRecords(buildAllTeams()))),
  ...applyPbaGovCupTeamRecords(pbaGovCupTeams),
  ...applyPbaCommCupTeamRecords(pbaCommCupTeams),
  ...pvl2021Teams,
  ...pvl2022OpenTeams,
  ...pvl2022InvitationalTeams,
  ...pvl2022ReinforcedTeams,
]);

function getTeam(id: string): Team {
  const team = mockTeams.find((t) => t.id === id);
  if (!team) throw new Error(`Unknown mock team id: ${id}`);
  return team;
}

// ---------------------------------------------------------------------------
// Players
// ---------------------------------------------------------------------------

const rawPlayers: Omit<Player, "seasonId" | "personId">[] = [];

/*
const oldRawPlayers = [
    jerseyNumber: 21,
    position: "PG",
    teamId: "up",
    height: "5'11\"",
    photoUrl: null,
    seasonAverages: {
      ppg: 13.2,
      rpg: 3.1,
      apg: 6.4,
      spg: 1.8,
      bpg: 0.2,
      fgPct: 41.5,
      threePtPct: 33.0,
      ftPct: 78.0,
    },
    rankBadges: [{ label: "#1 in APG", statKey: "apg", rank: 1, scope: "league" }],
  },
  {
    id: "up-2",
    name: "Marco Reyes",
    jerseyNumber: 11,
    position: "PF",
    teamId: "up",
    height: "6'4\"",
    photoUrl: null,
    seasonAverages: {
      ppg: 8.4,
      rpg: 6.9,
      apg: 1.2,
      spg: 0.7,
      bpg: 0.5,
      fgPct: 47.0,
      threePtPct: 22.0,
      ftPct: 65.0,
    },
    rankBadges: [{ label: "#2 in RPG (Team)", statKey: "rpg", rank: 2, scope: "team" }],
  },
  {
    id: "up-3",
    name: "Paolo Santos",
    jerseyNumber: 14,
    position: "C",
    teamId: "up",
    height: "6'7\"",
    photoUrl: null,
    seasonAverages: {
      ppg: 6.1,
      rpg: 7.5,
      apg: 0.8,
      spg: 0.4,
      bpg: 1.1,
      fgPct: 52.0,
      threePtPct: 0.0,
      ftPct: 58.0,
    },
    rankBadges: [],
  },
  // DLSU
  {
    id: "dlsu-1",
    name: "Kevin Quiambao",
    jerseyNumber: 23,
    position: "SF",
    teamId: "dlsu",
    height: "6'6\"",
    photoUrl: null,
    seasonAverages: {
      ppg: 19.8,
      rpg: 9.6,
      apg: 3.4,
      spg: 2.1,
      bpg: 0.6,
      fgPct: 46.2,
      threePtPct: 31.5,
      ftPct: 70.0,
    },
    rankBadges: [
      { label: "#1 in Efficiency", statKey: "efficiency", rank: 1, scope: "league" },
      { label: "#2 in RPG", statKey: "rpg", rank: 2, scope: "league" },
    ],
  },
  {
    id: "dlsu-2",
    name: "Enzo Villanueva",
    jerseyNumber: 4,
    position: "PG",
    teamId: "dlsu",
    height: "5'10\"",
    photoUrl: null,
    seasonAverages: {
      ppg: 10.5,
      rpg: 2.8,
      apg: 5.1,
      spg: 1.4,
      bpg: 0.1,
      fgPct: 39.8,
      threePtPct: 35.2,
      ftPct: 80.0,
    },
    rankBadges: [],
  },
  {
    id: "dlsu-3",
    name: "Rafael Cruz",
    jerseyNumber: 55,
    position: "C",
    teamId: "dlsu",
    height: "6'8\"",
    photoUrl: null,
    seasonAverages: {
      ppg: 9.2,
      rpg: 8.1,
      apg: 0.9,
      spg: 0.3,
      bpg: 1.6,
      fgPct: 54.0,
      threePtPct: 0.0,
      ftPct: 60.0,
    },
    rankBadges: [],
  },
  // Ateneo
  {
    id: "ateneo-1",
    name: "Miguel Torres",
    jerseyNumber: 32,
    position: "PF",
    teamId: "ateneo",
    height: "6'5\"",
    photoUrl: null,
    seasonAverages: {
      ppg: 12.8,
      rpg: 7.2,
      apg: 1.5,
      spg: 0.9,
      bpg: 0.7,
      fgPct: 48.5,
      threePtPct: 28.0,
      ftPct: 72.0,
    },
    rankBadges: [],
  },
  {
    id: "ateneo-2",
    name: "Diego Ramos",
    jerseyNumber: 7,
    position: "PG",
    teamId: "ateneo",
    height: "5'11\"",
    photoUrl: null,
    seasonAverages: {
      ppg: 11.0,
      rpg: 2.9,
      apg: 5.6,
      spg: 1.6,
      bpg: 0.1,
      fgPct: 40.1,
      threePtPct: 30.4,
      ftPct: 75.0,
    },
    rankBadges: [],
  },
  {
    id: "ateneo-3",
    name: "Nathan Aquino",
    jerseyNumber: 12,
    position: "SF",
    teamId: "ateneo",
    height: "6'4\"",
    photoUrl: null,
    seasonAverages: {
      ppg: 9.6,
      rpg: 4.4,
      apg: 2.0,
      spg: 1.1,
      bpg: 0.3,
      fgPct: 43.0,
      threePtPct: 33.8,
      ftPct: 68.0,
    },
    rankBadges: [],
  },
  // UST
  {
    id: "ust-1",
    name: "Julian Bautista",
    jerseyNumber: 14,
    position: "SG",
    teamId: "ust",
    height: "6'2\"",
    photoUrl: null,
    seasonAverages: {
      ppg: 14.1,
      rpg: 3.6,
      apg: 2.4,
      spg: 1.2,
      bpg: 0.2,
      fgPct: 42.9,
      threePtPct: 34.6,
      ftPct: 74.0,
    },
    rankBadges: [],
  },
  {
    id: "ust-2",
    name: "Gabriel Mendoza",
    jerseyNumber: 21,
    position: "PF",
    teamId: "ust",
    height: "6'5\"",
    photoUrl: null,
    seasonAverages: {
      ppg: 10.3,
      rpg: 6.8,
      apg: 1.1,
      spg: 0.6,
      bpg: 0.9,
      fgPct: 46.0,
      threePtPct: 20.0,
      ftPct: 61.0,
    },
    rankBadges: [],
  },
  {
    id: "ust-3",
    name: "Andres Villareal",
    jerseyNumber: 10,
    position: "PG",
    teamId: "ust",
    height: "5'9\"",
    photoUrl: null,
    seasonAverages: {
      ppg: 7.8,
      rpg: 2.2,
      apg: 4.3,
      spg: 1.0,
      bpg: 0.0,
      fgPct: 38.5,
      threePtPct: 29.1,
      ftPct: 70.0,
    },
    rankBadges: [],
  },
  // Ginebra
  {
    id: "ginebra-1",
    name: "Nate Ramos",
    jerseyNumber: 5,
    position: "PG",
    teamId: "ginebra",
    height: "6'0\"",
    photoUrl: null,
    seasonAverages: {
      ppg: 14.6,
      rpg: 3.3,
      apg: 6.1,
      spg: 1.5,
      bpg: 0.1,
      fgPct: 43.2,
      threePtPct: 36.0,
      ftPct: 82.0,
    },
    rankBadges: [],
  },
  {
    id: "ginebra-2",
    name: "Carlo Dizon",
    jerseyNumber: 8,
    position: "SF",
    teamId: "ginebra",
    height: "6'3\"",
    photoUrl: null,
    seasonAverages: {
      ppg: 12.9,
      rpg: 5.4,
      apg: 2.2,
      spg: 1.3,
      bpg: 0.4,
      fgPct: 45.0,
      threePtPct: 31.0,
      ftPct: 71.0,
    },
    rankBadges: [],
  },
  {
    id: "ginebra-3",
    name: "Miggy Fernandez",
    jerseyNumber: 44,
    position: "C",
    teamId: "ginebra",
    height: "6'9\"",
    photoUrl: null,
    seasonAverages: {
      ppg: 11.5,
      rpg: 9.8,
      apg: 1.0,
      spg: 0.5,
      bpg: 1.8,
      fgPct: 56.0,
      threePtPct: 0.0,
      ftPct: 63.0,
    },
    rankBadges: [],
  },
  // SMB
  {
    id: "smb-1",
    name: "June Mar Fajardo",
    jerseyNumber: 24,
    position: "C",
    teamId: "smb",
    height: "6'10\"",
    photoUrl: null,
    seasonAverages: {
      ppg: 16.5,
      rpg: 11.8,
      apg: 2.0,
      spg: 0.5,
      bpg: 1.4,
      fgPct: 58.9,
      threePtPct: 0.0,
      ftPct: 64.0,
    },
    rankBadges: [
      { label: "#1 in RPG", statKey: "rpg", rank: 1, scope: "league" },
      { label: "#1 in FG%", statKey: "fgPct", rank: 1, scope: "league" },
    ],
  },
  {
    id: "smb-2",
    name: "Troy Salazar",
    jerseyNumber: 6,
    position: "PG",
    teamId: "smb",
    height: "5'11\"",
    photoUrl: null,
    seasonAverages: {
      ppg: 12.0,
      rpg: 2.6,
      apg: 5.8,
      spg: 1.7,
      bpg: 0.1,
      fgPct: 41.0,
      threePtPct: 33.5,
      ftPct: 79.0,
    },
    rankBadges: [],
  },
  {
    id: "smb-3",
    name: "Rico Aguilar",
    jerseyNumber: 17,
    position: "SF",
    teamId: "smb",
    height: "6'4\"",
    photoUrl: null,
    seasonAverages: {
      ppg: 10.8,
      rpg: 5.0,
      apg: 1.8,
      spg: 1.0,
      bpg: 0.3,
      fgPct: 44.6,
      threePtPct: 29.9,
      ftPct: 69.0,
    },
    rankBadges: [],
  },
  // Magnolia
  {
    id: "magnolia-1",
    name: "Danilo Vergara",
    jerseyNumber: 9,
    position: "PG",
    teamId: "magnolia",
    height: "5'10\"",
    photoUrl: null,
    seasonAverages: {
      ppg: 13.4,
      rpg: 3.0,
      apg: 5.5,
      spg: 1.4,
      bpg: 0.1,
      fgPct: 42.0,
      threePtPct: 34.0,
      ftPct: 77.0,
    },
    rankBadges: [],
  },
  {
    id: "magnolia-2",
    name: "Erwin Castillo",
    jerseyNumber: 15,
    position: "SF",
    teamId: "magnolia",
    height: "6'3\"",
    photoUrl: null,
    seasonAverages: {
      ppg: 11.7,
      rpg: 4.8,
      apg: 2.1,
      spg: 1.1,
      bpg: 0.3,
      fgPct: 45.4,
      threePtPct: 30.6,
      ftPct: 70.0,
    },
    rankBadges: [],
  },
  {
    id: "magnolia-3",
    name: "Bien Manrique",
    jerseyNumber: 33,
    position: "C",
    teamId: "magnolia",
    height: "6'8\"",
    photoUrl: null,
    seasonAverages: {
      ppg: 9.9,
      rpg: 8.6,
      apg: 0.7,
      spg: 0.4,
      bpg: 1.2,
      fgPct: 53.0,
      threePtPct: 0.0,
      ftPct: 59.0,
    },
    rankBadges: [],
  },
  // Creamline
  {
    id: "creamline-1",
    name: "Alyssa Valdez",
    jerseyNumber: 2,
    position: "OH",
    teamId: "creamline",
    height: "5'9\"",
    photoUrl: null,
    seasonAverages: {
      ppg: 0,
      rpg: 0,
      apg: 0,
      spg: 0,
      bpg: 0,
      fgPct: 0,
      threePtPct: 0,
      ftPct: 0,
      killsPerSet: 12.4,
      digsPerSet: 3.1,
      blocksPerSet: 0.8,
    },
    rankBadges: [{ label: "#1 in Kills/Set", statKey: "killsPerSet", rank: 1, scope: "league" }],
  },
  {
    id: "creamline-2",
    name: "Rina Delgado",
    jerseyNumber: 1,
    position: "S",
    teamId: "creamline",
    height: "5'7\"",
    photoUrl: null,
    seasonAverages: {
      ppg: 0,
      rpg: 0,
      apg: 0,
      spg: 0,
      bpg: 0,
      fgPct: 0,
      threePtPct: 0,
      ftPct: 0,
      killsPerSet: 1.2,
      digsPerSet: 4.5,
      blocksPerSet: 0.3,
    },
    rankBadges: [],
  },
  {
    id: "creamline-3",
    name: "Camille Ortiz",
    jerseyNumber: 9,
    position: "MB",
    teamId: "creamline",
    height: "6'0\"",
    photoUrl: null,
    seasonAverages: {
      ppg: 0,
      rpg: 0,
      apg: 0,
      spg: 0,
      bpg: 0,
      fgPct: 0,
      threePtPct: 0,
      ftPct: 0,
      killsPerSet: 5.6,
      digsPerSet: 0.9,
      blocksPerSet: 2.1,
    },
    rankBadges: [],
  },
  // Choco Mucho
  {
    id: "chocomucho-1",
    name: "Trisha Villareal",
    jerseyNumber: 3,
    position: "OH",
    teamId: "chocomucho",
    height: "5'8\"",
    photoUrl: null,
    seasonAverages: {
      ppg: 0,
      rpg: 0,
      apg: 0,
      spg: 0,
      bpg: 0,
      fgPct: 0,
      threePtPct: 0,
      ftPct: 0,
      killsPerSet: 10.1,
      digsPerSet: 2.8,
      blocksPerSet: 0.6,
    },
    rankBadges: [],
  },
  {
    id: "chocomucho-2",
    name: "Bea Nolasco",
    jerseyNumber: 5,
    position: "S",
    teamId: "chocomucho",
    height: "5'6\"",
    photoUrl: null,
    seasonAverages: {
      ppg: 0,
      rpg: 0,
      apg: 0,
      spg: 0,
      bpg: 0,
      fgPct: 0,
      threePtPct: 0,
      ftPct: 0,
      killsPerSet: 0.9,
      digsPerSet: 3.9,
      blocksPerSet: 0.2,
    },
    rankBadges: [],
  },
  {
    id: "chocomucho-3",
    name: "Jamie Cortez",
    jerseyNumber: 11,
    position: "MB",
    teamId: "chocomucho",
    height: "5'11\"",
    photoUrl: null,
    seasonAverages: {
      ppg: 0,
      rpg: 0,
      apg: 0,
      spg: 0,
      bpg: 0,
      fgPct: 0,
      threePtPct: 0,
      ftPct: 0,
      killsPerSet: 4.8,
      digsPerSet: 0.7,
      blocksPerSet: 1.9,
    },
    rankBadges: [],
  },
  // Petro Gazz
  {
    id: "petrogazz-1",
    name: "Angeli Reyes",
    jerseyNumber: 4,
    position: "OH",
    teamId: "petrogazz",
    height: "5'8\"",
    photoUrl: null,
    seasonAverages: {
      ppg: 0,
      rpg: 0,
      apg: 0,
      spg: 0,
      bpg: 0,
      fgPct: 0,
      threePtPct: 0,
      ftPct: 0,
      killsPerSet: 9.3,
      digsPerSet: 2.4,
      blocksPerSet: 0.5,
    },
    rankBadges: [],
  },
  {
    id: "petrogazz-2",
    name: "Kim Torres",
    jerseyNumber: 7,
    position: "S",
    teamId: "petrogazz",
    height: "5'7\"",
    photoUrl: null,
    seasonAverages: {
      ppg: 0,
      rpg: 0,
      apg: 0,
      spg: 0,
      bpg: 0,
      fgPct: 0,
      threePtPct: 0,
      ftPct: 0,
      killsPerSet: 0.8,
      digsPerSet: 3.5,
      blocksPerSet: 0.3,
    },
    rankBadges: [],
  },
  {
    id: "petrogazz-3",
    name: "Nadine Cruz",
    jerseyNumber: 13,
    position: "MB",
    teamId: "petrogazz",
    height: "5'11\"",
    photoUrl: null,
    seasonAverages: {
      ppg: 0,
      rpg: 0,
      apg: 0,
      spg: 0,
      bpg: 0,
      fgPct: 0,
      threePtPct: 0,
      ftPct: 0,
      killsPerSet: 4.1,
      digsPerSet: 0.6,
      blocksPerSet: 1.7,
    },
  },
];
*/

export const mockPlayers: Player[] = deduplicateById([
  ...uaapS89Players,
  ...uaapS88Players,
  ...uaapS87Players,
  ...pbaGovCupPlayers,
  ...pbaCommCupPlayers,
  ...pvl2021Players,
  ...pvl2022OpenPlayers,
  ...pvl2022InvitationalPlayers,
  ...pvl2022ReinforcedPlayers,
]);

// ---------------------------------------------------------------------------
// Factories (deterministic - no Date.now()/Math.random() anywhere)
// ---------------------------------------------------------------------------

function statLine(
  playerId: string,
  overrides: Partial<Omit<BoxScoreItem, "playerId">> & { min: string }
): BoxScoreItem {
  return {
    playerId,
    pts: 0,
    reb: 0,
    ast: 0,
    stl: 0,
    blk: 0,
    fgM: 0,
    fgA: 0,
    ...overrides,
  };
}

function pbpFactory(gameId: string) {
  let seq = 0;
  return (
    period: number,
    timestamp: string,
    description: string,
    type: PlayByPlayEventType,
    currentScore: { home: number; away: number },
    scoringTeamId: string | null = null
  ): PlayByPlayEvent => {
    seq += 1;
    return {
      id: `${gameId}-pbp-${seq}`,
      timestamp,
      period,
      description,
      scoringTeamId,
      currentScore,
      type,
    };
  };
}

// ---------------------------------------------------------------------------
// Games
// ---------------------------------------------------------------------------

export const mockGames: Game[] = deduplicateById([
  ...hydrateUaapS89Games(uaapS89Games, mockTeams),
  ...hydrateUaapS88Games(uaapS88Games, mockTeams),
  ...hydrateUaapS87Games(uaapS87Games, mockTeams),
  ...hydratePbaGovCupGames(pbaGovCupGames, mockTeams),
  ...hydratePbaCommCupGames(pbaCommCupGames, mockTeams),
  ...pvl2021Games,
  ...pvl2022OpenGames,
  ...pvl2022InvitationalGames,
  ...pvl2022ReinforcedGames,
]);

function pushGame(game: Omit<Game, "seasonId">): void {
  // Official season imports drive UAAP & PVL games.
  if (game.league !== "UAAP" && game.league !== "PVL") {
    mockGames.push({ ...game, seasonId: CURRENT_SEASON_ID });
  }
}

// g01 - UAAP - LIVE - UP vs DLSU
{
  const p = pbpFactory("g01");
  pushGame({
    id: "g01",
    league: "UAAP",
    homeTeam: getTeam("up"),
    awayTeam: getTeam("dlsu"),
    homeScore: 58,
    awayScore: 64,
    status: "LIVE",
    quarterOrSet: 3,
    timeRemaining: "05:42",
    startTime: "2026-07-29T10:00:00+08:00",
    venue: "Mall of Asia Arena",
    playByPlay: [
      p(1, "10:00", "Tip-off won by DLSU", "PERIOD_END", { home: 0, away: 0 }),
      p(1, "07:12", "Kevin Quiambao 3PT jumper made", "3PT_MADE", { home: 0, away: 3 }, "dlsu"),
      p(1, "05:48", "JD Cagulangan driving layup made", "FG_MADE", { home: 2, away: 3 }, "up"),
      p(2, "09:30", "Kevin Quiambao dunk made", "FG_MADE", { home: 20, away: 27 }, "dlsu"),
      p(2, "04:15", "JD Cagulangan 3PT jumper made", "3PT_MADE", { home: 30, away: 34 }, "up"),
      p(3, "08:20", "Rafael Cruz defensive rebound", "REBOUND", { home: 46, away: 51 }, "dlsu"),
      p(3, "06:37", "Marco Reyes jumper made", "FG_MADE", { home: 50, away: 53 }, "up"),
      p(3, "05:42", "Enzo Villanueva 3PT jumper made", "3PT_MADE", { home: 58, away: 64 }, "dlsu"),
    ],
    boxScore: {
      home: [
        statLine("up-1", { pts: 18, reb: 4, ast: 7, stl: 2, blk: 0, fgM: 6, fgA: 12, threeM: 2, threeA: 5, ftM: 4, ftA: 4, min: "24:10" }),
        statLine("up-2", { pts: 11, reb: 8, ast: 1, stl: 1, blk: 1, fgM: 5, fgA: 9, min: "21:30" }),
        statLine("up-3", { pts: 8, reb: 9, ast: 0, stl: 0, blk: 2, fgM: 4, fgA: 7, min: "19:45" }),
      ],
      away: [
        statLine("dlsu-1", { pts: 24, reb: 11, ast: 4, stl: 3, blk: 1, fgM: 9, fgA: 15, threeM: 2, threeA: 4, ftM: 4, ftA: 6, min: "26:05" }),
        statLine("dlsu-2", { pts: 15, reb: 3, ast: 6, stl: 2, blk: 0, fgM: 5, fgA: 10, threeM: 3, threeA: 6, min: "23:15" }),
        statLine("dlsu-3", { pts: 10, reb: 10, ast: 1, stl: 0, blk: 2, fgM: 5, fgA: 8, min: "20:50" }),
      ],
    },
  });
}

// g02 - PBA - LIVE - Ginebra vs SMB
{
  const p = pbpFactory("g02");
  pushGame({
    id: "g02",
    league: "PBA",
    homeTeam: getTeam("ginebra"),
    awayTeam: getTeam("smb"),
    homeScore: 96,
    awayScore: 101,
    status: "LIVE",
    quarterOrSet: 4,
    timeRemaining: "02:15",
    startTime: "2026-07-29T19:00:00+08:00",
    venue: "Smart Araneta Coliseum",
    playByPlay: [
      p(3, "06:40", "June Mar Fajardo hook shot made", "FG_MADE", { home: 70, away: 78 }, "smb"),
      p(3, "02:12", "Nate Ramos 3PT jumper made", "3PT_MADE", { home: 78, away: 82 }, "ginebra"),
      p(4, "09:05", "Carlo Dizon and-one layup made", "FG_MADE", { home: 85, away: 88 }, "ginebra"),
      p(4, "05:33", "June Mar Fajardo defensive rebound", "REBOUND", { home: 90, away: 95 }, "smb"),
      p(4, "03:40", "Miggy Fernandez putback dunk made", "FG_MADE", { home: 94, away: 97 }, "ginebra"),
      p(4, "02:15", "Troy Salazar 3PT jumper made", "3PT_MADE", { home: 96, away: 101 }, "smb"),
    ],
    boxScore: {
      home: [
        statLine("ginebra-1", { pts: 22, reb: 4, ast: 8, stl: 2, blk: 0, fgM: 8, fgA: 16, threeM: 3, threeA: 7, ftM: 3, ftA: 4, min: "32:20" }),
        statLine("ginebra-2", { pts: 19, reb: 7, ast: 3, stl: 2, blk: 1, fgM: 7, fgA: 14, threeM: 2, threeA: 5, min: "30:10" }),
        statLine("ginebra-3", { pts: 16, reb: 12, ast: 1, stl: 0, blk: 3, fgM: 7, fgA: 11, min: "28:45" }),
      ],
      away: [
        statLine("smb-1", { pts: 28, reb: 15, ast: 3, stl: 1, blk: 2, fgM: 12, fgA: 18, ftM: 4, ftA: 7, min: "33:50" }),
        statLine("smb-2", { pts: 20, reb: 3, ast: 9, stl: 2, blk: 0, fgM: 7, fgA: 13, threeM: 3, threeA: 6, min: "31:15" }),
        statLine("smb-3", { pts: 15, reb: 6, ast: 2, stl: 1, blk: 0, fgM: 6, fgA: 12, threeM: 1, threeA: 4, min: "27:30" }),
      ],
    },
  });
}

// g03 - PVL - LIVE - Creamline vs Choco Mucho (sets tied 1-1, playing set 3)
{
  const p = pbpFactory("g03");
  pushGame({
    id: "g03",
    league: "PVL",
    homeTeam: getTeam("creamline"),
    awayTeam: getTeam("chocomucho"),
    homeScore: 1,
    awayScore: 1,
    status: "LIVE",
    quarterOrSet: 3,
    timeRemaining: null,
    startTime: "2026-07-29T16:00:00+08:00",
    venue: "PhilSports Arena",
    playByPlay: [
      p(1, "Set 1", "Creamline wins Set 1, 25-20", "PERIOD_END", { home: 25, away: 20 }, "creamline"),
      p(2, "Set 2", "Choco Mucho wins Set 2, 25-22", "PERIOD_END", { home: 22, away: 25 }, "chocomucho"),
      p(3, "Set 3", "Alyssa Valdez kill", "KILL", { home: 6, away: 4 }, "creamline"),
      p(3, "Set 3", "Trisha Villareal service ace", "SERVE_ACE", { home: 9, away: 8 }, "chocomucho"),
      p(3, "Set 3", "Camille Ortiz block point", "BLOCK_POINT", { home: 15, away: 12 }, "creamline"),
      p(3, "Set 3", "Alyssa Valdez kill", "KILL", { home: 18, away: 15 }, "creamline"),
    ],
    boxScore: {
      home: [
        statLine("creamline-1", { pts: 21, reb: 5, ast: 0, stl: 0, blk: 2, fgM: 18, fgA: 32, min: "3 sets" }),
        statLine("creamline-2", { pts: 3, reb: 7, ast: 32, stl: 4, blk: 0, fgM: 2, fgA: 3, min: "3 sets" }),
        statLine("creamline-3", { pts: 9, reb: 1, ast: 0, stl: 1, blk: 5, fgM: 7, fgA: 10, min: "3 sets" }),
      ],
      away: [
        statLine("chocomucho-1", { pts: 17, reb: 4, ast: 0, stl: 1, blk: 1, fgM: 15, fgA: 29, min: "3 sets" }),
        statLine("chocomucho-2", { pts: 2, reb: 6, ast: 28, stl: 3, blk: 0, fgM: 1, fgA: 2, min: "3 sets" }),
        statLine("chocomucho-3", { pts: 8, reb: 1, ast: 0, stl: 0, blk: 4, fgM: 6, fgA: 9, min: "3 sets" }),
      ],
    },
  });
}

// g04 - UAAP - UPCOMING - Ateneo vs UST
pushGame({
  id: "g04",
  league: "UAAP",
  homeTeam: getTeam("ateneo"),
  awayTeam: getTeam("ust"),
  homeScore: 0,
  awayScore: 0,
  status: "UPCOMING",
  quarterOrSet: 0,
  timeRemaining: null,
  startTime: "2026-08-02T14:00:00+08:00",
  venue: "Filoil EcoOil Centre",
  playByPlay: [],
  boxScore: { home: [], away: [] },
});

// g05 - PBA - UPCOMING - Magnolia vs Ginebra
pushGame({
  id: "g05",
  league: "PBA",
  homeTeam: getTeam("magnolia"),
  awayTeam: getTeam("ginebra"),
  homeScore: 0,
  awayScore: 0,
  status: "UPCOMING",
  quarterOrSet: 0,
  timeRemaining: null,
  startTime: "2026-08-03T19:00:00+08:00",
  venue: "Ynares Center Antipolo",
  playByPlay: [],
  boxScore: { home: [], away: [] },
});

// g06 - PVL - UPCOMING - Petro Gazz vs Creamline
pushGame({
  id: "g06",
  league: "PVL",
  homeTeam: getTeam("petrogazz"),
  awayTeam: getTeam("creamline"),
  homeScore: 0,
  awayScore: 0,
  status: "UPCOMING",
  quarterOrSet: 0,
  timeRemaining: null,
  startTime: "2026-08-04T16:00:00+08:00",
  venue: "FilOil EcoOil Centre",
  playByPlay: [],
  boxScore: { home: [], away: [] },
});

// g07 - UAAP - UPCOMING - DLSU vs Ateneo
pushGame({
  id: "g07",
  league: "UAAP",
  homeTeam: getTeam("dlsu"),
  awayTeam: getTeam("ateneo"),
  homeScore: 0,
  awayScore: 0,
  status: "UPCOMING",
  quarterOrSet: 0,
  timeRemaining: null,
  startTime: "2026-08-05T14:00:00+08:00",
  venue: "Mall of Asia Arena",
  playByPlay: [],
  boxScore: { home: [], away: [] },
});

// g08 - UAAP - FINAL - DLSU vs UST
{
  const p = pbpFactory("g08");
  pushGame({
    id: "g08",
    league: "UAAP",
    homeTeam: getTeam("dlsu"),
    awayTeam: getTeam("ust"),
    homeScore: 82,
    awayScore: 70,
    status: "FINAL",
    quarterOrSet: 4,
    timeRemaining: null,
    startTime: "2026-07-22T14:00:00+08:00",
    venue: "Mall of Asia Arena",
    playByPlay: [
      p(1, "00:00", "End of Q1", "PERIOD_END", { home: 22, away: 18 }),
      p(2, "00:00", "End of Q2", "PERIOD_END", { home: 44, away: 36 }),
      p(3, "00:00", "End of Q3", "PERIOD_END", { home: 64, away: 52 }),
      p(4, "03:10", "Kevin Quiambao dunk made", "FG_MADE", { home: 78, away: 64 }, "dlsu"),
      p(4, "00:00", "Final buzzer", "PERIOD_END", { home: 82, away: 70 }),
    ],
    boxScore: {
      home: [
        statLine("dlsu-1", { pts: 26, reb: 12, ast: 5, stl: 3, blk: 1, fgM: 10, fgA: 17, threeM: 2, threeA: 5, ftM: 4, ftA: 5, min: "32:00" }),
        statLine("dlsu-2", { pts: 18, reb: 3, ast: 8, stl: 2, blk: 0, fgM: 6, fgA: 12, threeM: 4, threeA: 8, min: "30:00" }),
        statLine("dlsu-3", { pts: 12, reb: 11, ast: 1, stl: 0, blk: 3, fgM: 6, fgA: 9, min: "24:00" }),
      ],
      away: [
        statLine("ust-1", { pts: 21, reb: 4, ast: 3, stl: 1, blk: 0, fgM: 8, fgA: 17, threeM: 3, threeA: 7, ftM: 2, ftA: 2, min: "31:00" }),
        statLine("ust-2", { pts: 15, reb: 9, ast: 1, stl: 0, blk: 1, fgM: 6, fgA: 13, min: "27:00" }),
        statLine("ust-3", { pts: 10, reb: 3, ast: 6, stl: 2, blk: 0, fgM: 4, fgA: 9, min: "26:00" }),
      ],
    },
  });
}

// g09 - UAAP - FINAL - UP vs Ateneo
{
  const p = pbpFactory("g09");
  pushGame({
    id: "g09",
    league: "UAAP",
    homeTeam: getTeam("up"),
    awayTeam: getTeam("ateneo"),
    homeScore: 71,
    awayScore: 75,
    status: "FINAL",
    quarterOrSet: 4,
    timeRemaining: null,
    startTime: "2026-07-20T14:00:00+08:00",
    venue: "Filoil EcoOil Centre",
    playByPlay: [
      p(1, "00:00", "End of Q1", "PERIOD_END", { home: 16, away: 19 }),
      p(2, "00:00", "End of Q2", "PERIOD_END", { home: 33, away: 38 }),
      p(3, "00:00", "End of Q3", "PERIOD_END", { home: 54, away: 58 }),
      p(4, "01:05", "JD Cagulangan 3PT jumper made", "3PT_MADE", { home: 69, away: 73 }, "up"),
      p(4, "00:00", "Final buzzer", "PERIOD_END", { home: 71, away: 75 }),
    ],
    boxScore: {
      home: [
        statLine("up-1", { pts: 20, reb: 3, ast: 9, stl: 2, blk: 0, fgM: 7, fgA: 15, threeM: 3, threeA: 7, ftM: 3, ftA: 4, min: "33:00" }),
        statLine("up-2", { pts: 15, reb: 10, ast: 1, stl: 1, blk: 1, fgM: 6, fgA: 11, min: "29:00" }),
        statLine("up-3", { pts: 9, reb: 8, ast: 0, stl: 0, blk: 2, fgM: 4, fgA: 8, min: "22:00" }),
      ],
      away: [
        statLine("ateneo-1", { pts: 19, reb: 9, ast: 2, stl: 1, blk: 1, fgM: 8, fgA: 14, threeM: 1, threeA: 3, ftM: 2, ftA: 3, min: "30:00" }),
        statLine("ateneo-2", { pts: 17, reb: 3, ast: 7, stl: 2, blk: 0, fgM: 6, fgA: 12, threeM: 2, threeA: 5, min: "31:00" }),
        statLine("ateneo-3", { pts: 14, reb: 5, ast: 2, stl: 1, blk: 0, fgM: 6, fgA: 11, threeM: 2, threeA: 4, min: "26:00" }),
      ],
    },
  });
}

// g10 - PBA - FINAL - SMB vs Magnolia
{
  const p = pbpFactory("g10");
  pushGame({
    id: "g10",
    league: "PBA",
    homeTeam: getTeam("smb"),
    awayTeam: getTeam("magnolia"),
    homeScore: 108,
    awayScore: 99,
    status: "FINAL",
    quarterOrSet: 4,
    timeRemaining: null,
    startTime: "2026-07-18T19:00:00+08:00",
    venue: "Smart Araneta Coliseum",
    playByPlay: [
      p(1, "00:00", "End of Q1", "PERIOD_END", { home: 28, away: 24 }),
      p(2, "00:00", "End of Q2", "PERIOD_END", { home: 55, away: 50 }),
      p(3, "00:00", "End of Q3", "PERIOD_END", { home: 82, away: 75 }),
      p(4, "02:30", "June Mar Fajardo hook shot made", "FG_MADE", { home: 102, away: 92 }, "smb"),
      p(4, "00:00", "Final buzzer", "PERIOD_END", { home: 108, away: 99 }),
    ],
    boxScore: {
      home: [
        statLine("smb-1", { pts: 30, reb: 16, ast: 4, stl: 1, blk: 2, fgM: 13, fgA: 19, ftM: 4, ftA: 6, min: "34:00" }),
        statLine("smb-2", { pts: 22, reb: 4, ast: 10, stl: 3, blk: 0, fgM: 8, fgA: 15, threeM: 4, threeA: 7, min: "32:00" }),
        statLine("smb-3", { pts: 18, reb: 6, ast: 2, stl: 1, blk: 0, fgM: 7, fgA: 13, threeM: 2, threeA: 5, min: "28:00" }),
      ],
      away: [
        statLine("magnolia-1", { pts: 21, reb: 3, ast: 8, stl: 2, blk: 0, fgM: 8, fgA: 16, threeM: 3, threeA: 6, min: "31:00" }),
        statLine("magnolia-2", { pts: 19, reb: 5, ast: 3, stl: 1, blk: 0, fgM: 7, fgA: 14, threeM: 2, threeA: 5, min: "29:00" }),
        statLine("magnolia-3", { pts: 16, reb: 10, ast: 1, stl: 0, blk: 2, fgM: 7, fgA: 11, min: "26:00" }),
      ],
    },
  });
}

// g11 - PVL - FINAL - Choco Mucho def. Petro Gazz, 3-1
{
  const p = pbpFactory("g11");
  pushGame({
    id: "g11",
    league: "PVL",
    homeTeam: getTeam("chocomucho"),
    awayTeam: getTeam("petrogazz"),
    homeScore: 3,
    awayScore: 1,
    status: "FINAL",
    quarterOrSet: 4,
    timeRemaining: null,
    startTime: "2026-07-15T16:00:00+08:00",
    venue: "PhilSports Arena",
    playByPlay: [
      p(1, "Set 1", "Choco Mucho wins Set 1, 25-18", "PERIOD_END", { home: 25, away: 18 }, "chocomucho"),
      p(2, "Set 2", "Petro Gazz wins Set 2, 25-23", "PERIOD_END", { home: 23, away: 25 }, "petrogazz"),
      p(3, "Set 3", "Choco Mucho wins Set 3, 25-20", "PERIOD_END", { home: 25, away: 20 }, "chocomucho"),
      p(4, "Set 4", "Trisha Villareal match-winning kill", "KILL", { home: 25, away: 21 }, "chocomucho"),
    ],
    boxScore: {
      home: [
        statLine("chocomucho-1", { pts: 19, reb: 6, ast: 0, stl: 2, blk: 1, fgM: 17, fgA: 30, min: "4 sets" }),
        statLine("chocomucho-2", { pts: 3, reb: 8, ast: 35, stl: 4, blk: 0, fgM: 2, fgA: 3, min: "4 sets" }),
        statLine("chocomucho-3", { pts: 10, reb: 2, ast: 0, stl: 1, blk: 6, fgM: 8, fgA: 12, min: "4 sets" }),
      ],
      away: [
        statLine("petrogazz-1", { pts: 16, reb: 5, ast: 0, stl: 1, blk: 1, fgM: 14, fgA: 27, min: "4 sets" }),
        statLine("petrogazz-2", { pts: 2, reb: 7, ast: 30, stl: 3, blk: 0, fgM: 1, fgA: 2, min: "4 sets" }),
        statLine("petrogazz-3", { pts: 9, reb: 1, ast: 0, stl: 0, blk: 5, fgM: 7, fgA: 10, min: "4 sets" }),
      ],
    },
  });
}

// g12 - PBA - FINAL - Ginebra vs Magnolia
{
  const p = pbpFactory("g12");
  pushGame({
    id: "g12",
    league: "PBA",
    homeTeam: getTeam("ginebra"),
    awayTeam: getTeam("magnolia"),
    homeScore: 94,
    awayScore: 89,
    status: "FINAL",
    quarterOrSet: 4,
    timeRemaining: null,
    startTime: "2026-07-12T19:00:00+08:00",
    venue: "Smart Araneta Coliseum",
    playByPlay: [
      p(1, "00:00", "End of Q1", "PERIOD_END", { home: 24, away: 21 }),
      p(2, "00:00", "End of Q2", "PERIOD_END", { home: 48, away: 44 }),
      p(3, "00:00", "End of Q3", "PERIOD_END", { home: 70, away: 66 }),
      p(4, "01:48", "Nate Ramos 3PT jumper made", "3PT_MADE", { home: 91, away: 86 }, "ginebra"),
      p(4, "00:00", "Final buzzer", "PERIOD_END", { home: 94, away: 89 }),
    ],
    boxScore: {
      home: [
        statLine("ginebra-1", { pts: 24, reb: 5, ast: 9, stl: 2, blk: 0, fgM: 9, fgA: 17, threeM: 4, threeA: 8, ftM: 2, ftA: 2, min: "33:00" }),
        statLine("ginebra-2", { pts: 20, reb: 8, ast: 3, stl: 2, blk: 1, fgM: 8, fgA: 15, threeM: 2, threeA: 5, min: "31:00" }),
        statLine("ginebra-3", { pts: 14, reb: 13, ast: 1, stl: 0, blk: 3, fgM: 6, fgA: 10, min: "27:00" }),
      ],
      away: [
        statLine("magnolia-1", { pts: 22, reb: 3, ast: 7, stl: 1, blk: 0, fgM: 8, fgA: 16, threeM: 3, threeA: 6, min: "32:00" }),
        statLine("magnolia-2", { pts: 18, reb: 4, ast: 2, stl: 1, blk: 0, fgM: 7, fgA: 13, threeM: 2, threeA: 4, min: "28:00" }),
        statLine("magnolia-3", { pts: 15, reb: 9, ast: 0, stl: 0, blk: 2, fgM: 6, fgA: 10, min: "25:00" }),
      ],
    },
  });
}
