"use client";

import { TeamBadge } from "@/components/ui/TeamBadge";
import { useGameModal } from "@/lib/game-modal-context";
import { isPlayoffGame } from "@/lib/derivations";
import { formatGameDate, formatRecord, formatStartTime } from "@/lib/utils";
import type { Game, Team } from "@/types/sports";
import Link from "next/link";
import { LeagueBadge } from "./LeagueBadge";

function StatusPill({ game }: { game: Game }) {
  const dateStr = formatGameDate(game.startTime, true);

  if (game.status === "LIVE") {
    const label =
      game.timeRemaining !== null
        ? `Q${game.quarterOrSet} \u2022 ${game.timeRemaining}`
        : `Set ${game.quarterOrSet}`;
    return (
      <div className="flex items-center gap-1.5 shrink-0">
        {dateStr && <span className="text-[11px] font-medium text-muted">{dateStr} &middot;</span>}
        <span className="inline-flex items-center gap-1.5 rounded-full bg-live/15 px-2 py-0.5 text-[11px] font-bold text-live">
          <span className="h-1.5 w-1.5 animate-live-pulse rounded-full bg-live" />
          LIVE {label}
        </span>
      </div>
    );
  }

  if (game.status === "FINAL") {
    return (
      <div className="flex items-center gap-1.5 shrink-0">
        {dateStr && <span className="text-[11px] font-medium text-muted">{dateStr} &middot;</span>}
        <span className="rounded-full bg-elevated px-2 py-0.5 text-[11px] font-semibold text-muted">
          FINAL
        </span>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-1.5 shrink-0">
      {dateStr && <span className="text-[11px] font-medium text-muted">{dateStr} &middot;</span>}
      <span className="rounded-full bg-elevated px-2 py-0.5 text-[11px] font-semibold text-muted">
        {formatStartTime(game.startTime)}
      </span>
    </div>
  );
}

function TeamRow({
  team,
  score,
  showScore,
}: {
  team: Team;
  score: number;
  showScore: boolean;
}) {
  return (
    <div className="flex items-center justify-between">
      <Link
        href={`/teams/${team.id}`}
        onClick={(event) => event.stopPropagation()}
        onKeyDown={(event) => event.stopPropagation()}
        className="flex items-center gap-2.5"
      >
        <TeamBadge team={team} size="sm" />
        <div className="flex flex-col">
          <span className="text-sm font-semibold text-foreground">
            {team.shortName}
          </span>
          <span className="text-[11px] text-muted">
            {formatRecord(team.record)}
          </span>
        </div>
      </Link>
      {showScore ? (
        <span className="text-lg font-bold tabular-nums text-foreground">
          {score}
        </span>
      ) : null}
    </div>
  );
}

export function GameCard({ game }: { game: Game }) {
  const { openGame } = useGameModal();
  const showScore = game.status !== "UPCOMING";

  // A native <button> may only contain phrasing content, but this card's
  // layout needs <div>/<p> block children -- so we use a div with the
  // "button" role (plus keyboard support) instead, which avoids the
  // invalid-nesting hydration mismatch a real <button> would cause here.
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => openGame(game.id)}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          openGame(game.id);
        }
      }}
      className="w-full cursor-pointer rounded-2xl border border-border bg-surface p-4 text-left active:scale-[0.99]"
    >
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <LeagueBadge league={game.league} />
          {isPlayoffGame(game) && (
            <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-bold text-amber-500 uppercase tracking-wide">
              Playoffs
            </span>
          )}
        </div>
        <StatusPill game={game} />
      </div>
      <div className="flex flex-col gap-2.5">
        <TeamRow team={game.awayTeam} score={game.awayScore} showScore={showScore} />
        <TeamRow team={game.homeTeam} score={game.homeScore} showScore={showScore} />
      </div>
      {game.venue ? (
        <p className="mt-3 truncate text-[11px] text-muted">{game.venue}</p>
      ) : null}
    </div>
  );
}
