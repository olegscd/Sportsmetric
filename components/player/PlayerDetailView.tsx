"use client";

import { useSportsData } from "@/context/SportsDataContext";
import { formatAvg, formatPct } from "@/lib/utils";
import type { SeasonAverages } from "@/types/sports";
import { MatchHistory } from "./MatchHistory";
import { PlayerCard } from "./PlayerCard";
import { StatCardExport } from "./StatCardExport";

function isVolleyballAverages(avg: SeasonAverages): boolean {
  return avg.killsPerSet !== undefined;
}

function CareerStatGrid({ averages }: { averages: SeasonAverages }) {
  const tiles = isVolleyballAverages(averages)
    ? [
        { label: "Kills/Set", value: formatAvg(averages.killsPerSet ?? 0) },
        { label: "Digs/Set", value: formatAvg(averages.digsPerSet ?? 0) },
        { label: "Blocks/Set", value: formatAvg(averages.blocksPerSet ?? 0) },
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
  const { players, teams, seasons, getPlayerGameLog, getPlayerAverages } = useSportsData();

  const player = players.find((p) => p.id === id);
  const team = player ? teams.find((t) => t.id === player.teamId) : undefined;

  if (!player || !team) {
    return (
      <div className="flex flex-col items-center gap-1.5 px-6 py-20 text-center">
        <p className="text-sm font-semibold text-foreground">Player not found</p>
        <p className="text-xs text-muted">This player may have been removed by an admin.</p>
      </div>
    );
  }

  const gameLog = getPlayerGameLog(player.id);
  const derivedAverages = getPlayerAverages(player);

  const seasonLines = players
    .filter((p) => p.personId === player.personId)
    .sort((a, b) => a.seasonId.localeCompare(b.seasonId));

  function seasonLabel(seasonId: string): string {
    return seasons.find((s) => s.id === seasonId)?.label ?? seasonId;
  }

  return (
    <div className="flex flex-col gap-4 px-4 py-4">
      <PlayerCard player={player} team={team} variant="full" />
      <StatCardExport player={player} team={team} />

      {seasonLines.length > 0 ? (
        <div className="flex flex-col gap-3 rounded-2xl border border-border bg-surface p-5">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wide text-muted">
              Season & Career Performance
            </p>
            <p className="mt-0.5 text-xs text-muted">
              Derived from {gameLog.length} recorded games across {seasonLines.length} season row(s)
            </p>
          </div>
          <CareerStatGrid averages={derivedAverages} />
          <ul className="flex flex-col gap-1.5 border-t border-border pt-3">
            {seasonLines.map((line) => {
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
                    {isVolleyballAverages(lineAvg)
                      ? `${formatAvg(lineAvg.killsPerSet ?? 0)} K/S`
                      : `${formatAvg(lineAvg.ppg)} PPG`}
                  </span>
                </li>
              );
            })}
          </ul>
        </div>
      ) : null}

      <div>
        <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted">
          Match History
        </p>
        <MatchHistory entries={gameLog} />
      </div>
    </div>
  );
}
