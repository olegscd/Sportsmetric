"use client";

import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorNotice } from "@/components/ui/ErrorNotice";
import { SegmentedControl } from "@/components/ui/FilterChip";
import { SeasonPicker } from "@/components/ui/SeasonPicker";
import { SkeletonRows } from "@/components/ui/Skeleton";
import { useSportsData } from "@/context/SportsDataContext";
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

  return (
    <div className="mx-auto flex w-full max-w-7xl min-w-0 flex-col gap-4 px-4 py-4 md:px-6">
      <div className="flex items-end justify-between gap-3">
        <div className="hidden md:block">
          <h1 className="text-lg font-extrabold tracking-tight text-foreground">Standings</h1>
          <p className="text-xs text-muted">Records and league leaders</p>
        </div>
        <SeasonPicker
          value={seasonId}
          onChange={setUserSelectedSeasonId}
          league={league}
          includeLifetime={false}
        />
      </div>

      <SegmentedControl options={LEAGUES} value={league} onChange={handleLeagueChange} />

      {error && teams.length === 0 ? (
        <ErrorNotice message={error} onRetry={() => void refreshData()} />
      ) : loading && teams.length === 0 ? (
        <SkeletonRows count={8} />
      ) : (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <div className="mb-2 flex items-center justify-between">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-muted">
                {league === "UAAP"
                  ? "Elimination Round Standings"
                  : league === "PVL"
                    ? "Elimination Round Standings (Regular Season)"
                    : "Standings"}
              </p>
            </div>
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
              <div className="pt-4">
                <FinalFourBracket standings={standings} playoffGames={playoffGames} />
              </div>
            )}
          </div>

          <div className="lg:col-span-1">
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted">
              Stat Leaders (Regular Season)
            </p>
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
          </div>
        </div>
      )}
    </div>
  );
}
