"use client";

import { Badge } from "@/components/ui/Badge";
import { cardClasses } from "@/components/ui/Card";
import { TeamBadge } from "@/components/ui/TeamBadge";
import { useSportsData } from "@/context/SportsDataContext";
import { useGameModal } from "@/lib/game-modal-context";
import { getEffectiveGameStatus, isPlayoffGame } from "@/lib/derivations";
import { cn, formatGameDate, formatRecord, formatStartTime } from "@/lib/utils";
import type { Game, Team } from "@/types/sports";
import { gameActions, type GameAction } from "@/lib/watch-links";
import { ChevronRight, PlayCircle, Ticket, Tv } from "lucide-react";
import Link from "next/link";
import { memo, useMemo } from "react";
import { LeagueBadge } from "./LeagueBadge";

function StatusPill({ game }: { game: Game }) {
  const dateStr = formatGameDate(game.startTime, true);
  const effectiveStatus = getEffectiveGameStatus(game);

  if (effectiveStatus === "LIVE") {
    const isVolleyball = game.league === "PVL";
    const label = isVolleyball
      ? `Set ${game.quarterOrSet}`
      : game.timeRemaining
        ? `Q${game.quarterOrSet} • ${game.timeRemaining}`
        : `Q${game.quarterOrSet}`;

    return (
      <span className="flex shrink-0 items-center gap-1.5">
        {dateStr ? (
          <span className="text-2xs font-medium text-muted">{dateStr}</span>
        ) : null}
        <Badge tone="live" size="sm" dot>
          LIVE {label}
        </Badge>
      </span>
    );
  }

  if (effectiveStatus === "FINAL") {
    return (
      <span className="flex shrink-0 items-center gap-1.5">
        {dateStr ? (
          <span className="text-2xs font-medium text-muted">{dateStr}</span>
        ) : null}
        <Badge tone="neutral" size="sm" className="border-border-strong text-foreground">
          Final
        </Badge>
      </span>
    );
  }

  return (
    <span className="flex shrink-0 items-center gap-1.5">
      {dateStr ? (
        <span className="text-2xs font-medium text-muted">{dateStr}</span>
      ) : null}
      <Badge tone="outline" size="sm" className="text-foreground">
        {formatStartTime(game.startTime)}
      </Badge>
    </span>
  );
}

const ACTION_ICONS = { tickets: Ticket, watch: Tv, replay: PlayCircle } as const;
const ACTION_TEXT = { tickets: "Tickets", watch: "Watch", replay: "Replay" } as const;

/** Slim official links along the bottom of the card. */
function CardActions({ actions }: { actions: GameAction[] }) {
  if (!actions.length) return null;
  return (
    <div className={cn("mt-2.5 grid gap-2 border-t border-border/60 pt-2.5", actions.length > 1 ? "grid-cols-2" : "grid-cols-1")}>
      {actions.map((action) => {
        const Icon = ACTION_ICONS[action.kind];
        return (
          <a
            key={action.kind}
            href={action.url}
            target="_blank"
            rel="nofollow noopener noreferrer"
            title={`${ACTION_TEXT[action.kind]}${action.label ? ` on ${action.label}` : ""}${action.detail ? ` (${action.detail})` : ""}`}
            className={cn(
              "pointer-events-auto relative z-10 flex min-h-9 min-w-0 items-center justify-center gap-1.5 rounded-control border px-2.5 text-xs font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary",
              action.kind === "tickets"
                ? "border-primary/40 bg-primary/10 text-foreground hover:bg-primary/20"
                : "border-border bg-surface-2 text-foreground hover:border-border-strong"
            )}
          >
            <Icon size={14} aria-hidden="true" className="shrink-0 text-primary" />
            <span className="truncate">
              {ACTION_TEXT[action.kind]}
              {action.label ? <span className="font-normal text-muted"> · {action.label}</span> : null}
            </span>
            <span className="sr-only">(opens in a new tab)</span>
          </a>
        );
      })}
    </div>
  );
}

function TeamRow({
  team,
  record,
  score,
  showScore,
  muted,
}: {
  team: Team;
  record?: { wins: number; losses: number };
  score: number;
  showScore: boolean;
  muted?: boolean;
}) {
  const displayRecord = record ?? team.record;
  return (
    <div className="flex items-center justify-between gap-3">
      <Link
        href={`/teams/${team.id}`}
        className="pointer-events-auto relative z-10 -mx-1 flex min-h-11 min-w-0 items-center gap-2.5 rounded-control px-1 transition-colors hover:bg-elevated/50"
      >
        <TeamBadge team={team} size="sm" />
        <span className="flex min-w-0 flex-col">
          <span
            className={cn(
              "truncate text-sm font-bold transition-colors",
              muted ? "text-muted" : "text-foreground"
            )}
          >
            {team.shortName}
          </span>
          <span className="truncate text-2xs font-medium text-muted">
            {formatRecord(displayRecord)}
          </span>
        </span>
      </Link>
      {showScore ? (
        <span
          className={cn(
            "text-xl font-black tabular-nums",
            muted ? "text-muted" : "text-foreground"
          )}
        >
          {score}
        </span>
      ) : null}
    </div>
  );
}

export const GameCard = memo(function GameCard({ game }: { game: Game }) {
  const { openGame } = useGameModal();
  const { getStandings, seasons } = useSportsData();
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

  const season = seasons.find((s) => s.id === game.seasonId);
  const actions = gameActions({ links: game.links, status: effectiveStatus }, season);

  const hasWinner =
    effectiveStatus === "FINAL" && game.homeScore !== game.awayScore;
  const homeLost = hasWinner && game.homeScore < game.awayScore;
  const awayLost = hasWinner && game.awayScore < game.homeScore;

  return (
    <article
      className={cardClasses({
        className:
          "group relative w-full overflow-hidden p-4 transition-colors duration-150 ease-standard hover:border-border-strong",
      })}
    >
      {/* One full-card control keeps the whole surface keyboard-operable while
          team links sit above it and stay independently focusable. */}
      <button
        type="button"
        onClick={() => openGame(game.id)}
        aria-label={`View details for ${game.awayTeam.shortName} at ${game.homeTeam.shortName}`}
        className="absolute inset-0 z-0 rounded-card focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary"
      />

      <div className="pointer-events-none relative z-10 flex flex-col">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/60 pb-2.5">
          <div className="flex min-w-0 flex-wrap items-center gap-1.5">
            <LeagueBadge league={game.league} />
            {isPlayoffGame(game) ? (
              <Badge tone="archive" size="sm">
                {game.stage && game.stage !== "ELIMINATION" ? game.stage : "Playoffs"}
              </Badge>
            ) : null}
          </div>
          <div className="flex items-center gap-1">
            <StatusPill game={game} />
            <ChevronRight
              size={15}
              aria-hidden="true"
              className="shrink-0 text-muted transition-transform duration-150 ease-standard group-hover:translate-x-0.5"
            />
          </div>
        </div>

        <div className="flex flex-col gap-1 py-2">
          <TeamRow
            team={game.awayTeam}
            record={awayRecord}
            score={game.awayScore}
            showScore={showScore}
            muted={awayLost}
          />
          <TeamRow
            team={game.homeTeam}
            record={homeRecord}
            score={game.homeScore}
            showScore={showScore}
            muted={homeLost}
          />
        </div>

        {game.venue ? (
          <div className="border-t border-border/60 pt-2">
            <span className="block truncate text-2xs font-medium text-muted">
              {game.venue}
            </span>
          </div>
        ) : null}

        <CardActions actions={actions} />
      </div>
    </article>
  );
});
