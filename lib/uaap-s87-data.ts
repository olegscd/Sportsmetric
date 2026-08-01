import type { Game, Player, Team } from "@/types/sports";
import uaapS87Import from "@/scripts/generated/uaap-s87-import.json";

type UaapS87Import = {
  seasonId: string;
  games: Game[];
  players: Player[];
  teamRecords: Record<string, { wins: number; losses: number }>;
};

const data = uaapS87Import as UaapS87Import;

/** UAAP Season 87 (2024-25) games parsed from uaap_season_stats.csv */
export const uaapS87Games: Game[] = data.games;

/** UAAP Season 87 (2024-25) players with computed season averages */
export const uaapS87Players: Player[] = data.players;

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
export const uaapS87TeamRecords = deriveRegSeasonTeamRecords(uaapS87Games);

/** Apply imported UAAP S87 regular season records onto catalog teams for 2024-25. */
export function applyUaapS87TeamRecords(teams: Team[]): Team[] {
  return teams.map((team) => {
    const record = uaapS87TeamRecords[team.id];
    return record ? { ...team, record } : team;
  });
}

/** Re-hydrate embedded game team refs from the canonical team list (correct records). */
export function hydrateUaapS87Games(games: Game[], teams: Team[]): Game[] {
  const byId = new Map(teams.map((t) => [t.id, t]));
  return games.map((game) => ({
    ...game,
    homeTeam: byId.get(game.homeTeam.id) ?? game.homeTeam,
    awayTeam: byId.get(game.awayTeam.id) ?? game.awayTeam,
  }));
}
