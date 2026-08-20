"use client";

import { TeamBadge } from "@/components/ui/TeamBadge";
import { useGameModal } from "@/lib/game-modal-context";
import { getEffectiveGameStatus, isPlayoffGame } from "@/lib/derivations";
import { formatGameDate, formatRecord, formatStartTime } from "@/lib/utils";
import type { Game, Team } from "@/types/sports";
import Link from "next/link";
import { LeagueBadge } from "./LeagueBadge";

function StatusPill({ game }: { game: Game }) {
  const dateStr = formatGameDate(game.startTime, true);
  const effectiveStatus = getEffectiveGameStatus(game);

  if (effectiveStatus === "LIVE") {
    const isVolleyball = game.league === "PVL";
    const label = isVolleyball
      ? `Set ${game.quarterOrSet}`
      : game.timeRemaining
        ? `Q${game.quarterOrSet} \u2022 ${game.timeRemaining}`
        : `Q${game.quarterOrSet}`;

    return (
      <div className="flex items-center gap-1.5 shrink-0">
        {dateStr && <span className="text-[11px] font-semibold text-muted">{dateStr} &middot;</span>}
        <span className="inline-flex items-center gap-1.5 rounded-full bg-live/20 px-2 py-0.5 text-[11px] font-bold text-live">
          <span className="h-1.5 w-1.5 animate-live-pulse rounded-full bg-live" />
          LIVE {label}
        </span>
      </div>
    );
  }


  if (effectiveStatus === "FINAL") {
    return (
      <div className="flex items-center gap-1.5 shrink-0">
        {dateStr && <span className="text-[11px] font-semibold text-muted">{dateStr} &middot;</span>}
        <span className="rounded-full bg-border px-2 py-0.5 text-[11px] font-bold text-foreground">
          FINAL
        </span>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-1.5 shrink-0">
      {dateStr && <span className="text-[11px] font-semibold text-muted">{dateStr} &middot;</span>}
      <span className="rounded-full bg-border px-2 py-0.5 text-[11px] font-bold text-foreground">
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
          <span className="text-sm font-bold text-foreground">
            {team.shortName}
          </span>
          <span className="text-[11px] font-medium text-muted">
            {formatRecord(team.record)}
          </span>
        </div>
      </Link>
      {showScore ? (
        <span className="text-lg font-black tabular-nums text-foreground">
          {score}
        </span>
      ) : null}
    </div>
  );
}

export function GameCard({ game }: { game: Game }) {
  const { openGame } = useGameModal();
  const effectiveStatus = getEffectiveGameStatus(game);
  const showScore = effectiveStatus !== "UPCOMING";


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
      className="w-full cursor-pointer rounded-2xl border border-border bg-surface p-4 text-left shadow-sm hover:border-primary/50 active:scale-[0.99] transition-all"
    >
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <LeagueBadge league={game.league} />
          {isPlayoffGame(game) && (
            <span className="rounded-full bg-primary/20 px-2 py-0.5 text-[10px] font-extrabold text-primary uppercase tracking-wide">
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
        <p className="mt-3 truncate text-[11px] font-medium text-muted">{game.venue}</p>
      ) : null}
    </div>
  );
}
