"use client";

import { PAGE_FRAME } from "@/components/layout/page-shell";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorNotice } from "@/components/ui/ErrorNotice";
import { SegmentedControl } from "@/components/ui/FilterChip";
import { PageHeading } from "@/components/ui/PageHeading";
import { SeasonPicker } from "@/components/ui/SeasonPicker";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { SkeletonRows } from "@/components/ui/Skeleton";
import { useSportsData, useSportsScope } from "@/context/SportsDataContext";
import { getUAAPGamePartition } from "@/lib/derivations";
import { inferLeague } from "@/lib/league-utils";
import { formatAvg } from "@/lib/utils";
import type { League, Player } from "@/types/sports";
import { Trophy } from "lucide-react";
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

  useSportsScope(`league=${league}&season=${encodeURIComponent(seasonId)}`);

  function handleLeagueChange(newLeague: League) {
    setLeague(newLeague);
    setUserSelectedSeasonId(null);
  }

  const standings = getStandings(league, seasonId);
  const leaderConfigs = LEADER_CONFIGS[league];

  const selectedSeason = seasons.find((s) => s.id === seasonId);
  const isOldSeason = selectedSeason ? !selectedSeason.isCurrent : seasonId !== currentSeasonId;

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
        title="The race to the top."
        description="Follow the standings, find the league leaders, and track the postseason."
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
      ) : loading && teams.length === 0 ? (
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
