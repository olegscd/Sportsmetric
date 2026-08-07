"use client";

import { SeasonPicker } from "@/components/ui/SeasonPicker";
import { useSportsData } from "@/context/SportsDataContext";
import { getUAAPGamePartition } from "@/lib/derivations";
import { cn, formatAvg } from "@/lib/utils";
import type { League, Player } from "@/types/sports";
import { useEffect, useState } from "react";
import { FinalFourBracket } from "./FinalFourBracket";
import { StandingsTable } from "./StandingsTable";
import { StatLeaderCard } from "./StatLeaderCard";

const LEAGUES: League[] = ["UAAP", "PBA", "PVL"];

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

function getSeasonLeague(sId: string, sLeague?: League): League {
  if (sLeague) return sLeague;
  if (sId.startsWith("pba")) return "PBA";
  if (sId.startsWith("pvl")) return "PVL";
  return "UAAP";
}

export function StandingsView() {
  const { currentSeasonId, seasons, games, getStandings, getStatLeaders } = useSportsData();
  const [league, setLeague] = useState<League>("UAAP");

  const [seasonId, setSeasonId] = useState<string>(() => {
    const targetSeasons = seasons.filter((s) => getSeasonLeague(s.id, s.league) === "UAAP");
    return targetSeasons.find((s) => s.isCurrent)?.id ?? targetSeasons[0]?.id ?? currentSeasonId;
  });

  useEffect(() => {
    const targetSeasons = seasons.filter((s) => getSeasonLeague(s.id, s.league) === league);
    const activeCurrent = targetSeasons.find((s) => s.isCurrent)?.id ?? targetSeasons[0]?.id;
    if (activeCurrent) {
      setSeasonId(activeCurrent);
    }
  }, [league, seasons]);

  function handleLeagueChange(newLeague: League) {
    setLeague(newLeague);
  }

  const standings = getStandings(league, seasonId);
  const leaderConfigs = LEADER_CONFIGS[league];

  const selectedSeason = seasons.find((s) => s.id === seasonId);
  const isOldSeason = selectedSeason ? !selectedSeason.isCurrent : seasonId !== currentSeasonId;

  // Separate UAAP playoff games if applicable
  const { playoffGames } = league === "UAAP"
    ? getUAAPGamePartition(games, seasonId)
    : { playoffGames: [] };

  return (
    <div className="flex flex-col gap-4 px-4 py-4">
      <div className="flex items-center justify-end">
        <SeasonPicker value={seasonId} onChange={setSeasonId} league={league} includeLifetime={false} />
      </div>

      <div className="flex items-center gap-1 rounded-full bg-surface p-1">
        {LEAGUES.map((value) => (
          <button
            key={value}
            type="button"
            onClick={() => handleLeagueChange(value)}
            className={cn(
              "flex-1 rounded-full py-1.5 text-xs font-semibold transition-colors",
              league === value ? "bg-primary text-primary-foreground" : "text-muted"
            )}
          >
            {value}
          </button>
        ))}
      </div>

      <div>
        <div className="mb-2 flex items-center justify-between">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-muted">
            {league === "UAAP"
              ? "Elimination Round Standings (Capped at 56 Games)"
              : league === "PVL"
              ? "Elimination Round Standings (Regular Season)"
              : "Standings"}
          </p>
        </div>
        {standings.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted">
            No teams yet for this season.
          </p>
        ) : (
          <StandingsTable standings={standings} isOldSeason={isOldSeason} />
        )}
      </div>

      {league === "UAAP" && standings.length >= 4 && (
        <div className="pt-2">
          <FinalFourBracket standings={standings} playoffGames={playoffGames} />
        </div>
      )}

      <div>
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
  );
}
