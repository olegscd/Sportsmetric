import type { Game, Player, Team } from "@/types/sports";
import uaapS89Import from "@/scripts/generated/uaap-s89-import.json";

type UaapSeasonImport = {
  seasonId: string;
  games: Game[];
  players: Player[];
  teamRecords: Record<string, { wins: number; losses: number }>;
};

const data = uaapS89Import as UaapSeasonImport;

/** UAAP Season 89 (2026-27) games from uaap_season_stats xlsx */
export const uaapS89Games: Game[] = data.games;

/** UAAP Season 89 (2026-27) players with computed season averages */
export const uaapS89Players: Player[] = data.players;

function deriveRegSeasonTeamRecords(games: Game[]): Record<string, { wins: number; losses: number }> {
  const sorted = [...games].sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime());
  const regGames = sorted.slice(0, 56);
  const records: Record<string, { wins: number; losses: number }> = {};
  for (const g of regGames) {
    if (!records[g.homeTeam.id]) records[g.homeTeam.id] = { wins: 0, losses: 0 };
    if (!records[g.awayTeam.id]) records[g.awayTeam.id] = { wins: 0, losses: 0 };

    if (g.homeScore > g.awayScore) {
      records[g.homeTeam.id].wins += 1;
      records[g.awayTeam.id].losses += 1;
    } else if (g.awayScore > g.homeScore) {
      records[g.awayTeam.id].wins += 1;
      records[g.homeTeam.id].losses += 1;
    }
  }
  return records;
}

/** W-L records derived strictly from regular season (first 56) game results */
export const uaapS89TeamRecords = deriveRegSeasonTeamRecords(uaapS89Games);

export function applyUaapS89TeamRecords(teams: Team[]): Team[] {
  return teams.map((team) => {
    const record = uaapS89TeamRecords[team.id];
    return record ? { ...team, record } : team;
  });
}

export function hydrateUaapS89Games(games: Game[], teams: Team[]): Game[] {
  const byId = new Map(teams.map((t) => [t.id, t]));
  return games.map((game) => ({
    ...game,
    homeTeam: byId.get(game.homeTeam.id) ?? game.homeTeam,
    awayTeam: byId.get(game.awayTeam.id) ?? game.awayTeam,
  }));
}
