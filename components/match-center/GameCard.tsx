"use client";

import { Badge } from "@/components/ui/Badge";
import { cardClasses } from "@/components/ui/Card";
import { TeamBadge } from "@/components/ui/TeamBadge";
import { useSportsData } from "@/context/SportsDataContext";
import { useGameModal } from "@/lib/game-modal-context";
import { getTopGamePerformer } from "@/lib/game-overview";
import { getEffectiveGameStatus, isPlayoffGame } from "@/lib/derivations";
import { cn, formatGameDate, formatRecord, formatStartTime } from "@/lib/utils";
import type { Game, Team } from "@/types/sports";
import { gameActions, type GameAction } from "@/lib/watch-links";
import { ChevronRight, MapPin, PlayCircle, Sparkles, Ticket, Tv } from "lucide-react";
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
        <Badge tone="neutral" size="sm" className="border-border-strong/90 text-foreground">
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
      <Badge tone="outline" size="sm" className="border-border-strong/80 text-foreground">
        {formatStartTime(game.startTime)}
      </Badge>
    </span>
  );
}

const ACTION_ICONS = { tickets: Ticket, watch: Tv, replay: PlayCircle } as const;
const ACTION_TEXT = { tickets: "Tickets", watch: "Watch", replay: "Replay" } as const;

/** Slim official links along the bottom of the card. */
function CardActions({ actions, status }: { actions: GameAction[]; status: Game["status"] }) {
  if (!actions.length) return null;
  return (
    <div className={cn("mt-2 grid gap-2 border-t border-border/60 pt-2", actions.length > 1 ? "grid-cols-2" : "grid-cols-1")}>
      {actions.map((action) => {
        const Icon = ACTION_ICONS[action.kind];
        const label = status === "LIVE" ? "Livestream" : ACTION_TEXT[action.kind];
        return (
          <a
            key={action.kind}
            href={action.url}
            target="_blank"
            rel="nofollow noopener noreferrer"
            title={`${label}${action.label ? ` on ${action.label}` : ""}${action.detail ? ` (${action.detail})` : ""}`}
            className={cn(
              "pointer-events-auto relative z-10 flex min-w-0 items-center justify-center gap-1.5 rounded-control px-2.5 text-xs font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary",
              status !== "UPCOMING"
                ? "h-7 min-h-7 text-muted hover:bg-surface-2 hover:text-foreground"
                : action.kind === "tickets"
                  ? "min-h-9 border border-primary/45 bg-primary/12 text-foreground hover:bg-primary/20"
                  : "min-h-9 border border-border bg-surface-2/90 text-foreground hover:border-border-strong"
            )}
          >
            <Icon size={13} aria-hidden="true" className="shrink-0 text-primary" />
            <span className="truncate">
              {label}
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
  won,
  muted,
}: {
  team: Team;
  record?: { wins: number; losses: number };
  score: number;
  showScore: boolean;
  won?: boolean;
  muted?: boolean;
}) {
  const displayRecord = record ?? team.record;
  return (
    <div className="flex items-center justify-between gap-2.5">
      <Link
        href={`/teams/${team.id}`}
        className="pointer-events-auto relative z-10 -mx-1.5 flex min-h-11 min-w-0 flex-1 items-center gap-2.5 rounded-control px-1.5 py-0.5 transition-colors hover:bg-elevated/70"
      >
        <span
          aria-hidden="true"
          className="h-6 w-0.5 shrink-0 rounded-full opacity-80"
          style={{ backgroundColor: team.accentColor }}
        />
        <TeamBadge team={team} size="sm" />
        <span className="flex min-w-0 flex-1 flex-col">
          <span
            className={cn(
              "flex items-center gap-1.5 truncate text-sm font-bold tracking-tight transition-colors",
              muted ? "text-muted" : "text-foreground"
            )}
          >
            <span className="truncate">{team.shortName}</span>
            {won ? (
              <span
                aria-hidden="true"
                className="h-1.5 w-1.5 shrink-0 rounded-full bg-positive shadow-[0_0_6px_rgba(52,211,153,0.85)]"
              />
            ) : null}
          </span>
          <span className="truncate text-3xs font-medium text-muted">
            {team.name !== team.shortName ? `${team.name} · ` : ""}
            <span className="tabular-nums">{formatRecord(displayRecord)}</span>
          </span>
        </span>
      </Link>
      {showScore ? (
        <span
          className={cn(
            "led-score-box font-display flex h-9 min-w-12 shrink-0 items-center justify-center rounded-lg border px-2 text-2xl font-extrabold tabular-nums tracking-tight",
            won
              ? "border-positive/40 text-foreground"
              : muted
                ? "border-border/70 text-muted/75"
                : "border-border-strong/70 text-foreground"
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
  const { getStandings, seasons, players } = useSportsData();
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
  const actions = gameActions({ links: game.links, status: effectiveStatus, startTime: game.startTime }, season);

  const playerNamesById = useMemo(
    () => new Map(players.map((p) => [p.id, p.name])),
    [players]
  );
  const topPerformer = useMemo(
    () => (showScore ? getTopGamePerformer(game, playerNamesById) : null),
    [showScore, game, playerNamesById]
  );

  const hasWinner =
    effectiveStatus === "FINAL" && game.homeScore !== game.awayScore;
  const homeWon = hasWinner && game.homeScore > game.awayScore;
  const awayWon = hasWinner && game.awayScore > game.homeScore;
  const homeLost = hasWinner && game.homeScore < game.awayScore;
  const awayLost = hasWinner && game.awayScore < game.homeScore;

  return (
    <article
      className={cardClasses({
        className: cn(
          "group relative w-full overflow-hidden p-4 transition-all duration-150 ease-standard hover:-translate-y-0.5 hover:border-border-strong hover:bg-elevated/40 hover:shadow-raised",
          effectiveStatus === "LIVE" && "border-live/45 shadow-[inset_0_1px_0_rgba(251,113,133,0.22),0_18px_36px_-22px_rgba(0,0,0,0.92)]"
        ),
      })}
      style={{
        backgroundImage: `linear-gradient(135deg, ${game.awayTeam.accentColor}16 0%, transparent 45%, ${game.homeTeam.accentColor}16 100%)`,
      }}
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 h-[3px] opacity-90 transition-opacity group-hover:opacity-100"
        style={{
          background: `linear-gradient(90deg, ${game.awayTeam.accentColor}, ${game.homeTeam.accentColor})`,
        }}
      />

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
              className="shrink-0 text-muted transition-transform duration-150 ease-standard group-hover:translate-x-0.5 group-hover:text-foreground"
            />
          </div>
        </div>

        <div className="flex flex-col gap-1 py-2.5">
          <TeamRow
            team={game.awayTeam}
            record={awayRecord}
            score={game.awayScore}
            showScore={showScore}
            won={awayWon}
            muted={awayLost}
          />
          <TeamRow
            team={game.homeTeam}
            record={homeRecord}
            score={game.homeScore}
            showScore={showScore}
            won={homeWon}
            muted={homeLost}
          />
        </div>

        {topPerformer ? (
          <div className="mb-2 flex items-center justify-between gap-2 rounded-control border border-border/65 bg-surface-2/85 px-2.5 py-1.5 text-2xs">
            <span className="flex min-w-0 items-center gap-1.5 text-muted">
              <Sparkles size={11} aria-hidden="true" className="shrink-0 text-archive" />
              <span className="truncate font-semibold text-foreground/95">{topPerformer.playerName}</span>
            </span>
            <span className="font-mono shrink-0 font-bold text-archive">
              {topPerformer.pts} PTS
            </span>
          </div>
        ) : null}

        {game.venue ? (
          <div className="flex items-center gap-1.5 border-t border-border/60 pt-2 text-muted">
            <MapPin size={11} aria-hidden="true" className="shrink-0 text-muted/80" />
            <span className="block truncate text-2xs font-medium">
              {game.venue}
            </span>
          </div>
        ) : null}

        <CardActions actions={actions} status={effectiveStatus} />
      </div>
    </article>
  );
});
