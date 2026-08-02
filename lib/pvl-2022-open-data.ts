import type { Game, Player, Season, Team } from "@/types/sports";
import pvl2022OpenImport from "@/scripts/generated/pvl-2022-open-import.json";

type PvlSeasonImport = {
  seasonId: string;
  label: string;
  league: "PVL";
  teams: Team[];
  games: Game[];
  players: Player[];
  teamRecords: Record<string, { wins: number; losses: number }>;
};

const data = pvl2022OpenImport as PvlSeasonImport;

export const pvl2022OpenSeason: Season = {
  id: "pvl-2022-open",
  label: "PVL 2022 Open Conference",
  isCurrent: false,
  league: "PVL",
};

export const pvl2022OpenTeams: Team[] = data.teams;
export const pvl2022OpenPlayers: Player[] = data.players;

function hydrateGames(games: Game[], teams: Team[]): Game[] {
  const byId = new Map(teams.map((t) => [t.id, t]));
  return games.map((game) => ({
    ...game,
    homeTeam: byId.get(game.homeTeam.id) ?? game.homeTeam,
    awayTeam: byId.get(game.awayTeam.id) ?? game.awayTeam,
  }));
}

export const pvl2022OpenGames: Game[] = hydrateGames(data.games, pvl2022OpenTeams);
