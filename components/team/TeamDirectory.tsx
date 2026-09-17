"use client";

import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorNotice } from "@/components/ui/ErrorNotice";
import { FilterChip } from "@/components/ui/FilterChip";
import { SearchInput } from "@/components/ui/SearchInput";
import { SeasonPicker } from "@/components/ui/SeasonPicker";
import { SkeletonCardGrid } from "@/components/ui/Skeleton";
import { TeamBadge } from "@/components/ui/TeamBadge";
import { useSportsData } from "@/context/SportsDataContext";
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
  const standings = leagues.flatMap((l) => getStandings(l, seasonId));

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
              className="flex items-center gap-3 rounded-2xl border border-border bg-surface p-3 shadow-sm transition-all hover:border-primary/50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary active:scale-[0.99]"
            >
              <span className="w-4 shrink-0 text-center text-xs font-extrabold text-muted">
                {standings.findIndex((row) => row.team.id === team.id) + 1}
              </span>
              <TeamBadge team={team} size="md" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-bold text-foreground">{team.name}</p>
                <p className="truncate text-xs font-semibold text-muted">
                  {team.league} &middot; {formatRecord(record)}
                </p>
              </div>
              <span className="shrink-0 text-xs font-bold tabular-nums text-foreground">
                {pctStr}
              </span>
            </Link>
          );
        })}
      </div>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-7xl min-w-0 flex-col gap-4 px-4 py-4 md:px-6">
      <div className="hidden md:block">
        <h1 className="text-lg font-extrabold tracking-tight text-foreground">Teams</h1>
        <p className="text-xs text-muted">Directory and records by league</p>
      </div>

      <div className="flex items-center justify-between gap-2">
        <div className="flex gap-2 overflow-x-auto pb-0.5">
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
        <SeasonPicker
          value={seasonId}
          onChange={setUserSelectedSeasonId}
          league={activeLeague}
        />
      </div>

      <SearchInput
        value={query}
        onChange={setQuery}
        label="Search teams"
        placeholder="Search teams"
      />

      {renderBody()}
    </div>
  );
}
