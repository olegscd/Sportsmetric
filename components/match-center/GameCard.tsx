"use client";

import { TeamBadge } from "@/components/ui/TeamBadge";
import { useSportsData } from "@/context/SportsDataContext";
import { useGameModal } from "@/lib/game-modal-context";
import { getEffectiveGameStatus, isPlayoffGame } from "@/lib/derivations";
import { formatGameDate, formatRecord, formatStartTime } from "@/lib/utils";
import type { Game, Team } from "@/types/sports";
import Link from "next/link";
import { useMemo } from "react";
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
  record,
  score,
  showScore,
}: {
  team: Team;
  record?: { wins: number; losses: number };
  score: number;
  showScore: boolean;
}) {
  const displayRecord = record ?? team.record;
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
            {formatRecord(displayRecord)}
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
  const { getStandings } = useSportsData();
  const effectiveStatus = getEffectiveGameStatus(game);
  const showScore = effectiveStatus !== "UPCOMING";

  const standings = useMemo(() => {
    return getStandings(game.league, game.seasonId);
  }, [getStandings, game.league, game.seasonId]);

  const homeStandings = standings.find(
    (s) =>
      s.team.id === game.homeTeam.id ||
      (s.team.shortName && s.team.shortName.toUpperCase() === game.homeTeam.shortName?.toUpperCase())
  );
  const awayStandings = standings.find(
    (s) =>
      s.team.id === game.awayTeam.id ||
      (s.team.shortName && s.team.shortName.toUpperCase() === game.awayTeam.shortName?.toUpperCase())
  );

  const homeRecord = homeStandings ? { wins: homeStandings.wins, losses: homeStandings.losses } : game.homeTeam.record;
  const awayRecord = awayStandings ? { wins: awayStandings.wins, losses: awayStandings.losses } : game.awayTeam.record;

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
      <div className="flex items-center justify-between gap-2 border-b border-border/40 pb-2.5">
        <div className="flex items-center gap-1.5">
          <LeagueBadge league={game.league} />
          {isPlayoffGame(game) ? (
            <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-bold text-amber-500 uppercase tracking-wide">
              {game.stage && game.stage !== "ELIMINATION" ? game.stage : "Playoffs"}
            </span>
          ) : null}
        </div>
        <StatusPill game={game} />
      </div>

      <div className="flex flex-col gap-3 py-3">
        <TeamRow
          team={game.awayTeam}
          record={awayRecord}
          score={game.awayScore}
          showScore={showScore}
        />
        <TeamRow
          team={game.homeTeam}
          record={homeRecord}
          score={game.homeScore}
          showScore={showScore}
        />
      </div>

      {game.venue && (
        <div className="border-t border-border/30 pt-2">
          <span className="text-[11px] font-medium text-muted line-clamp-1">
            {game.venue}
          </span>
        </div>
      )}
    </div>
  );
}
