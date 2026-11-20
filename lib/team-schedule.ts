import { getEffectiveGameStatus } from "@/lib/derivations";
import type { Game, Team } from "@/types/sports";

export type TeamGameResult = "W" | "L" | "T";

export interface TeamScheduleEntry {
  game: Game;
  status: "LIVE" | "UPCOMING" | "FINAL";
  opponent: Team;
  isHome: boolean;
  teamScore: number;
  opponentScore: number;
  /** Only set for completed games. */
  result: TeamGameResult | null;
}

export interface TeamSchedule {
  /** Live games first, then upcoming games, soonest first. */
  upcoming: TeamScheduleEntry[];
  /** Completed games, most recent first. */
  completed: TeamScheduleEntry[];
}

function startMs(game: Game): number {
  const ms = new Date(game.startTime).getTime();
  return Number.isNaN(ms) ? 0 : ms;
}

function toEntry(game: Game, teamId: string): TeamScheduleEntry {
  const isHome = game.homeTeam.id === teamId;
  const status = getEffectiveGameStatus(game);
  const teamScore = isHome ? game.homeScore : game.awayScore;
  const opponentScore = isHome ? game.awayScore : game.homeScore;
  const result: TeamGameResult | null =
    status !== "FINAL"
      ? null
      : teamScore > opponentScore
        ? "W"
        : teamScore < opponentScore
          ? "L"
          : "T";
  return {
    game,
    status,
    opponent: isHome ? game.awayTeam : game.homeTeam,
    isHome,
    teamScore,
    opponentScore,
    result,
  };
}

/**
 * Builds a team's schedule for its own season: live and upcoming games
 * (live first, then soonest first) and completed games (latest first), with
 * W/L/T metadata computed from the team's side of the score.
 */
export function buildTeamSchedule(
  games: readonly Game[],
  team: Pick<Team, "id" | "seasonId">
): TeamSchedule {
  const entries = games
    .filter(
      (game) =>
        game.seasonId === team.seasonId &&
        (game.homeTeam.id === team.id || game.awayTeam.id === team.id)
    )
    .map((game) => toEntry(game, team.id));

  const upcoming = entries
    .filter((entry) => entry.status !== "FINAL")
    .sort((a, b) => {
      if (a.status !== b.status) return a.status === "LIVE" ? -1 : 1;
      return startMs(a.game) - startMs(b.game) || a.game.id.localeCompare(b.game.id);
    });

  const completed = entries
    .filter((entry) => entry.status === "FINAL")
    .sort((a, b) => startMs(b.game) - startMs(a.game) || a.game.id.localeCompare(b.game.id));

  return { upcoming, completed };
}
