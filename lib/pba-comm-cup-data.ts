import type { Game, Player, Team } from "@/types/sports";
import pbaCommCupImport from "@/scripts/generated/pba-comm-cup-import.json";

type PbaSeasonImport = {
  seasonId: string;
  games: Game[];
  players: Player[];
  teams: Team[];
  teamRecords: Record<string, { wins: number; losses: number }>;
};

const data = pbaCommCupImport as PbaSeasonImport;

export const PBA_COMM_CUP_SEASON_ID = data.seasonId;

/** PBA 50th Season Commissioner's Cup teams (includes Macau Black Bears). */
export const pbaCommCupTeams: Team[] = data.teams;

/** Commissioner's Cup games with full box scores. */
export const pbaCommCupGames: Game[] = data.games;

/** Commissioner's Cup players with computed season averages. */
export const pbaCommCupPlayers: Player[] = data.players;

export const pbaCommCupTeamRecords = data.teamRecords;

export function applyPbaCommCupTeamRecords(teams: Team[]): Team[] {
  return teams.map((team) => {
    const record = pbaCommCupTeamRecords[team.id];
    return record ? { ...team, record } : team;
  });
}

export function hydratePbaCommCupGames(games: Game[], teams: Team[]): Game[] {
  const byId = new Map(teams.map((t) => [t.id, t]));
  return games.map((game) => ({
    ...game,
    homeTeam: byId.get(game.homeTeam.id) ?? game.homeTeam,
    awayTeam: byId.get(game.awayTeam.id) ?? game.awayTeam,
  }));
}
