import type { Game, Player, Season, Team } from "@/types/sports";
import pvl2021Import from "@/scripts/generated/pvl-2021-import.json";

type PvlSeasonImport = {
  seasonId: string;
  label: string;
  league: "PVL";
  teams: Team[];
  games: Game[];
  players: Player[];
  teamRecords: Record<string, { wins: number; losses: number }>;
};

const data = pvl2021Import as PvlSeasonImport;

export const pvl2021Season: Season = {
  id: "pvl-2021",
  label: "PVL 2021 Open Conference",
  isCurrent: true,
  league: "PVL",
};

export const pvl2021Teams: Team[] = data.teams;
export const pvl2021Players: Player[] = data.players;

function hydrateGames(games: Game[], teams: Team[]): Game[] {
  const byId = new Map(teams.map((t) => [t.id, t]));
  return games.map((game) => ({
    ...game,
    homeTeam: byId.get(game.homeTeam.id) ?? game.homeTeam,
    awayTeam: byId.get(game.awayTeam.id) ?? game.awayTeam,
  }));
}

export const pvl2021Games: Game[] = hydrateGames(data.games, pvl2021Teams);
