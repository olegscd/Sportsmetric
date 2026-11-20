"use client";

import { isSeasonInProgress } from "@/lib/season-status";
import { PAGE_FRAME } from "@/components/layout/page-shell";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorNotice } from "@/components/ui/ErrorNotice";
import { SegmentedControl } from "@/components/ui/FilterChip";
import { PageHeading } from "@/components/ui/PageHeading";
import { SeasonPicker } from "@/components/ui/SeasonPicker";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { SkeletonRows } from "@/components/ui/Skeleton";
import { TeamBadge } from "@/components/ui/TeamBadge";
import { useSportsData, useSportsScope } from "@/context/SportsDataContext";
import { getUAAPGamePartition } from "@/lib/derivations";
import { inferLeague } from "@/lib/league-utils";
import { formatAvg, formatRecord } from "@/lib/utils";
import type { League, Player } from "@/types/sports";
import { Trophy } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import { FinalFourBracket } from "./FinalFourBracket";
import { StandingsTable } from "./StandingsTable";
import { StatLeaderCard } from "./StatLeaderCard";

const LEAGUES: { value: League; label: string }[] = [
  { value: "UAAP", label: "UAAP" },
  { value: "PBA", label: "PBA" },
  { value: "PVL", label: "PVL" },
];

interface LeaderConfig {
  statKey: keyof Player["seasonAverages"];
  title: string;
  formatValue: (value: number) => string;
}

const BASKETBALL_LEADERS: LeaderConfig[] = [
  { statKey: "ppg", title: "Points Per Game", formatValue: formatAvg },
  { statKey: "rpg", title: "Rebounds Per Game", formatValue: formatAvg },
  { statKey: "apg", title: "Assists Per Game", formatValue: formatAvg },
  { statKey: "spg", title: "Steals Per Game", formatValue: formatAvg },
  { statKey: "bpg", title: "Blocks Per Game", formatValue: formatAvg },
];

const VOLLEYBALL_LEADERS: LeaderConfig[] = [
  { statKey: "killsPerSet", title: "Kills Per Set", formatValue: formatAvg },
  { statKey: "digsPerSet", title: "Digs Per Set", formatValue: formatAvg },
  { statKey: "blocksPerSet", title: "Blocks Per Set", formatValue: formatAvg },
];

const LEADER_CONFIGS: Record<League, LeaderConfig[]> = {
  UAAP: BASKETBALL_LEADERS,
  PBA: BASKETBALL_LEADERS,
  PVL: VOLLEYBALL_LEADERS,
};

export function StandingsView() {
  const { currentSeasonId, seasons, games, getStandings, getStatLeaders, loading, error, refreshData, teams } =
    useSportsData();
  const [league, setLeague] = useState<League>("UAAP");
  const [userSelectedSeasonId, setUserSelectedSeasonId] = useState<string | null>(null);

  const targetSeasons = seasons.filter((s) => inferLeague(s) === league);
  const activeCurrent = targetSeasons.find((s) => s.isCurrent)?.id ?? targetSeasons[0]?.id ?? currentSeasonId;
  const seasonId =
    userSelectedSeasonId && targetSeasons.some((s) => s.id === userSelectedSeasonId)
      ? userSelectedSeasonId
      : activeCurrent;

  const { isPending: isSeasonPending } = useSportsScope(
    `league=${league}&season=${encodeURIComponent(seasonId)}`
  );

  function handleLeagueChange(newLeague: League) {
    setLeague(newLeague);
    setUserSelectedSeasonId(null);
  }

  const standings = getStandings(league, seasonId);
  const leaderConfigs = LEADER_CONFIGS[league];

  const selectedSeason = seasons.find((s) => s.id === seasonId);
  const isOldSeason = selectedSeason ? !isSeasonInProgress(selectedSeason) : seasonId !== currentSeasonId;

  const { playoffGames } =
    league === "UAAP" ? getUAAPGamePartition(games, seasonId) : { playoffGames: [] };

  const standingsTitle =
    league === "UAAP"
      ? "Elimination Round Standings"
      : league === "PVL"
        ? "Elimination Round Standings (Regular Season)"
        : "Standings";

  return (
    <div className={PAGE_FRAME}>
      <PageHeading
        title="League standings and statistical leaders."
        description="Follow UAAP, PBA and PVL standings, find the statistical leaders, and track the postseason."
        action={
          <SeasonPicker
            value={seasonId}
            onChange={setUserSelectedSeasonId}
            league={league}
            includeLifetime={false}
          />
        }
      />

      <div className="w-full sm:max-w-md">
        <SegmentedControl options={LEAGUES} value={league} onChange={handleLeagueChange} />
      </div>

      {error && teams.length > 0 ? (
        <ErrorNotice message={error} onRetry={() => void refreshData()} />
      ) : null}

      {error && teams.length === 0 ? (
        <ErrorNotice message={error} onRetry={() => void refreshData()} />
      ) : isSeasonPending || (loading && teams.length === 0) ? (
        <SkeletonRows count={8} />
      ) : (
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_21rem]">
          <div className="min-w-0">
            <SectionHeading
              level={2}
              eyebrow={`${league} · ${selectedSeason?.label ?? "Season"}`}
              title={standingsTitle}
              description={
                league === "PVL"
                  ? "Regular-season records, with point differential and current streak."
                  : undefined
              }
              className="mb-3"
            />
            {standings.length >= 4 ? (
              <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
                {standings.slice(0, 4).map((row, idx) => {
                  const seed = idx + 1;
                  const pct = Math.round(row.winPct * 100);
                  const pctStr = row.winPct.toFixed(3).replace(/^0/, "");
                  const seedTag =
                    seed === 1
                      ? "#1 Seed"
                      : seed === 2 && league === "UAAP"
                        ? "Twice-to-Beat"
                        : `Seed #${seed}`;
                  return (
                    <Link
                      key={row.team.id}
                      href={`/teams/${row.team.id}`}
                      className="group relative flex min-w-0 flex-col justify-between gap-2.5 overflow-hidden rounded-card border border-white/[0.1] p-3.5 translucent-card transition-all hover:-translate-y-0.5 hover:border-white/25"
                      style={{
                        backgroundImage: `radial-gradient(ellipse 85% 70% at 100% 0%, ${row.team.accentColor}26, transparent 62%)`,
                      }}
                    >
                      <span
                        aria-hidden="true"
                        className="absolute inset-x-0 top-0 h-[3px]"
                        style={{ backgroundColor: row.team.accentColor }}
                      />
                      <div className="flex items-center justify-between gap-2">
                        <Badge tone={seed === 1 ? "archive" : "primary"} size="sm">
                          {seedTag}
                        </Badge>
                        <span className="font-mono text-2xs font-bold tabular-nums text-muted">
                          {pctStr}
                        </span>
                      </div>
                      <div className="flex items-center gap-2.5">
                        <TeamBadge team={row.team} size="md" />
                        <div className="min-w-0 flex-1">
                          <p className="font-display truncate text-lg font-extrabold leading-tight text-foreground transition-colors group-hover:text-primary">
                            {row.team.shortName}
                          </p>
                          <p className="truncate text-2xs font-medium text-muted">
                            {formatRecord({ wins: row.wins, losses: row.losses })}
                          </p>
                        </div>
                      </div>
                      <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/[0.06]">
                        <div
                          className="h-full rounded-full transition-all"
                          style={{
                            width: `${Math.max(4, pct)}%`,
                            backgroundColor: row.team.accentColor,
                          }}
                        />
                      </div>
                    </Link>
                  );
                })}
              </div>
            ) : null}
            {standings.length === 0 ? (
              <EmptyState
                icon={<Trophy size={22} aria-hidden="true" />}
                title="No standings for this season yet"
                description="Records appear here once teams and completed games have been published."
              />
            ) : (
              <StandingsTable standings={standings} isOldSeason={isOldSeason} />
            )}

            {league === "UAAP" && standings.length >= 4 && playoffGames.length > 0 && (
              <div className="pt-5">
                <FinalFourBracket standings={standings} playoffGames={playoffGames} />
              </div>
            )}
          </div>

          <aside className="min-w-0 xl:sticky xl:top-24 xl:self-start">
            <SectionHeading
              level={2}
              title="Stat Leaders (Regular Season)"
              className="mb-3"
            />
            <div className="flex flex-col gap-3">
              {leaderConfigs.map((config) => (
                <StatLeaderCard
                  key={config.statKey}
                  title={config.title}
                  entries={getStatLeaders(league, config.statKey, 3, seasonId)}
                  formatValue={config.formatValue}
                />
              ))}
            </div>
          </aside>
        </div>
      )}
    </div>
  );
}
