import type { Game, Player, Team } from "@/types/sports";
import pbaGovCupImport from "@/scripts/generated/pba-gov-cup-import.json";

type PbaSeasonImport = {
  seasonId: string;
  games: Game[];
  players: Player[];
  teams: Team[];
  teamRecords: Record<string, { wins: number; losses: number }>;
};

const data = pbaGovCupImport as PbaSeasonImport;

export const PBA_GOV_CUP_SEASON_ID = data.seasonId;

/** PBA 50th Season Governors' Cup teams (includes Macau guest team). */
export const pbaGovCupTeams: Team[] = data.teams;

/** Governors' Cup games with full box scores. */
export const pbaGovCupGames: Game[] = data.games;

/** Governors' Cup players with computed season averages. */
export const pbaGovCupPlayers: Player[] = data.players;

export const pbaGovCupTeamRecords = data.teamRecords;

export function applyPbaGovCupTeamRecords(teams: Team[]): Team[] {
  return teams.map((team) => {
    const record = pbaGovCupTeamRecords[team.id];
    return record ? { ...team, record } : team;
  });
}

export function hydratePbaGovCupGames(games: Game[], teams: Team[]): Game[] {
  const byId = new Map(teams.map((t) => [t.id, t]));
  return games.map((game) => ({
    ...game,
    homeTeam: byId.get(game.homeTeam.id) ?? game.homeTeam,
    awayTeam: byId.get(game.awayTeam.id) ?? game.awayTeam,
  }));
}
