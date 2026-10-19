"use client";

import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { StatTile, type StatTileTone } from "@/components/ui/StatTile";
import { useSportsData } from "@/context/SportsDataContext";
import { getOfficialPvlPlayerStats, type PvlOfficialPlayerStatItem } from "@/lib/pvl-official-stats-data";
import { formatAvg, formatPct } from "@/lib/utils";
import type { Player } from "@/types/sports";
import { ChevronDown } from "lucide-react";
import { useMemo, useState } from "react";

interface PlayerVolleyballStatsProps {
  player: Player;
  allPlayerSeasons: Player[];
}

type VolleyTile = {
  label: string;
  value: string | number;
  tone?: StatTileTone;
};

export function PlayerVolleyballStats({
  player,
  allPlayerSeasons,
}: PlayerVolleyballStatsProps) {
  const { seasons } = useSportsData();

  // Try matching official PVL statistics record from pvl_player_stats dataset
  const officialRecord = useMemo(() => {
    return (
      getOfficialPvlPlayerStats(player.personId, player.name) ||
      getOfficialPvlPlayerStats(player.id, player.name)
    );
  }, [player]);

  const [selectedOption, setSelectedOption] = useState<string>("career");

  // Determine active statistics payload
  const activeStat: PvlOfficialPlayerStatItem | null = useMemo(() => {
    if (!officialRecord) return null;
    if (selectedOption === "career") {
      return officialRecord.career || (officialRecord.conferences.length > 0 ? officialRecord.conferences[0] : null);
    }
    return (
      officialRecord.conferences.find(
        (c) => String(c.conferenceId) === selectedOption || c.conferenceName === selectedOption
      ) ??
      officialRecord.career ??
      null
    );
  }, [officialRecord, selectedOption]);

  // Fallback stats if official PVL record isn't available
  const fallbackStats = useMemo(() => {
    let totPts = 0;
    let totMatches = 0;
    let totSets = 0;
    let totAtk = 0;
    let totBlk = 0;
    let totSrv = 0;
    for (const p of allPlayerSeasons) {
      const a = p.seasonAverages;
      const m = a.matchesPlayed ?? 0;
      totPts += a.totalPts ?? (m > 0 ? Math.round(a.ppg * m) : 0);
      totMatches += m;
      // Use the recorded set count when the dataset has it; older rows only
      // carry matches, so fall back to a 3-set estimate.
      totSets += a.setsPlayed ?? m * 3;
      totAtk += a.ptsAtk ?? a.attackPts ?? 0;
      totBlk += a.ptsBlk ?? a.blockPts ?? 0;
      totSrv += a.ptsAce ?? a.servePts ?? 0;
    }
    const m = Math.max(1, totMatches);
    const sets = Math.max(1, totSets);
    return {
      setsPlayed: totSets,
      totalPoints: totPts,
      avgPerSet: Math.round((totPts / sets) * 100) / 100,
      ptsAtk: totAtk,
      ptsBlk: totBlk,
      ptsAce: totSrv,
      exeSet: 0,
      exeDig: 0,
      exeRec: 0,
      faultAtk: 0,
      faultBlk: 0,
      faultSrv: 0,
      faultSet: 0,
      faultDig: 0,
      faultRec: 0,
      totalAtk: 0,
      totalBlk: 0,
      totalAce: 0,
      totalSet: 0,
      totalDig: 0,
      totalRec: 0,
      avgAtk: Math.round((totAtk / m) * 10) / 10,
      avgBlk: Math.round((totBlk / m) * 10) / 10,
      avgAce: Math.round((totSrv / m) * 10) / 10,
      avgSet: 0,
      avgDig: 0,
      avgRec: 0,
      successAtk: 0,
      successBlk: 0,
      successAce: 0,
      successSet: 0,
      successDig: 0,
      successRec: 0,
      efficiencyAtk: 0,
      efficiencyBlk: 0,
      efficiencyAce: 0,
      efficiencySet: 0,
      efficiencyDig: 0,
      efficiencyRec: 0,
    };
  }, [allPlayerSeasons]);

  const stat = activeStat || fallbackStats;

  // Position normalization: OH / OP, MB, S, L
  const rawPos = (officialRecord?.position || player.position || "OH").toUpperCase();
  const isSetter = rawPos.startsWith("S");
  const isLibero = rawPos.startsWith("L");
  const isMB = rawPos.startsWith("MB");
  const isOP = rawPos.startsWith("OP") || rawPos.startsWith("OPS");

  // Format dropdown options
  const dropdownOptions = useMemo(() => {
    if (officialRecord && officialRecord.conferences.length > 0) {
      return [
        { value: "career", label: "Career / Lifetime Stats" },
        ...officialRecord.conferences.map((c) => ({
          value: String(c.conferenceId || c.conferenceName),
          label: c.conferenceName || `Conference ${c.conferenceId}`,
        })),
      ];
    }
    return [
      { value: "career", label: "Career / Lifetime Stats" },
      ...allPlayerSeasons.map((p) => {
        const seasonLabel = seasons.find((s) => s.id === p.seasonId)?.label ?? p.seasonId;
        return { value: p.id, label: seasonLabel };
      }),
    ];
  }, [officialRecord, allPlayerSeasons, seasons]);

  // Selected Option Label
  const activeLabel =
    dropdownOptions.find((o) => o.value === selectedOption)?.label ?? "Career / Lifetime Stats";

  const totalActions = isSetter
    ? stat.exeSet + stat.exeDig + stat.ptsAce
    : stat.totalPoints;

  let heroTiles: VolleyTile[];
  if (isLibero) {
    heroTiles = [
      { label: "Exc. Digs", value: stat.exeDig },
      { label: "Digs / Set", value: formatAvg(stat.avgDig), tone: "info" },
      { label: "Rec. Success", value: formatPct(stat.successRec), tone: "positive" },
    ];
  } else if (isSetter) {
    heroTiles = [
      { label: "Exc. Sets", value: stat.exeSet },
      { label: "Sets / Set", value: formatAvg(stat.avgSet), tone: "primary" },
      { label: "Sets Played", value: stat.setsPlayed },
    ];
  } else if (isMB) {
    heroTiles = [
      { label: "Total Points", value: stat.totalPoints },
      { label: "Kill Blocks", value: stat.ptsBlk, tone: "archive" },
      { label: "Blocks / Set", value: formatAvg(stat.avgBlk), tone: "info" },
    ];
  } else {
    heroTiles = [
      { label: "Total Points", value: stat.totalPoints },
      { label: "Avg / Set", value: formatAvg(stat.avgPerSet), tone: "info" },
      { label: "Sets Played", value: stat.setsPlayed },
    ];
  }

  let statTiles: VolleyTile[];
  if (isLibero) {
    statTiles = [
      { label: "Dig Success", value: formatPct(stat.successDig), tone: "positive" },
      { label: "Exc. Receptions", value: stat.exeRec },
      { label: "Rec / Set", value: formatAvg(stat.avgRec), tone: "info" },
      { label: "Rec Efficiency", value: formatPct(stat.efficiencyRec), tone: "positive" },
      { label: "Total Digs", value: stat.totalDig },
      { label: "Sets Played", value: stat.setsPlayed },
    ];
  } else if (isSetter) {
    statTiles = [
      { label: "Setting Success", value: formatPct(stat.successSet), tone: "positive" },
      { label: "Digs / Set", value: formatAvg(stat.avgDig), tone: "info" },
      { label: "Service Aces", value: stat.ptsAce, tone: "archive" },
      { label: "Aces / Set", value: formatAvg(stat.avgAce), tone: "info" },
      { label: "Dig Success", value: formatPct(stat.successDig), tone: "info" },
      { label: "Total Points", value: stat.totalPoints },
    ];
  } else if (isMB) {
    statTiles = [
      { label: "Atk Efficiency", value: formatPct(stat.efficiencyAtk), tone: "positive" },
      { label: "Block Success", value: formatPct(stat.successBlk), tone: "archive" },
      { label: "Kills / Set", value: formatAvg(stat.avgAtk), tone: "positive" },
      { label: "Aces / Set", value: formatAvg(stat.avgAce), tone: "info" },
      { label: "Digs / Set", value: formatAvg(stat.avgDig), tone: "info" },
      { label: "Sets Played", value: stat.setsPlayed },
    ];
  } else {
    statTiles = [
      { label: "Atk Efficiency", value: formatPct(stat.efficiencyAtk), tone: "positive" },
      { label: "Kills / Set", value: formatAvg(stat.avgAtk), tone: "positive" },
      {
        label: isOP ? "Block Success" : "Rec Success",
        value: formatPct(isOP ? stat.successBlk : stat.successRec),
        tone: "info",
      },
      { label: "Digs / Set", value: formatAvg(stat.avgDig), tone: "info" },
      { label: "Aces / Set", value: formatAvg(stat.avgAce), tone: "info" },
      { label: "Blocks / Set", value: formatAvg(stat.avgBlk), tone: "archive" },
    ];
  }

  return (
    <Card className="flex flex-col gap-4 p-5">
      {/* Header & Season Selector */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-3">
        <div className="min-w-0">
          <div className="flex items-center gap-1.5">
            <Badge tone="primary" size="sm">
              {rawPos}
            </Badge>
            <p className="text-2xs font-semibold uppercase tracking-wide text-muted">
              Official Stats
            </p>
          </div>
          <p className="mt-0.5 truncate text-xs font-semibold text-foreground">{activeLabel}</p>
        </div>

        <div className="relative shrink-0">
          <select
            aria-label="Season"
            value={selectedOption}
            onChange={(e) => setSelectedOption(e.target.value)}
            className="min-h-10 appearance-none rounded-control border border-border bg-elevated py-1.5 pl-3 pr-8 text-xs font-semibold text-foreground transition-colors hover:border-border-strong focus:border-primary/70 focus:outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
          >
            {dropdownOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
          <ChevronDown
            size={12}
            aria-hidden="true"
            className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-muted"
          />
        </div>
      </div>

      {/* 1. Hero tiles (top 3 key metrics per position) */}
      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
        {heroTiles.map((tile, index) => (
          <StatTile
            key={tile.label}
            label={tile.label}
            value={tile.value}
            tone={tile.tone}
            size="lg"
            className={
              index === 2
                ? "col-span-2 items-center text-center sm:col-span-1"
                : "items-center text-center"
            }
          />
        ))}
      </div>

      {/* 2. Scoring bar / playmaking bar (hidden for libero) */}
      {!isLibero && totalActions > 0 && (
        <div className="flex flex-col gap-2 rounded-card border border-border bg-elevated/60 p-3.5">
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs font-semibold text-foreground">
            <span>{isSetter ? "Playmaking & Defense Breakdown" : "Scoring Breakdown"}</span>
            <span className="text-2xs font-medium text-muted">
              {isSetter ? `${totalActions} Total Actions` : `${totalActions} Total Points`}
            </span>
          </div>

          {/* Progress bar (only render a segment if its value is > 0) */}
          <div className="flex h-3 w-full overflow-hidden rounded-full border border-border/40 bg-surface p-0.5">
            {isSetter ? (
              <>
                {stat.exeSet > 0 && (
                  <div
                    style={{ width: `${(stat.exeSet / Math.max(1, totalActions)) * 100}%` }}
                    className="rounded-l-full bg-primary transition-all"
                    title={`Sets: ${stat.exeSet}`}
                  />
                )}
                {stat.exeDig > 0 && (
                  <div
                    style={{ width: `${(stat.exeDig / Math.max(1, totalActions)) * 100}%` }}
                    className="bg-info transition-all"
                    title={`Digs: ${stat.exeDig}`}
                  />
                )}
                {stat.ptsAce > 0 && (
                  <div
                    style={{ width: `${(stat.ptsAce / Math.max(1, totalActions)) * 100}%` }}
                    className="rounded-r-full bg-archive transition-all"
                    title={`Aces: ${stat.ptsAce}`}
                  />
                )}
              </>
            ) : (
              <>
                {stat.ptsAtk > 0 && (
                  <div
                    style={{ width: `${(stat.ptsAtk / Math.max(1, stat.totalPoints)) * 100}%` }}
                    className="rounded-l-full bg-positive transition-all"
                    title={`Spikes: ${stat.ptsAtk}`}
                  />
                )}
                {stat.ptsBlk > 0 && (
                  <div
                    style={{ width: `${(stat.ptsBlk / Math.max(1, stat.totalPoints)) * 100}%` }}
                    className="bg-archive transition-all"
                    title={`Blocks: ${stat.ptsBlk}`}
                  />
                )}
                {stat.ptsAce > 0 && (
                  <div
                    style={{ width: `${(stat.ptsAce / Math.max(1, stat.totalPoints)) * 100}%` }}
                    className="rounded-r-full bg-info transition-all"
                    title={`Aces: ${stat.ptsAce}`}
                  />
                )}
              </>
            )}
          </div>

          {/* Bar legend */}
          <div className="flex flex-wrap items-center justify-around gap-x-4 gap-y-1.5 pt-1 text-3xs font-medium text-muted">
            {isSetter ? (
              <>
                <div className="flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-primary" aria-hidden="true" />
                  <span>
                    Sets: <strong className="text-foreground">{stat.exeSet}</strong>
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-info" aria-hidden="true" />
                  <span>
                    Digs: <strong className="text-foreground">{stat.exeDig}</strong>
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-archive" aria-hidden="true" />
                  <span>
                    Aces: <strong className="text-foreground">{stat.ptsAce}</strong>
                  </span>
                </div>
              </>
            ) : (
              <>
                <div className="flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-positive" aria-hidden="true" />
                  <span>
                    Spikes: <strong className="text-foreground">{stat.ptsAtk}</strong>
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-archive" aria-hidden="true" />
                  <span>
                    Blocks: <strong className="text-foreground">{stat.ptsBlk}</strong>
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-info" aria-hidden="true" />
                  <span>
                    Aces: <strong className="text-foreground">{stat.ptsAce}</strong>
                  </span>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* 3. Full stat grid (6 unique metrics per position) */}
      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
        {statTiles.map((tile) => (
          <StatTile
            key={tile.label}
            label={tile.label}
            value={tile.value}
            tone={tile.tone}
            size="md"
          />
        ))}
      </div>
    </Card>
  );
}
