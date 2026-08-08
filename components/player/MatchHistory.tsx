"use client";

import { TeamBadge } from "@/components/ui/TeamBadge";
import { isPlayoffGame, type PlayerGameLogEntry } from "@/lib/derivations";
import { useGameModal } from "@/lib/game-modal-context";
import { cn, formatGameDate, formatStartTime } from "@/lib/utils";

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
        const playoff = isPlayoffGame(game);
        const isVolleyball = game.league === "PVL" || stat.atkPts !== undefined;
        const dateStr = formatGameDate(game.startTime, true);

        return (
          <button
            key={game.id}
            type="button"
            onClick={() => openGame(game.id)}
            className="flex items-center gap-3 rounded-2xl border border-stone-300/60 bg-[#F8F7F2] p-3 text-left shadow-sm active:scale-[0.99] transition-transform"
          >
            <div
              className={cn(
                "flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold",
                isWin && "bg-emerald-600/20 text-emerald-800",
                isLoss && "bg-stone-300/80 text-zinc-700",
                game.status === "LIVE" && "bg-live/20 text-live"
              )}
            >
              {isWin ? "W" : isLoss ? "L" : "LIVE"}
            </div>

            <TeamBadge team={opponent} size="sm" />

            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5 truncate">
                <p className="truncate text-sm font-bold text-zinc-900">
                  {isHome ? "vs" : "@"} {opponent.shortName}
                  <span className="ml-1.5 font-semibold tabular-nums text-zinc-700">
                    {teamScore}-{oppScore}
                  </span>
                </p>
                {playoff && (
                  <span className="rounded bg-amber-600/20 px-1.5 py-0.5 text-[9px] font-extrabold text-amber-900 uppercase tracking-wider shrink-0">
                    Playoffs
                  </span>
                )}
              </div>
              <p className="truncate text-xs text-muted">
                {dateStr ? `${dateStr} \u2022 ` : ""}{game.status === "LIVE" ? "Live now" : formatStartTime(game.startTime)}
              </p>
            </div>

            <div className="flex shrink-0 flex-col items-end gap-0.5">
              <span className="text-sm font-bold tabular-nums text-foreground">
                {stat.pts} <span className="text-[10px] font-medium text-muted">PTS</span>
              </span>
              {!isVolleyball && (
                <span className="text-[10px] tabular-nums text-muted">
                  {stat.reb} REB &middot; {stat.ast} AST &middot; {stat.stl ?? 0} STL &middot; {stat.blk ?? 0} BLK
                </span>
              )}
            </div>
          </button>
        );
      })}
    </div>
  );
}
