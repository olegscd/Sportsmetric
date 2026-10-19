"use client";

import { useSportsData, useSportsScope } from "@/context/SportsDataContext";
import { formatAvg, formatPct } from "@/lib/utils";
import type { Player, SeasonAverages, Team } from "@/types/sports";

import type { PlayerGameLogEntry } from "@/lib/derivations";
import { ChevronDown } from "lucide-react";
import { useCallback, useMemo, useState } from "react";

import { PlayerVolleyballStats } from "./PlayerVolleyballStats";
import { MatchHistory } from "./MatchHistory";
import { PlayerCard } from "./PlayerCard";
import { StatCardExport } from "./StatCardExport";

function isVolleyballAverages(avg: SeasonAverages): boolean {
  return avg.killsPerSet !== undefined || avg.attackPts !== undefined;
}

function CareerStatGrid({ averages }: { averages: SeasonAverages }) {
  const tiles = isVolleyballAverages(averages)
    ? [
        { label: "PPG", value: formatAvg(averages.ppg) },
        { label: "Attack Pts", value: String(averages.attackPts ?? 0) },
        { label: "Block Pts", value: String(averages.blockPts ?? 0) },
        { label: "Serve Aces", value: String(averages.servePts ?? 0) },
        { label: "Digs/Set", value: formatAvg(averages.digsPerSet ?? 0) },
        { label: "Atk Eff", value: formatPct(averages.attackPct ?? 0) },
      ]
    : [
        { label: "PPG", value: formatAvg(averages.ppg) },
        { label: "RPG", value: formatAvg(averages.rpg) },
        { label: "APG", value: formatAvg(averages.apg) },
        { label: "SPG", value: formatAvg(averages.spg) },
        { label: "BPG", value: formatAvg(averages.bpg) },
        { label: "3P%", value: formatPct(averages.threePtPct) },
      ];

  return (
    <div className="grid grid-cols-3 gap-2">
      {tiles.map((tile) => (
        <div
          key={tile.label}
          className="flex flex-col items-center rounded-xl border border-border bg-elevated py-2.5"
        >
          <span className="text-base font-bold tabular-nums text-foreground">{tile.value}</span>
          <span className="text-[10px] font-medium uppercase tracking-wide text-muted">
            {tile.label}
          </span>
        </div>
      ))}
    </div>
  );
}

export function PlayerDetailView({ id }: { id: string }) {
  useSportsScope(`player=${encodeURIComponent(id)}`);
  const { players, teams, loading, error, refreshData } = useSportsData();

  const player = players.find((p) => p.id === id);
  const team = player ? teams.find((t) => t.id === player.teamId) : undefined;

  if (!player || !team) {
    if (loading) return <p className="p-6" role="status">Loading player…</p>;
    if (error) return <p className="p-6" role="alert">{error} <button onClick={() => void refreshData()}>Retry</button></p>;
    return (
      <div className="flex flex-col items-center gap-1.5 px-6 py-20 text-center">
        <p className="text-sm font-semibold text-foreground">Player not found</p>
        <p className="text-xs text-muted">This player may have been removed by an admin.</p>
      </div>
    );
  }

  return <PlayerDetailContent player={player} team={team} />;
}

function PlayerDetailContent({ player, team }: { player: Player; team: Team }) {
  const { players, seasons, getPlayerGameLog, getPlayerAverages } = useSportsData();
  const [selectedSeasonOption, setSelectedSeasonOption] = useState<string>("career");

  const seasonLines = useMemo(() => {
    return players
      .filter((p: Player) => p.personId === player.personId)
      .sort((a: Player, b: Player) => a.seasonId.localeCompare(b.seasonId));
  }, [players, player.personId]);

  const seasonLabel = useCallback(
    (seasonId: string): string => {
      return seasons.find((s) => s.id === seasonId)?.label ?? seasonId;
    },
    [seasons]
  );

  const gameLog = useMemo(() => {
    const lines = seasonLines.length > 0 ? seasonLines : [player];
    const allLogs = lines.flatMap((line: Player) => getPlayerGameLog(line.id));
    const seen = new Set<string>();
    return allLogs.filter((entry: PlayerGameLogEntry) => {
      if (seen.has(entry.game.id)) return false;
      seen.add(entry.game.id);
      return true;
    });
  }, [seasonLines, player, getPlayerGameLog]);

  const careerAverages = useMemo<SeasonAverages>(() => {
    const lines = seasonLines.length > 0 ? seasonLines : [player];
    const round1 = (value: number) => Math.round(value * 10) / 10;

    // Volleyball game logs do not carry sets played, so weight each season by
    // matches played. This is still far more accurate than treating a 1-game
    // season the same as a 20-game season.
    const isVolleyballCareer = lines.some((line) =>
      isVolleyballAverages(line.seasonAverages)
    );

    if (isVolleyballCareer) {
      const totals = new Map<string, number>();
      let totalWeight = 0;

      for (const line of lines) {
        const avg = getPlayerAverages(line);
        const weight = Math.max(1, avg.matchesPlayed ?? line.seasonAverages.matchesPlayed ?? 1);
        totalWeight += weight;
        for (const [key, value] of Object.entries(avg)) {
          if (typeof value === "number" && Number.isFinite(value)) {
            totals.set(key, (totals.get(key) ?? 0) + value * weight);
          }
        }
      }

      const weighted: Record<string, number> = {};
      for (const [key, value] of totals) {
        weighted[key] = round1(value / totalWeight);
      }
      return weighted as unknown as SeasonAverages;
    }

    // Basketball: aggregate the actual box-score lines so career percentages
    // are weighted by attempts rather than averaged across seasons.
    let gamesPlayed = 0;
    let pts = 0, reb = 0, ast = 0, stl = 0, blk = 0;
    let fgM = 0, fgA = 0, threeM = 0, threeA = 0, ftM = 0, ftA = 0;
    const seenGames = new Set<string>();

    for (const line of lines) {
      for (const entry of getPlayerGameLog(line.id)) {
        if (seenGames.has(entry.game.id)) continue;
        seenGames.add(entry.game.id);
        gamesPlayed += 1;
        pts += entry.stat.pts ?? 0;
        reb += entry.stat.reb ?? 0;
        ast += entry.stat.ast ?? 0;
        stl += entry.stat.stl ?? 0;
        blk += entry.stat.blk ?? 0;
        fgM += entry.stat.fgM ?? 0;
        fgA += entry.stat.fgA ?? 0;
        threeM += entry.stat.threeM ?? 0;
        threeA += entry.stat.threeA ?? 0;
        ftM += entry.stat.ftM ?? 0;
        ftA += entry.stat.ftA ?? 0;
      }
    }

    if (gamesPlayed === 0) {
      return player.seasonAverages;
    }

    return {
      ppg: round1(pts / gamesPlayed),
      rpg: round1(reb / gamesPlayed),
      apg: round1(ast / gamesPlayed),
      spg: round1(stl / gamesPlayed),
      bpg: round1(blk / gamesPlayed),
      fgPct: fgA > 0 ? round1((fgM / fgA) * 100) : 0,
      threePtPct: threeA > 0 ? round1((threeM / threeA) * 100) : 0,
      ftPct: ftA > 0 ? round1((ftM / ftA) * 100) : 0,
      totalPts: pts,
      matchesPlayed: gamesPlayed,
    };
  }, [seasonLines, player, getPlayerGameLog, getPlayerAverages]);

  // Find the last active season line for this player (most recent season line with recorded stats)
  const lastActiveLine = useMemo(() => {
    if (seasonLines.length === 0) return player;
    const sorted = [...seasonLines].reverse();
    return (
      sorted.find(
        (line) =>
          (line.seasonAverages.matchesPlayed ?? 0) > 0 ||
          (line.seasonAverages.totalPts ?? 0) > 0 ||
          line.seasonAverages.ppg > 0
      ) || sorted[0]
    );
  }, [seasonLines, player]);

  // Is player inactive in current/latest season?
  const latestLine = seasonLines.length > 0 ? seasonLines[seasonLines.length - 1] : player;
  const isInactiveInCurrent =
    (latestLine.seasonAverages.matchesPlayed ?? 0) === 0 &&
    (latestLine.seasonAverages.totalPts ?? 0) === 0 &&
    latestLine.seasonAverages.ppg === 0;

  const lastActiveLabel = seasonLabel(lastActiveLine.seasonId);

  // Active context label & custom averages for PlayerCard Hero Section
  const { heroAverages, activeContextLabel, inactivePillTag } = useMemo(() => {
    if (selectedSeasonOption === "career") {
      return {
        heroAverages: careerAverages,
        activeContextLabel: "Career Summary",
        inactivePillTag: undefined,
      };
    }

    const selectedPlayer = seasonLines.find((p: Player) => p.id === selectedSeasonOption);
    if (selectedPlayer) {
      const selectedAvg = getPlayerAverages(selectedPlayer);
      return {
        heroAverages: selectedAvg,
        activeContextLabel: seasonLabel(selectedPlayer.seasonId),
        inactivePillTag: undefined,
      };
    }

    // Default view: Fallback to Last Active Season if current season has 0 stats
    if (isInactiveInCurrent && lastActiveLine) {
      return {
        heroAverages: getPlayerAverages(lastActiveLine),
        activeContextLabel: undefined,
        inactivePillTag: `Last Active: ${lastActiveLabel}`,
      };
    }

    const defaultLine = latestLine || player;
    return {
      heroAverages: getPlayerAverages(defaultLine),
      activeContextLabel: seasonLabel(defaultLine.seasonId),
      inactivePillTag: undefined,
    };
  }, [
    selectedSeasonOption,
    careerAverages,
    seasonLines,
    getPlayerAverages,
    seasonLabel,
    isInactiveInCurrent,
    lastActiveLine,
    lastActiveLabel,
    latestLine,
    player,
  ]);

  const displayAverages = heroAverages;
  const isVolleyball = team.league === "PVL" || isVolleyballAverages(careerAverages);

  return (
    <div className="mx-auto flex w-full max-w-7xl min-w-0 flex-col gap-4 px-4 py-4 md:px-6">
      <PlayerCard
        player={player}
        team={team}
        variant="full"
        customAverages={heroAverages}
        activeContextLabel={activeContextLabel}
        inactivePillTag={inactivePillTag}
      />
      <StatCardExport player={player} team={team} />

      {isVolleyball ? (
        <PlayerVolleyballStats
          player={player}
          allPlayerSeasons={seasonLines.length > 0 ? seasonLines : [player]}
        />
      ) : (
        <div className="flex flex-col gap-3 rounded-2xl border border-border bg-surface p-5">
          <div className="flex items-center justify-between gap-3 border-b border-border pb-3">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-muted">
                Performance Overview
              </p>
              <p className="text-xs font-semibold text-foreground">
                {selectedSeasonOption === "career"
                  ? "Career / Lifetime Stats"
                  : activeContextLabel || seasonLabel(player.seasonId)}
              </p>
            </div>

            <label className="relative shrink-0">
              <select
                value={selectedSeasonOption}
                onChange={(e) => setSelectedSeasonOption(e.target.value)}
                className="appearance-none rounded-full border border-border bg-elevated py-1.5 pl-3 pr-7 text-xs font-semibold text-foreground focus:border-primary focus:outline-none"
              >
                <option value="career">Career / Lifetime Stats</option>
                {seasonLines.map((line: Player) => (
                  <option key={line.id} value={line.id}>
                    {seasonLabel(line.seasonId)}
                  </option>
                ))}
              </select>
              <ChevronDown
                size={12}
                className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-muted"
              />
            </label>
          </div>

          <CareerStatGrid averages={displayAverages} />

          {seasonLines.length > 0 ? (
            <ul className="flex flex-col gap-1.5 border-t border-border pt-3">
              {seasonLines.map((line: Player) => {
                const lineAvg = getPlayerAverages(line);
                return (
                  <li
                    key={line.id}
                    className="flex items-center justify-between gap-2 text-xs text-muted"
                  >
                    <span className="font-medium text-foreground/80">
                      {seasonLabel(line.seasonId)}
                    </span>
                    <span className="tabular-nums">
                      {`${formatAvg(lineAvg.ppg)} PPG`}
                    </span>
                  </li>
                );
              })}
            </ul>
          ) : null}
        </div>
      )}

      <div>
        <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted">
          Match History
        </p>
        <MatchHistory entries={gameLog} />
      </div>
    </div>
  );
}

