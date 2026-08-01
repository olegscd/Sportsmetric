"use client";

import { TeamBadge } from "@/components/ui/TeamBadge";
import { useGameModal } from "@/lib/game-modal-context";
import { formatRecord, formatStartTime } from "@/lib/utils";
import type { Game, Team } from "@/types/sports";
import Link from "next/link";
import { LeagueBadge } from "./LeagueBadge";

function StatusPill({ game }: { game: Game }) {
  if (game.status === "LIVE") {
    const label =
      game.timeRemaining !== null
        ? `Q${game.quarterOrSet} \u2022 ${game.timeRemaining}`
        : `Set ${game.quarterOrSet}`;
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-live/15 px-2 py-0.5 text-[11px] font-bold text-live">
        <span className="h-1.5 w-1.5 animate-live-pulse rounded-full bg-live" />
        LIVE {label}
      </span>
    );
  }

  if (game.status === "FINAL") {
    return (
      <span className="rounded-full bg-elevated px-2 py-0.5 text-[11px] font-semibold text-muted">
        FINAL
      </span>
    );
  }

  return (
    <span className="rounded-full bg-elevated px-2 py-0.5 text-[11px] font-semibold text-muted">
      {formatStartTime(game.startTime)}
    </span>
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
        <LeagueBadge league={game.league} />
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
