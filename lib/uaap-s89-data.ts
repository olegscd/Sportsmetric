import type { Game, Player, Team } from "@/types/sports";
import uaapS89Import from "@/scripts/generated/uaap-s89-import.json";

type UaapSeasonImport = {
  seasonId: string;
  games: Game[];
  players: Player[];
  teamRecords: Record<string, { wins: number; losses: number }>;
};

const data = uaapS89Import as UaapSeasonImport;

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
