"use client";

import { PAGE_FRAME } from "@/components/layout/page-shell";
import { cardClasses } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorNotice } from "@/components/ui/ErrorNotice";
import { FilterChip } from "@/components/ui/FilterChip";
import { PageHeading } from "@/components/ui/PageHeading";
import { SearchInput } from "@/components/ui/SearchInput";
import { SeasonPicker } from "@/components/ui/SeasonPicker";
import { SkeletonCardGrid } from "@/components/ui/Skeleton";
import { TeamBadge } from "@/components/ui/TeamBadge";
import { useSportsData, useSportsScope } from "@/context/SportsDataContext";
import { inferLeague } from "@/lib/league-utils";
import { formatRecord } from "@/lib/utils";
import type { League } from "@/types/sports";
import { Shield } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";

const LEAGUE_CHIPS: { value: League | "ALL"; label: string }[] = [
  { value: "UAAP", label: "UAAP" },
  { value: "PBA", label: "PBA" },
  { value: "PVL", label: "PVL" },
  { value: "ALL", label: "All Leagues" },
];

export function TeamDirectory() {
  const { currentSeasonId, seasons, getStandings, teams, loading, error, refreshData } =
    useSportsData();
  const [league, setLeague] = useState<League | "ALL">("UAAP");
  const [query, setQuery] = useState("");
  const [userSelectedSeasonId, setUserSelectedSeasonId] = useState<string | null>(null);
  const activeLeague: League = league === "ALL" ? "UAAP" : league;

  const targetSeasons = seasons.filter((s) => inferLeague(s) === activeLeague);
  const activeCurrent = targetSeasons.find((s) => s.isCurrent)?.id ?? targetSeasons[0]?.id ?? currentSeasonId;
  const seasonId = userSelectedSeasonId && targetSeasons.some((s) => s.id === userSelectedSeasonId)
    ? userSelectedSeasonId
    : activeCurrent;

  function handleLeagueChange(newLeague: League | "ALL") {
    setLeague(newLeague);
    setUserSelectedSeasonId(null);
  }

  const leagues: League[] = league === "ALL" ? ["UAAP", "PBA", "PVL"] : [league];
  useSportsScope(league === "ALL" ? "league=ALL" : `league=${league}&season=${encodeURIComponent(seasonId)}`);

  const standings = leagues.flatMap((l) => getStandings(l, league === "ALL" ? seasons.find(s => s.league === l && s.isCurrent)?.id : seasonId));

  // Rank within each team's own league. In "All Leagues" mode the rows are
  // concatenated, so a single findIndex would show a global position instead.
  const rankByTeamId = new Map<string, number>();
  const leagueCounters: Record<League, number> = { UAAP: 0, PBA: 0, PVL: 0 };
  for (const row of standings) {
    leagueCounters[row.team.league] += 1;
    rankByTeamId.set(row.team.id, leagueCounters[row.team.league]);
  }

  const normalizedQuery = query.trim().toLowerCase();
  const filteredStandings = useMemo(() => {
    if (!normalizedQuery) return standings;
    return standings.filter((item) => {
      const team = item.team;
      return (
        team.name.toLowerCase().includes(normalizedQuery) ||
        team.shortName.toLowerCase().includes(normalizedQuery)
      );
    });
  }, [standings, normalizedQuery]);

  function renderBody() {
    if (error && teams.length === 0) {
      return <ErrorNotice message={error} onRetry={() => void refreshData()} />;
    }
    if (loading && teams.length === 0) {
      return <SkeletonCardGrid count={6} height="h-20" />;
    }
    if (standings.length === 0) {
      return (
        <EmptyState
          icon={<Shield size={22} aria-hidden="true" />}
          title="No teams for this season yet"
          description="Team cards appear here once the season roster has been published. Try another league or season."
        />
      );
    }
    if (filteredStandings.length === 0) {
      return (
        <EmptyState
          icon={<Shield size={22} aria-hidden="true" />}
          title={`No teams match "${query.trim()}"`}
          description="Search by team name or short code."
        />
      );
    }
    return (
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
        {filteredStandings.map((item) => {
          const team = item.team;
          const record = { wins: item.wins, losses: item.losses };
          const pctStr = item.winPct.toFixed(3).replace(/^0/, "");
          return (
            <Link
              key={team.id}
              href={`/teams/${team.id}`}
              className={cardClasses({
                interactive: true,
                className: "flex min-h-16 items-center gap-3 p-3",
              })}
            >
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-control bg-surface-2 text-xs font-extrabold tabular-nums text-muted">
                {rankByTeamId.get(team.id) ?? "–"}
              </span>
              <TeamBadge team={team} size="md" />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-bold text-foreground">{team.name}</span>
                <span className="block truncate text-xs font-semibold text-muted">
                  {team.league} &middot; {formatRecord(record)}
                </span>
              </span>
              <span className="shrink-0 font-mono text-xs font-bold tabular-nums text-foreground">
                {pctStr}
              </span>
            </Link>
          );
        })}
      </div>
    );
  }

  return (
    <div className={PAGE_FRAME}>
      <PageHeading title="Find your side." description="Team records, season rosters, and the stories the standings tell." />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="h-scroll flex gap-2 overflow-x-auto">
          {LEAGUE_CHIPS.map((chip) => (
            <FilterChip
              key={chip.value}
              selected={league === chip.value}
              onClick={() => handleLeagueChange(chip.value)}
            >
              {chip.label}
            </FilterChip>
          ))}
        </div>
        {league === "ALL" ? <span className="text-xs text-muted">Current season in each league</span> : <SeasonPicker
          value={seasonId}
          onChange={setUserSelectedSeasonId}
          league={activeLeague}
        />}
      </div>

      <SearchInput
        value={query}
        onChange={setQuery}
        label="Search teams"
        placeholder="Search teams"
      />

      {error && teams.length > 0 ? (
        <ErrorNotice message={error} onRetry={() => void refreshData()} />
      ) : null}

      {!loading && <p className="text-2xs font-medium text-muted" aria-live="polite">{filteredStandings.length} of {standings.length} teams</p>}

      {renderBody()}
    </div>
  );
}
