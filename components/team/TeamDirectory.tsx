"use client";

import { inProgressSeasons } from "@/lib/season-status";
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
import { Badge } from "@/components/ui/Badge";
import { inferLeague } from "@/lib/league-utils";
import { formatRecord } from "@/lib/utils";
import type { League } from "@/types/sports";
import { ArrowUpRight, Shield } from "lucide-react";
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
  const { isPending: isSeasonPending } = useSportsScope(
    league === "ALL" ? "league=ALL" : `league=${league}&season=${encodeURIComponent(seasonId)}`
  );

  // "All Leagues" lists every in-progress season (e.g. UAAP Men's and U16).
  const standings = league === "ALL"
    ? leagues.flatMap((l) => inProgressSeasons(seasons, l).flatMap((s) => getStandings(l, s.id)))
    : getStandings(activeLeague, seasonId);

  // Rank within each team's own season. In "All Leagues" mode the rows are
  // concatenated, so a single findIndex would show a global position instead.
  // When a league has more than one season in progress, say which one a row is.
  const seasonTagById = new Map<string, string>();
  if (league === "ALL") {
    for (const l of leagues) {
      const active = inProgressSeasons(seasons, l);
      if (active.length > 1) for (const s of active) seasonTagById.set(s.id, s.label);
    }
  }

  const rankByTeamId = new Map<string, number>();
  const seasonCounters = new Map<string, number>();
  for (const row of standings) {
    const next = (seasonCounters.get(row.team.seasonId) ?? 0) + 1;
    seasonCounters.set(row.team.seasonId, next);
    rankByTeamId.set(row.team.id, next);
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
    if (isSeasonPending || (loading && teams.length === 0)) {
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
          const pctFill = Math.round(item.winPct * 100);
          const rank = rankByTeamId.get(team.id);
          const hasPlayedScores = item.pointsFor + item.pointsAgainst > 0;
          const diffStr =
            item.pointDiff > 0 ? `+${item.pointDiff}` : `${item.pointDiff}`;
          return (
            <Link
              key={team.id}
              href={`/teams/${team.id}`}
              className={cardClasses({
                interactive: true,
                className:
                  "translucent-card group relative flex flex-col justify-between gap-3.5 overflow-hidden border-white/[0.1] p-4 hover:border-white/25 hover:shadow-[inset_0_1px_0_rgba(255,255,255,0.16),0_22px_40px_-20px_rgba(0,0,0,0.96)]",
              })}
            >
              <span
                aria-hidden="true"
                className="pointer-events-none absolute inset-0 opacity-85 transition-opacity group-hover:opacity-100"
                style={{
                  backgroundImage: `radial-gradient(ellipse 85% 65% at 100% 0%, ${team.accentColor}28, transparent 62%)`,
                }}
              />
              <span
                aria-hidden="true"
                className="pointer-events-none absolute inset-x-0 top-0 h-[3px] opacity-90 transition-opacity group-hover:opacity-100"
                style={{ backgroundColor: team.accentColor }}
              />
              <span
                aria-hidden="true"
                className="font-display pointer-events-none absolute -bottom-2 right-3 select-none text-5xl font-black uppercase tracking-tighter text-foreground opacity-[0.055]"
              >
                {team.shortName}
              </span>

              <div className="relative z-10 flex items-center justify-between gap-2">
                <div className="flex min-w-0 items-center gap-2">
                  <span
                    className={
                      rank === 1
                        ? "flex h-6 min-w-6 items-center justify-center rounded-control border border-archive/45 bg-archive/15 px-1.5 text-2xs font-extrabold tabular-nums text-archive"
                        : rank && rank <= 4
                          ? "flex h-6 min-w-6 items-center justify-center rounded-control border border-primary/35 bg-primary/12 px-1.5 text-2xs font-extrabold tabular-nums text-foreground"
                          : "flex h-6 min-w-6 items-center justify-center rounded-control bg-white/[0.05] px-1.5 text-2xs font-extrabold tabular-nums text-muted"
                    }
                  >
                    #{rank ?? "–"}
                  </span>
                  <span className="truncate text-3xs font-bold uppercase tracking-wider text-muted">
                    {team.league}
                    {seasonTagById.has(team.seasonId)
                      ? ` · ${seasonTagById.get(team.seasonId)}`
                      : ""}
                  </span>
                </div>
                <span className="inline-flex items-center gap-1 text-3xs font-bold uppercase tracking-wider text-muted transition-colors group-hover:text-primary">
                  Team Hub
                  <ArrowUpRight size={12} aria-hidden="true" />
                </span>
              </div>

              <div className="relative z-10 flex items-center gap-3.5">
                <TeamBadge team={team} size="lg" className="h-14 w-14 text-xs" />
                <div className="min-w-0 flex-1">
                  <span className="font-display block truncate text-xl font-extrabold leading-tight tracking-tight text-foreground transition-colors group-hover:text-primary">
                    {team.name}
                  </span>
                  <div className="mt-1 flex flex-wrap items-center gap-2 text-xs">
                    <span className="font-mono font-bold tabular-nums text-foreground/95">
                      {formatRecord(record)}
                    </span>
                    {item.streak && item.streak !== "-" ? (
                      <Badge
                        tone={item.streak.startsWith("W") ? "success" : "negative"}
                        size="sm"
                      >
                        {item.streak}
                      </Badge>
                    ) : null}
                  </div>
                </div>
              </div>

              <div className="relative z-10 flex items-center gap-4 border-t border-white/[0.07] pt-2.5">
                <div className="min-w-0 flex-1">
                  <div className="mb-1 flex items-center justify-between text-3xs font-bold uppercase tracking-wider text-muted">
                    <span>Win Rate</span>
                    <span className="font-mono text-foreground">{pctStr}</span>
                  </div>
                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/[0.06]">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{
                        width: `${Math.max(4, pctFill)}%`,
                        backgroundColor: team.accentColor,
                      }}
                    />
                  </div>
                </div>
                {hasPlayedScores ? (
                  <div className="flex shrink-0 items-baseline gap-1.5 text-right">
                    <span className="text-3xs font-bold uppercase tracking-wider text-muted">
                      Diff
                    </span>
                    <span
                      className={`font-mono text-xs font-bold tabular-nums ${
                        item.pointDiff > 0
                          ? "text-positive"
                          : item.pointDiff < 0
                            ? "text-negative"
                            : "text-muted"
                      }`}
                    >
                      {diffStr}
                    </span>
                  </div>
                ) : null}
              </div>
            </Link>
          );
        })}
      </div>
    );
  }

  return (
    <div className={PAGE_FRAME}>
      <PageHeading title="Philippine sports teams and rosters." description="Explore UAAP, PBA and PVL team records, season rosters and statistics." />

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
        {league === "ALL" ? <span className="text-xs text-muted">Seasons in progress in each league</span> : <SeasonPicker
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

      {!isSeasonPending && !loading && <p className="text-2xs font-medium text-muted" aria-live="polite">{filteredStandings.length} of {standings.length} teams</p>}

      {renderBody()}
    </div>
  );
}
