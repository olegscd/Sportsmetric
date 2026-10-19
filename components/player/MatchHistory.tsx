"use client";

import { Badge } from "@/components/ui/Badge";
import { cardClasses } from "@/components/ui/Card";
import { TeamBadge } from "@/components/ui/TeamBadge";
import {
  getEffectiveGameStatus,
  isPlayoffGame,
  type PlayerGameLogEntry,
} from "@/lib/derivations";
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
        const status = getEffectiveGameStatus(game);
        const isFinal = status === "FINAL";
        const isLive = status === "LIVE";
        const isWin = isFinal && teamScore > oppScore;
        const isLoss = isFinal && teamScore < oppScore;
        const isTie = isFinal && teamScore === oppScore;
        const playoff = isPlayoffGame(game);
        const isVolleyball = game.league === "PVL" || stat.atkPts !== undefined;
        const dateStr = formatGameDate(game.startTime, true);

        const marker = isWin ? "W" : isLoss ? "L" : isTie ? "T" : isLive ? "LIVE" : "—";

        return (
          <button
            key={game.id}
            type="button"
            onClick={() => openGame(game.id)}
            className={cardClasses({
              interactive: true,
              className: "flex w-full flex-wrap items-center gap-3 p-3 text-left",
            })}
          >
            <span
              aria-hidden="true"
              className={cn(
                "flex h-9 w-9 shrink-0 items-center justify-center rounded-full border text-3xs font-black",
                isWin && "border-positive/30 bg-positive/15 text-positive",
                isLoss && "border-negative/30 bg-negative/15 text-negative",
                isTie && "border-border bg-elevated text-muted",
                isLive && "border-live/30 bg-live/15 text-live",
                status === "UPCOMING" && "border-border bg-surface-2 text-muted"
              )}
            >
              {marker}
            </span>

            <TeamBadge team={opponent} size="sm" />

            <span className="min-w-0 flex-1">
              <span className="flex items-center gap-1.5">
                <span className="truncate text-sm font-bold text-foreground">
                  {isHome ? "vs" : "@"} {opponent.shortName}
                  {isFinal || isLive ? (
                    <span className="ml-1.5 font-semibold tabular-nums text-muted">
                      {teamScore}-{oppScore}
                    </span>
                  ) : null}
                </span>
                {playoff ? (
                  <Badge tone="archive" size="sm">
                    Playoffs
                  </Badge>
                ) : null}
              </span>
              <span className="block truncate text-2xs text-muted">
                {dateStr ? `${dateStr} • ` : ""}
                {isLive ? "Live now" : isFinal ? "Final" : formatStartTime(game.startTime)}
              </span>
            </span>

            <span className="ml-auto flex shrink-0 flex-col items-end gap-0.5">
              <span className="text-sm font-bold tabular-nums text-foreground">
                {stat.pts} <span className="text-3xs font-medium text-muted">PTS</span>
              </span>
              {!isVolleyball && (
                <span className="text-3xs tabular-nums text-muted">
                  {stat.reb} REB &middot; {stat.ast} AST &middot; {stat.stl ?? 0} STL &middot; {stat.blk ?? 0} BLK
                </span>
              )}
            </span>
          </button>
        );
      })}
    </div>
  );
}
