"use client";

import { useSportsData } from "@/context/SportsDataContext";
import { formatAvg, formatPct } from "@/lib/utils";
import type { Player, SeasonAverages } from "@/types/sports";
import { ChevronDown, Shield, Target, Zap, Activity } from "lucide-react";
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
  const [selectedOption, setSelectedOption] = useState<string>("career");

  const stats = useMemo(() => {
    if (selectedOption !== "career") {
      const active = allPlayerSeasons.find((p) => p.id === selectedOption) ?? player;
      const a = active.seasonAverages;
      const m = a.matchesPlayed ?? 0;
      const totPts = a.totalPts ?? (m > 0 ? Math.round(a.ppg * m) : 0);
      const atk = a.attackPts ?? 0;
      const blk = a.blockPts ?? 0;
      const srv = a.servePts ?? 0;
      return {
        totalPts: totPts,
        matches: m,
        ppg: a.ppg ?? 0,
        attackPts: atk,
        attackPct: a.attackPct ?? 0,
        attackAvg: a.attackAvg ?? (m > 0 ? Math.round((atk / m) * 10) / 10 : 0),
        blockPts: blk,
        blockPct: a.blockPct ?? 0,
        blockAvg: a.blockAvg ?? (m > 0 ? Math.round((blk / m) * 10) / 10 : 0),
        servePts: srv,
        servePct: a.servePct ?? 0,
        serveAvg: a.serveAvg ?? (m > 0 ? Math.round((srv / m) * 10) / 10 : 0),
      };
    }

    // Accumulate lifetime stats across ALL recorded season lines
    let totPts = 0;
    let totMatches = 0;
    let totAtk = 0;
    let totBlk = 0;
    let totSrv = 0;
    let sumAtkPct = 0;
    let sumBlkPct = 0;
    let sumSrvPct = 0;
    const count = allPlayerSeasons.length || 1;

    for (const p of allPlayerSeasons) {
      const a = p.seasonAverages;
      const m = a.matchesPlayed ?? 0;
      const pPts = a.totalPts ?? (m > 0 ? Math.round(a.ppg * m) : 0);
      const pAtk = a.attackPts ?? 0;
      const pBlk = a.blockPts ?? 0;
      const pSrv = a.servePts ?? 0;

      totPts += pPts;
      totMatches += m;
      totAtk += pAtk;
      totBlk += pBlk;
      totSrv += pSrv;
      sumAtkPct += a.attackPct ?? 0;
      sumBlkPct += a.blockPct ?? 0;
      sumSrvPct += a.servePct ?? 0;
    }

    const m = Math.max(1, totMatches);
    return {
      totalPts: totPts,
      matches: totMatches,
      ppg: Math.round((totPts / m) * 10) / 10,
      attackPts: totAtk,
      attackPct: Math.round((sumAtkPct / count) * 10) / 10,
      attackAvg: Math.round((totAtk / m) * 10) / 10,
      blockPts: totBlk,
      blockPct: Math.round((sumBlkPct / count) * 10) / 10,
      blockAvg: Math.round((totBlk / m) * 10) / 10,
      servePts: totSrv,
      servePct: Math.round((sumSrvPct / count) * 10) / 10,
      serveAvg: Math.round((totSrv / m) * 10) / 10,
    };
  }, [allPlayerSeasons, selectedOption, player]);

  const {
    totalPts,
    ppg,
    attackPts,
    attackPct,
    attackAvg,
    blockPts,
    blockPct,
    blockAvg,
    servePts,
    servePct,
    serveAvg,
  } = stats;

  function seasonLabel(seasonId: string): string {
    return seasons.find((s) => s.id === seasonId)?.label ?? seasonId;
  }

  const activeSeasonPlayer = selectedOption === "career" ? null : allPlayerSeasons.find((p) => p.id === selectedOption);
  const activeLabel = selectedOption === "career" ? "Career / Lifetime Stats" : seasonLabel(activeSeasonPlayer?.seasonId ?? player.seasonId);

  return (
    <div className="flex flex-col gap-4 rounded-2xl border border-border bg-surface p-5 shadow-sm">
      {/* Header & Season Selector */}
      <div className="flex items-center justify-between gap-3 border-b border-border pb-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wide text-muted">
            Statistics Overview
          </p>
          <p className="text-xs font-semibold text-foreground">
            {activeLabel}
          </p>
        </div>

        <label className="relative shrink-0">
          <select
            value={selectedOption}
            onChange={(e) => setSelectedOption(e.target.value)}
            className="appearance-none rounded-full border border-border bg-elevated py-1.5 pl-3 pr-7 text-xs font-semibold text-foreground focus:border-primary focus:outline-none"
          >
            <option value="career">Career / Lifetime Stats</option>
            {allPlayerSeasons.map((p) => (
              <option key={p.id} value={p.id}>
                {seasonLabel(p.seasonId)}
              </option>
            ))}
          </select>
          <ChevronDown
            size={12}
            className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-muted"
          />
        </label>
      </div>

      {/* Stat Categories */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {/* Overall */}
        <div className="flex flex-col gap-2 rounded-xl border border-border bg-elevated p-3.5">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
            <Activity size={14} className="text-primary" />
            <span>Overall</span>
          </div>
          <div className="grid grid-cols-2 gap-2 text-center pt-1">
            <div className="flex flex-col rounded-lg bg-surface py-2 border border-border/40">
              <span className="text-base font-bold tabular-nums text-foreground">{totalPts}</span>
              <span className="text-[10px] font-medium text-muted uppercase tracking-wide">Total Points</span>
            </div>
            <div className="flex flex-col rounded-lg bg-surface py-2 border border-border/40">
              <span className="text-base font-bold tabular-nums text-foreground">{formatAvg(ppg)}</span>
              <span className="text-[10px] font-medium text-muted uppercase tracking-wide">Avg / Match</span>
            </div>
          </div>
        </div>

        {/* Attack */}
        <div className="flex flex-col gap-2 rounded-xl border border-border bg-elevated p-3.5">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
            <Zap size={14} className="text-emerald-500" />
            <span>Attack</span>
          </div>
          <div className="grid grid-cols-3 gap-1.5 text-center pt-1">
            <div className="flex flex-col rounded-lg bg-surface py-2 border border-border/40">
              <span className="text-sm font-bold tabular-nums text-foreground">{attackPts}</span>
              <span className="text-[9px] font-medium text-muted uppercase tracking-wide">Points</span>
            </div>
            <div className="flex flex-col rounded-lg bg-surface py-2 border border-border/40">
              <span className="text-sm font-bold tabular-nums text-foreground">{formatPct(attackPct)}</span>
              <span className="text-[9px] font-medium text-muted uppercase tracking-wide">Efficiency</span>
            </div>
            <div className="flex flex-col rounded-lg bg-surface py-2 border border-border/40">
              <span className="text-sm font-bold tabular-nums text-foreground">{formatAvg(attackAvg)}</span>
              <span className="text-[9px] font-medium text-muted uppercase tracking-wide">Avg Pts</span>
            </div>
          </div>
        </div>

        {/* Block */}
        <div className="flex flex-col gap-2 rounded-xl border border-border bg-elevated p-3.5">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
            <Shield size={14} className="text-amber-500" />
            <span>Block</span>
          </div>
          <div className="grid grid-cols-3 gap-1.5 text-center pt-1">
            <div className="flex flex-col rounded-lg bg-surface py-2 border border-border/40">
              <span className="text-sm font-bold tabular-nums text-foreground">{blockPts}</span>
              <span className="text-[9px] font-medium text-muted uppercase tracking-wide">Points</span>
            </div>
            <div className="flex flex-col rounded-lg bg-surface py-2 border border-border/40">
              <span className="text-sm font-bold tabular-nums text-foreground">{formatPct(blockPct)}</span>
              <span className="text-[9px] font-medium text-muted uppercase tracking-wide">Success %</span>
            </div>
            <div className="flex flex-col rounded-lg bg-surface py-2 border border-border/40">
              <span className="text-sm font-bold tabular-nums text-foreground">{formatAvg(blockAvg)}</span>
              <span className="text-[9px] font-medium text-muted uppercase tracking-wide">Avg Pts</span>
            </div>
          </div>
        </div>

        {/* Serve */}
        <div className="flex flex-col gap-2 rounded-xl border border-border bg-elevated p-3.5">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
            <Target size={14} className="text-sky-500" />
            <span>Serve</span>
          </div>
          <div className="grid grid-cols-3 gap-1.5 text-center pt-1">
            <div className="flex flex-col rounded-lg bg-surface py-2 border border-border/40">
              <span className="text-sm font-bold tabular-nums text-foreground">{servePts}</span>
              <span className="text-[9px] font-medium text-muted uppercase tracking-wide">Aces</span>
            </div>
            <div className="flex flex-col rounded-lg bg-surface py-2 border border-border/40">
              <span className="text-sm font-bold tabular-nums text-foreground">{formatPct(servePct)}</span>
              <span className="text-[9px] font-medium text-muted uppercase tracking-wide">Success %</span>
            </div>
            <div className="flex flex-col rounded-lg bg-surface py-2 border border-border/40">
              <span className="text-sm font-bold tabular-nums text-foreground">{formatAvg(serveAvg)}</span>
              <span className="text-[9px] font-medium text-muted uppercase tracking-wide">Avg Pts</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
