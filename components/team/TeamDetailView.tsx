"use client";

import { isSeasonInProgress } from "@/lib/season-status";
import { PAGE_FRAME } from "@/components/layout/page-shell";
import { LeagueBadge } from "@/components/match-center/LeagueBadge";
import { StandingsTable } from "@/components/standings/StandingsTable";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorNotice } from "@/components/ui/ErrorNotice";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { SkeletonRows } from "@/components/ui/Skeleton";
import { StatTile } from "@/components/ui/StatTile";
import { TeamBadge } from "@/components/ui/TeamBadge";
import { useSportsData, useSportsScope } from "@/context/SportsDataContext";
import { formatOrdinal, formatRecord } from "@/lib/utils";
import { ChevronLeft, Shield } from "lucide-react";
import Link from "next/link";
import { TeamRoster } from "./TeamRoster";
import { TeamStatsTable } from "./TeamStatsTable";

export function TeamDetailView({ id }: { id: string }) {
  useSportsScope(`team=${encodeURIComponent(id)}`);
  const { teams, players, seasons, currentSeasonId, getStandings, loading, error, refreshData } = useSportsData();
  const team = teams.find((t) => t.id === id);

  if (!team) {
    if (loading) {
      return (
        <div className={PAGE_FRAME} role="status" aria-label="Loading team">
          <SkeletonRows count={6} />
        </div>
      );
    }
    if (error) {
      return (
        <div className={PAGE_FRAME}>
          <ErrorNotice message={error} onRetry={() => void refreshData()} />
        </div>
      );
    }
    return (
      <div className={PAGE_FRAME}>
        <EmptyState
          icon={<Shield size={22} aria-hidden="true" />}
          title="Team not found"
          description="This team may have been removed, or the link is out of date."
        />
      </div>
    );
  }

  const teamSeason = seasons.find((s) => s.id === team.seasonId);
  const isOldSeason = teamSeason ? !isSeasonInProgress(teamSeason) : team.seasonId !== currentSeasonId;
  const teamPlayers = players.filter((p) => p.teamId === team.id);
  const standings = getStandings(team.league, team.seasonId);
  const rankIndex = standings.findIndex((s) => s.team.id === team.id);
  const rank = rankIndex !== -1 ? rankIndex + 1 : undefined;

  const currentStanding = standings.find((s) => s.team.id === team.id);
  const recordToDisplay = currentStanding
    ? { wins: currentStanding.wins, losses: currentStanding.losses }
    : team.record;
  const gamesPlayed = recordToDisplay.wins + recordToDisplay.losses;
  const winPct = gamesPlayed > 0 ? recordToDisplay.wins / gamesPlayed : 0;

  return (
    <div className={PAGE_FRAME}>
      <div className="flex flex-col gap-3">
        <Link
          href="/teams"
          className="-ml-2 inline-flex min-h-10 w-fit items-center gap-1 rounded-control px-2 text-xs font-semibold text-muted transition-colors hover:text-foreground"
        >
          <ChevronLeft size={15} aria-hidden="true" />
          All teams
        </Link>

        <Card className="flex flex-col gap-4 p-5">
          <div className="flex items-center gap-4">
            <TeamBadge team={team} size="lg" />
            <div className="min-w-0 flex-1">
              <h1 className="truncate text-xl font-extrabold tracking-tight text-foreground md:text-2xl">
                {team.name}
              </h1>
              <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                <LeagueBadge league={team.league} />
                <span className="text-xs font-semibold text-muted">
                  {formatRecord(recordToDisplay)}
                  {rank ? ` · ${formatOrdinal(rank)} in ${team.league}` : null}
                </span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <StatTile label="Wins" value={recordToDisplay.wins} tone="positive" size="md" />
            <StatTile label="Losses" value={recordToDisplay.losses} tone="negative" size="md" />
            <StatTile
              label="Win PCT"
              value={winPct.toFixed(3).replace(/^0/, "")}
              size="md"
            />
            <StatTile
              label="League rank"
              value={rank ?? "–"}
              detail={rank ? `${formatOrdinal(rank)} of ${standings.length}` : "Unranked"}
              tone={rank === 1 ? "archive" : "default"}
              size="md"
            />
          </div>
        </Card>
      </div>

      <section>
        <SectionHeading
          level={2}
          title={`${team.league} Standings`}
          description={isOldSeason ? "Final standings for this season." : "Current elimination-round standings."}
          className="mb-3"
        />
        <StandingsTable standings={standings} highlightTeamId={team.id} isOldSeason={isOldSeason} />
      </section>

      <section>
        <SectionHeading level={2} title="Roster" className="mb-3" />
        <TeamRoster players={teamPlayers} team={team} />
      </section>

      <section>
        <SectionHeading level={2} title="Season Stats" className="mb-3" />
        <TeamStatsTable players={teamPlayers} league={team.league} />
      </section>
    </div>
  );
}
