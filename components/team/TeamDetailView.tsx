"use client";

import { LeagueBadge } from "@/components/match-center/LeagueBadge";
import { StandingsTable } from "@/components/standings/StandingsTable";
import { TeamBadge } from "@/components/ui/TeamBadge";
import { useSportsData } from "@/context/SportsDataContext";
import { formatOrdinal, formatRecord } from "@/lib/utils";
import { TeamRoster } from "./TeamRoster";
import { TeamStatsTable } from "./TeamStatsTable";

export function TeamDetailView({ id }: { id: string }) {
  const { teams, players, seasons, currentSeasonId, getStandings } = useSportsData();
  const team = teams.find((t) => t.id === id);

  if (!team) {
    return (
      <div className="flex flex-col items-center gap-1.5 px-6 py-20 text-center">
        <p className="text-sm font-semibold text-foreground">Team not found</p>
        <p className="text-xs text-muted">This team may have been removed by an admin.</p>
      </div>
    );
  }

  const teamSeason = seasons.find((s) => s.id === team.seasonId);
  const isOldSeason = teamSeason ? !teamSeason.isCurrent : team.seasonId !== currentSeasonId;
  const teamPlayers = players.filter((p) => p.teamId === team.id);
  const standings = getStandings(team.league, team.seasonId);
  const rankIndex = standings.findIndex((s) => s.team.id === team.id);
  const rank = rankIndex !== -1 ? rankIndex + 1 : undefined;

  const currentStanding = standings.find((s) => s.team.id === team.id);
  const recordToDisplay = currentStanding
    ? { wins: currentStanding.wins, losses: currentStanding.losses }
    : team.record;

  return (
    <div className="flex flex-col gap-5 px-4 py-4">
      <div className="flex items-center gap-4 rounded-2xl border border-stone-400/50 bg-[#E8CEB0] p-5 shadow-sm">
        <TeamBadge team={team} size="lg" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-lg font-extrabold text-zinc-950">{team.name}</p>
          <div className="mt-1.5 flex items-center gap-1.5">
            <LeagueBadge league={team.league} />
            <span className="text-xs font-semibold text-zinc-700">
              {formatRecord(recordToDisplay)}
              {rank ? ` \u00b7 ${formatOrdinal(rank)} in ${team.league}` : null}
            </span>
          </div>
        </div>
      </div>

      <div>
        <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted">
          {team.league} Standings
        </p>
        <StandingsTable standings={standings} highlightTeamId={team.id} isOldSeason={isOldSeason} />
      </div>

      <div>
        <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted">
          Roster
        </p>
        <TeamRoster players={teamPlayers} team={team} />
      </div>

      <div>
        <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted">
          Season Stats
        </p>
        <TeamStatsTable players={teamPlayers} league={team.league} />
      </div>
    </div>
  );
}
