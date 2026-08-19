import type { Game, Player, Team } from "@/types/sports";


/** UAAP Season 89 (2026-27) upcoming/unplayed games */
export const uaapS89Games: Game[] = [];

/** UAAP Season 89 (2026-27) players */
export const uaapS89Players: Player[] = [];

/** W-L records for Season 89 (empty) */
export const uaapS89TeamRecords: Record<string, { wins: number; losses: number }> = {};

export function applyUaapS89TeamRecords(teams: Team[]): Team[] {
  return teams;
}

export function hydrateUaapS89Games(games: Game[], teams: Team[]): Game[] {
  const byId = new Map(teams.map((t) => [t.id, t]));
  return games.map((game) => ({
    ...game,
    homeTeam: byId.get(game.homeTeam.id) ?? game.homeTeam,
    awayTeam: byId.get(game.awayTeam.id) ?? game.awayTeam,
  }));
}
