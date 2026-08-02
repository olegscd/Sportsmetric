import type { Game, Player, Season, Team } from "@/types/sports";
import pvl2022ReinforcedImport from "@/scripts/generated/pvl-2022-reinforced-import.json";

type PvlSeasonImport = {
  seasonId: string;
  label: string;
  league: "PVL";
  teams: Team[];
  games: Game[];
  players: Player[];
  teamRecords: Record<string, { wins: number; losses: number }>;
};

const data = pvl2022ReinforcedImport as PvlSeasonImport;

export const pvl2022ReinforcedSeason: Season = {
  id: "pvl-2022-reinforced",
  label: "PVL 2022 Reinforced Conference",
  isCurrent: false,
  league: "PVL",
};

export const pvl2022ReinforcedTeams: Team[] = data.teams;
export const pvl2022ReinforcedPlayers: Player[] = data.players;

function hydrateGames(games: Game[], teams: Team[]): Game[] {
  const byId = new Map(teams.map((t) => [t.id, t]));
  return games.map((game) => ({
    ...game,
    homeTeam: byId.get(game.homeTeam.id) ?? game.homeTeam,
    awayTeam: byId.get(game.awayTeam.id) ?? game.awayTeam,
  }));
}

export const pvl2022ReinforcedGames: Game[] = hydrateGames(
  data.games,
  pvl2022ReinforcedTeams
);
