"use client";

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
    let totAtk = 0;
    let totBlk = 0;
    let totSrv = 0;
    for (const p of allPlayerSeasons) {
      const a = p.seasonAverages;
      const m = a.matchesPlayed ?? 0;
      totPts += a.totalPts ?? (m > 0 ? Math.round(a.ppg * m) : 0);
      totMatches += m;
      totAtk += a.ptsAtk ?? a.attackPts ?? 0;
      totBlk += a.ptsBlk ?? a.blockPts ?? 0;
      totSrv += a.ptsAce ?? a.servePts ?? 0;
    }
    const m = Math.max(1, totMatches);
    return {
      setsPlayed: totMatches * 3,
      totalPoints: totPts,
      avgPerSet: Math.round((totPts / Math.max(1, totMatches * 3)) * 100) / 100,
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
  const isOH = rawPos.startsWith("OH") || rawPos.startsWith("OS");
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

  return (
    <div className="flex flex-col gap-4 rounded-2xl border border-border bg-surface p-5 shadow-sm">
      {/* Header & Season Selector */}
      <div className="flex items-center justify-between gap-3 border-b border-border pb-3">
        <div>
          <div className="flex items-center gap-1.5">
            <span className="rounded bg-primary/15 px-2 py-0.5 text-[10px] font-bold text-primary uppercase tracking-wider">
              {rawPos}
            </span>
            <p className="text-[11px] font-semibold uppercase tracking-wide text-muted">
              Official Stats
            </p>
          </div>
          <p className="text-xs font-semibold text-foreground mt-0.5">{activeLabel}</p>
        </div>

        <label className="relative shrink-0">
          <select
            value={selectedOption}
            onChange={(e) => setSelectedOption(e.target.value)}
            className="appearance-none rounded-full border border-border bg-elevated py-1.5 pl-3 pr-7 text-xs font-semibold text-foreground focus:border-primary focus:outline-none"
          >
            {dropdownOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
          <ChevronDown
            size={12}
            className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-muted"
          />
        </label>
      </div>

      {/* 1. HERO CARDS (Top 3 Key Metrics per Position) */}
      <div className="grid grid-cols-3 gap-2.5 text-center">
        {isLibero ? (
          <>
            <div className="flex flex-col rounded-xl border border-border/60 bg-elevated py-3 px-2">
              <span className="text-lg font-bold tabular-nums text-foreground">{stat.exeDig}</span>
              <span className="text-[10px] font-semibold text-muted uppercase tracking-wide">
                Exc. Digs
              </span>
            </div>
            <div className="flex flex-col rounded-xl border border-border/60 bg-elevated py-3 px-2">
              <span className="text-lg font-bold tabular-nums text-primary">
                {formatAvg(stat.avgDig)}
              </span>
              <span className="text-[10px] font-semibold text-muted uppercase tracking-wide">
                Digs / Set
              </span>
            </div>
            <div className="flex flex-col rounded-xl border border-border/60 bg-elevated py-3 px-2">
              <span className="text-lg font-bold tabular-nums text-emerald-500">
                {formatPct(stat.successRec)}
              </span>
              <span className="text-[10px] font-semibold text-muted uppercase tracking-wide">
                Rec. Success
              </span>
            </div>
          </>
        ) : isSetter ? (
          <>
            <div className="flex flex-col rounded-xl border border-border/60 bg-elevated py-3 px-2">
              <span className="text-lg font-bold tabular-nums text-foreground">{stat.exeSet}</span>
              <span className="text-[10px] font-semibold text-muted uppercase tracking-wide">
                Exc. Sets
              </span>
            </div>
            <div className="flex flex-col rounded-xl border border-border/60 bg-elevated py-3 px-2">
              <span className="text-lg font-bold tabular-nums text-primary">
                {formatAvg(stat.avgSet)}
              </span>
              <span className="text-[10px] font-semibold text-muted uppercase tracking-wide">
                Sets / Set
              </span>
            </div>
            <div className="flex flex-col rounded-xl border border-border/60 bg-elevated py-3 px-2">
              <span className="text-lg font-bold tabular-nums text-foreground">
                {stat.setsPlayed}
              </span>
              <span className="text-[10px] font-semibold text-muted uppercase tracking-wide">
                Sets Played
              </span>
            </div>
          </>
        ) : isMB ? (
          <>
            <div className="flex flex-col rounded-xl border border-border/60 bg-elevated py-3 px-2">
              <span className="text-lg font-bold tabular-nums text-foreground">
                {stat.totalPoints}
              </span>
              <span className="text-[10px] font-semibold text-muted uppercase tracking-wide">
                Total Points
              </span>
            </div>
            <div className="flex flex-col rounded-xl border border-border/60 bg-elevated py-3 px-2">
              <span className="text-lg font-bold tabular-nums text-amber-500">{stat.ptsBlk}</span>
              <span className="text-[10px] font-semibold text-muted uppercase tracking-wide">
                Kill Blocks
              </span>
            </div>
            <div className="flex flex-col rounded-xl border border-border/60 bg-elevated py-3 px-2">
              <span className="text-lg font-bold tabular-nums text-primary">
                {formatAvg(stat.avgBlk)}
              </span>
              <span className="text-[10px] font-semibold text-muted uppercase tracking-wide">
                Blocks / Set
              </span>
            </div>
          </>
        ) : (
          /* OH & OP */
          <>
            <div className="flex flex-col rounded-xl border border-border/60 bg-elevated py-3 px-2">
              <span className="text-lg font-bold tabular-nums text-foreground">
                {stat.totalPoints}
              </span>
              <span className="text-[10px] font-semibold text-muted uppercase tracking-wide">
                Total Points
              </span>
            </div>
            <div className="flex flex-col rounded-xl border border-border/60 bg-elevated py-3 px-2">
              <span className="text-lg font-bold tabular-nums text-primary">
                {formatAvg(stat.avgPerSet)}
              </span>
              <span className="text-[10px] font-semibold text-muted uppercase tracking-wide">
                Avg / Set
              </span>
            </div>
            <div className="flex flex-col rounded-xl border border-border/60 bg-elevated py-3 px-2">
              <span className="text-lg font-bold tabular-nums text-foreground">
                {stat.setsPlayed}
              </span>
              <span className="text-[10px] font-semibold text-muted uppercase tracking-wide">
                Sets Played
              </span>
            </div>
          </>
        )}
      </div>

      {/* 2. SCORING BAR / PLAYMAKING BAR (Hidden for Libero; 0-value colors strictly omitted) */}
      {!isLibero && totalActions > 0 && (
        <div className="flex flex-col gap-2 rounded-xl border border-border bg-elevated p-3.5">
          <div className="flex items-center justify-between text-xs font-semibold text-foreground">
            <span>{isSetter ? "Playmaking & Defense Breakdown" : "Scoring Breakdown"}</span>
            <span className="text-[10px] font-medium text-muted">
              {isSetter ? `${totalActions} Total Actions` : `${totalActions} Total Points`}
            </span>
          </div>

          {/* Progress Bar (ONLY render segment if value > 0) */}
          <div className="flex h-3 w-full overflow-hidden rounded-full bg-surface p-0.5 border border-border/40">
            {isSetter ? (
              <>
                {stat.exeSet > 0 && (
                  <div
                    style={{ width: `${(stat.exeSet / Math.max(1, totalActions)) * 100}%` }}
                    className="bg-indigo-500 rounded-l-full transition-all"
                    title={`Sets: ${stat.exeSet}`}
                  />
                )}
                {stat.exeDig > 0 && (
                  <div
                    style={{ width: `${(stat.exeDig / Math.max(1, totalActions)) * 100}%` }}
                    className="bg-teal-500 transition-all"
                    title={`Digs: ${stat.exeDig}`}
                  />
                )}
                {stat.ptsAce > 0 && (
                  <div
                    style={{ width: `${(stat.ptsAce / Math.max(1, totalActions)) * 100}%` }}
                    className="bg-sky-500 rounded-r-full transition-all"
                    title={`Aces: ${stat.ptsAce}`}
                  />
                )}
              </>
            ) : (
              <>
                {stat.ptsAtk > 0 && (
                  <div
                    style={{ width: `${(stat.ptsAtk / Math.max(1, stat.totalPoints)) * 100}%` }}
                    className="bg-emerald-500 rounded-l-full transition-all"
                    title={`Spikes: ${stat.ptsAtk}`}
                  />
                )}
                {stat.ptsBlk > 0 && (
                  <div
                    style={{ width: `${(stat.ptsBlk / Math.max(1, stat.totalPoints)) * 100}%` }}
                    className="bg-amber-500 transition-all"
                    title={`Blocks: ${stat.ptsBlk}`}
                  />
                )}
                {stat.ptsAce > 0 && (
                  <div
                    style={{ width: `${(stat.ptsAce / Math.max(1, stat.totalPoints)) * 100}%` }}
                    className="bg-sky-500 rounded-r-full transition-all"
                    title={`Aces: ${stat.ptsAce}`}
                  />
                )}
              </>
            )}
          </div>

          {/* Bar Legend */}
          <div className="flex items-center justify-around text-[10px] font-medium text-muted pt-1">
            {isSetter ? (
              <>
                <div className="flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-indigo-500" />
                  <span>
                    Sets: <strong className="text-foreground">{stat.exeSet}</strong>
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-teal-500" />
                  <span>
                    Digs: <strong className="text-foreground">{stat.exeDig}</strong>
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-sky-500" />
                  <span>
                    Aces: <strong className="text-foreground">{stat.ptsAce}</strong>
                  </span>
                </div>
              </>
            ) : (
              <>
                <div className="flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-emerald-500" />
                  <span>
                    Spikes: <strong className="text-foreground">{stat.ptsAtk}</strong>
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-amber-500" />
                  <span>
                    Blocks: <strong className="text-foreground">{stat.ptsBlk}</strong>
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-sky-500" />
                  <span>
                    Aces: <strong className="text-foreground">{stat.ptsAce}</strong>
                  </span>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* 3. DISPLAY STATS GRID (6 Unique Metrics Per Position — Zero Metric Repetition) */}
      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
        {isLibero ? (
          <>
            <div className="flex flex-col gap-0.5 rounded-xl border border-border/50 bg-elevated p-3">
              <span className="text-[10px] font-semibold text-muted uppercase">Dig Success</span>
              <span className="text-base font-bold tabular-nums text-emerald-500">
                {formatPct(stat.successDig)}
              </span>
            </div>
            <div className="flex flex-col gap-0.5 rounded-xl border border-border/50 bg-elevated p-3">
              <span className="text-[10px] font-semibold text-muted uppercase">Exc. Receptions</span>
              <span className="text-base font-bold tabular-nums text-foreground">
                {stat.exeRec}
              </span>
            </div>
            <div className="flex flex-col gap-0.5 rounded-xl border border-border/50 bg-elevated p-3">
              <span className="text-[10px] font-semibold text-muted uppercase">Rec / Set</span>
              <span className="text-base font-bold tabular-nums text-sky-500">
                {formatAvg(stat.avgRec)}
              </span>
            </div>
            <div className="flex flex-col gap-0.5 rounded-xl border border-border/50 bg-elevated p-3">
              <span className="text-[10px] font-semibold text-muted uppercase">Rec Efficiency</span>
              <span className="text-base font-bold tabular-nums text-emerald-500">
                {formatPct(stat.efficiencyRec)}
              </span>
            </div>
            <div className="flex flex-col gap-0.5 rounded-xl border border-border/50 bg-elevated p-3">
              <span className="text-[10px] font-semibold text-muted uppercase">Total Digs</span>
              <span className="text-base font-bold tabular-nums text-foreground">
                {stat.totalDig}
              </span>
            </div>
            <div className="flex flex-col gap-0.5 rounded-xl border border-border/50 bg-elevated p-3">
              <span className="text-[10px] font-semibold text-muted uppercase">Sets Played</span>
              <span className="text-base font-bold tabular-nums text-foreground">
                {stat.setsPlayed}
              </span>
            </div>
          </>
        ) : isSetter ? (
          <>
            <div className="flex flex-col gap-0.5 rounded-xl border border-border/50 bg-elevated p-3">
              <span className="text-[10px] font-semibold text-muted uppercase">Setting Success</span>
              <span className="text-base font-bold tabular-nums text-emerald-500">
                {formatPct(stat.successSet)}
              </span>
            </div>
            <div className="flex flex-col gap-0.5 rounded-xl border border-border/50 bg-elevated p-3">
              <span className="text-[10px] font-semibold text-muted uppercase">Digs / Set</span>
              <span className="text-base font-bold tabular-nums text-teal-500">
                {formatAvg(stat.avgDig)}
              </span>
            </div>
            <div className="flex flex-col gap-0.5 rounded-xl border border-border/50 bg-elevated p-3">
              <span className="text-[10px] font-semibold text-muted uppercase">Service Aces</span>
              <span className="text-base font-bold tabular-nums text-sky-500">{stat.ptsAce}</span>
            </div>
            <div className="flex flex-col gap-0.5 rounded-xl border border-border/50 bg-elevated p-3">
              <span className="text-[10px] font-semibold text-muted uppercase">Aces / Set</span>
              <span className="text-base font-bold tabular-nums text-sky-500">
                {formatAvg(stat.avgAce)}
              </span>
            </div>
            <div className="flex flex-col gap-0.5 rounded-xl border border-border/50 bg-elevated p-3">
              <span className="text-[10px] font-semibold text-muted uppercase">Dig Success</span>
              <span className="text-base font-bold tabular-nums text-teal-500">
                {formatPct(stat.successDig)}
              </span>
            </div>
            <div className="flex flex-col gap-0.5 rounded-xl border border-border/50 bg-elevated p-3">
              <span className="text-[10px] font-semibold text-muted uppercase">Total Points</span>
              <span className="text-base font-bold tabular-nums text-foreground">
                {stat.totalPoints}
              </span>
            </div>
          </>
        ) : isMB ? (
          <>
            <div className="flex flex-col gap-0.5 rounded-xl border border-border/50 bg-elevated p-3">
              <span className="text-[10px] font-semibold text-muted uppercase">Atk Efficiency</span>
              <span className="text-base font-bold tabular-nums text-emerald-500">
                {formatPct(stat.efficiencyAtk)}
              </span>
            </div>
            <div className="flex flex-col gap-0.5 rounded-xl border border-border/50 bg-elevated p-3">
              <span className="text-[10px] font-semibold text-muted uppercase">Block Success</span>
              <span className="text-base font-bold tabular-nums text-amber-500">
                {formatPct(stat.successBlk)}
              </span>
            </div>
            <div className="flex flex-col gap-0.5 rounded-xl border border-border/50 bg-elevated p-3">
              <span className="text-[10px] font-semibold text-muted uppercase">Kills / Set</span>
              <span className="text-base font-bold tabular-nums text-emerald-500">
                {formatAvg(stat.avgAtk)}
              </span>
            </div>
            <div className="flex flex-col gap-0.5 rounded-xl border border-border/50 bg-elevated p-3">
              <span className="text-[10px] font-semibold text-muted uppercase">Aces / Set</span>
              <span className="text-base font-bold tabular-nums text-sky-500">
                {formatAvg(stat.avgAce)}
              </span>
            </div>
            <div className="flex flex-col gap-0.5 rounded-xl border border-border/50 bg-elevated p-3">
              <span className="text-[10px] font-semibold text-muted uppercase">Digs / Set</span>
              <span className="text-base font-bold tabular-nums text-teal-500">
                {formatAvg(stat.avgDig)}
              </span>
            </div>
            <div className="flex flex-col gap-0.5 rounded-xl border border-border/50 bg-elevated p-3">
              <span className="text-[10px] font-semibold text-muted uppercase">Sets Played</span>
              <span className="text-base font-bold tabular-nums text-foreground">
                {stat.setsPlayed}
              </span>
            </div>
          </>
        ) : (
          /* OH & OP */
          <>
            <div className="flex flex-col gap-0.5 rounded-xl border border-border/50 bg-elevated p-3">
              <span className="text-[10px] font-semibold text-muted uppercase">Atk Efficiency</span>
              <span className="text-base font-bold tabular-nums text-emerald-500">
                {formatPct(stat.efficiencyAtk)}
              </span>
            </div>
            <div className="flex flex-col gap-0.5 rounded-xl border border-border/50 bg-elevated p-3">
              <span className="text-[10px] font-semibold text-muted uppercase">Kills / Set</span>
              <span className="text-base font-bold tabular-nums text-emerald-500">
                {formatAvg(stat.avgAtk)}
              </span>
            </div>
            <div className="flex flex-col gap-0.5 rounded-xl border border-border/50 bg-elevated p-3">
              <span className="text-[10px] font-semibold text-muted uppercase">
                {isOP ? "Block Success" : "Rec Success"}
              </span>
              <span className="text-base font-bold tabular-nums text-sky-500">
                {formatPct(isOP ? stat.successBlk : stat.successRec)}
              </span>
            </div>
            <div className="flex flex-col gap-0.5 rounded-xl border border-border/50 bg-elevated p-3">
              <span className="text-[10px] font-semibold text-muted uppercase">Digs / Set</span>
              <span className="text-base font-bold tabular-nums text-teal-500">
                {formatAvg(stat.avgDig)}
              </span>
            </div>
            <div className="flex flex-col gap-0.5 rounded-xl border border-border/50 bg-elevated p-3">
              <span className="text-[10px] font-semibold text-muted uppercase">Aces / Set</span>
              <span className="text-base font-bold tabular-nums text-sky-500">
                {formatAvg(stat.avgAce)}
              </span>
            </div>
            <div className="flex flex-col gap-0.5 rounded-xl border border-border/50 bg-elevated p-3">
              <span className="text-[10px] font-semibold text-muted uppercase">Blocks / Set</span>
              <span className="text-base font-bold tabular-nums text-amber-500">
                {formatAvg(stat.avgBlk)}
              </span>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
