"use client";

import { TeamBadge } from "@/components/ui/TeamBadge";
import type { PlayerGameLogEntry } from "@/lib/data";
import { useGameModal } from "@/lib/game-modal-context";
import { cn, formatStartTime } from "@/lib/utils";

export function MatchHistory({ entries }: { entries: PlayerGameLogEntry[] }) {
  const { openGame } = useGameModal();

  if (entries.length === 0) {
    return (
      <p className="py-6 text-center text-sm text-muted">No match history yet.</p>
    );
  }

  return (
    <div className="flex flex-col gap-2.5">
      {entries.map(({ game, opponent, isHome, stat }) => {
        const teamScore = isHome ? game.homeScore : game.awayScore;
        const oppScore = isHome ? game.awayScore : game.homeScore;
        const isWin = game.status === "FINAL" && teamScore > oppScore;
        const isLoss = game.status === "FINAL" && teamScore < oppScore;

        return (
          <button
            key={game.id}
            type="button"
            onClick={() => openGame(game.id)}
            className="flex items-center gap-3 rounded-2xl border border-border bg-surface p-3 text-left active:scale-[0.99]"
          >
            <div
              className={cn(
                "flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold",
                isWin && "bg-primary/15 text-primary",
                isLoss && "bg-elevated text-muted",
                game.status === "LIVE" && "bg-live/15 text-live"
              )}
            >
              {isWin ? "W" : isLoss ? "L" : "LIVE"}
            </div>

            <TeamBadge team={opponent} size="sm" />

            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-foreground">
                {isHome ? "vs" : "@"} {opponent.shortName}
                <span className="ml-1.5 font-normal tabular-nums text-muted">
                  {teamScore}-{oppScore}
                </span>
              </p>
              <p className="truncate text-xs text-muted">
                {game.status === "LIVE" ? "Live now" : formatStartTime(game.startTime)}
              </p>
            </div>

            <div className="flex shrink-0 flex-col items-end gap-0.5">
              <span className="text-sm font-bold tabular-nums text-foreground">
                {stat.pts} <span className="text-[10px] font-medium text-muted">PTS</span>
              </span>
              <span className="text-[10px] tabular-nums text-muted">
                {stat.reb} REB &middot; {stat.ast} AST &middot; {stat.stl ?? 0} STL &middot; {stat.blk ?? 0} BLK
              </span>
            </div>
          </button>
        );
      })}
    </div>
  );
}
