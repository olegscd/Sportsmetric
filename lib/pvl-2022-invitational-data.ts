import type { Game, Player, Season, Team } from "@/types/sports";
import pvl2022InvitationalImport from "@/scripts/generated/pvl-2022-invitational-import.json";

type PvlSeasonImport = {
  seasonId: string;
  label: string;
  league: "PVL";
  teams: Team[];
  games: Game[];
  players: Player[];
  teamRecords: Record<string, { wins: number; losses: number }>;
};

const data = pvl2022InvitationalImport as PvlSeasonImport;

export const pvl2022InvitationalSeason: Season = {
  id: "pvl-2022-invitational",
  label: "PVL 2022 Invitational Conference",
  isCurrent: false,
  league: "PVL",
};

export const pvl2022InvitationalTeams: Team[] = data.teams;
export const pvl2022InvitationalPlayers: Player[] = data.players;

function hydrateGames(games: Game[], teams: Team[]): Game[] {
  const byId = new Map(teams.map((t) => [t.id, t]));
  return games.map((game) => ({
    ...game,
    homeTeam: byId.get(game.homeTeam.id) ?? game.homeTeam,
    awayTeam: byId.get(game.awayTeam.id) ?? game.awayTeam,
  }));
}

export const pvl2022InvitationalGames: Game[] = hydrateGames(
  data.games,
  pvl2022InvitationalTeams
);
