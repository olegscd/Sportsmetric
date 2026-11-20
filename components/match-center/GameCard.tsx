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
        className="pointer-events-auto relative z-10 -mx-1.5 inline-flex min-h-11 min-w-0 max-w-[calc(100%-3.75rem)] items-center gap-2.5 rounded-control px-1.5 py-0.5 transition-colors hover:bg-white/[0.06]"
      >
        <span
          aria-hidden="true"
          className={cn(
            "shrink-0 rounded-full transition-all",
            won ? "h-6 w-[3px] opacity-100" : "h-5 w-0.5 opacity-70"
          )}
          style={{
            backgroundColor: team.accentColor,
            boxShadow: won ? `0 0 10px ${team.accentColor}88` : undefined,
          }}
        />
        <TeamBadge team={team} size="sm" />
        <span className="flex min-w-0 flex-col">
          <span
            className={cn(
              "flex items-center gap-1.5 truncate text-sm font-bold tracking-tight transition-colors",
              muted ? "text-muted/85" : "text-foreground"
            )}
          >
            <span className="truncate">{team.shortName}</span>
            {won ? (
              <span
                aria-hidden="true"
                className="h-1.5 w-1.5 shrink-0 rounded-full bg-positive shadow-[0_0_8px_rgba(52,211,153,0.9)]"
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
            "font-display shrink-0 text-2xl font-extrabold tabular-nums tracking-tight",
            won
              ? "text-white drop-shadow-[0_1px_10px_rgba(255,255,255,0.2)]"
              : muted
                ? "text-muted/55"
                : "text-foreground"
          )}
        >
          {score}
        </span>
      ) : null}
    </div>
  );
}

function FeaturedTeamSide({
  team,
  record,
  align,
}: {
  team: Team;
  record?: { wins: number; losses: number };
  align: "left" | "right";
}) {
  const displayRecord = record ?? team.record;
  const isRight = align === "right";
  return (
    <div className={cn("flex min-w-0 items-center", isRight && "md:justify-end")}>
      <Link
        href={`/teams/${team.id}`}
        className={cn(
          "pointer-events-auto relative z-10 -mx-1.5 inline-flex min-h-11 min-w-0 max-w-full items-center gap-3 rounded-control px-2 py-1 transition-colors hover:bg-white/[0.06]",
          isRight && "md:flex-row-reverse md:text-right"
        )}
      >
        <TeamBadge team={team} size="md" />
        <span className="flex min-w-0 flex-col">
          <span className="truncate font-display text-base font-extrabold tracking-tight text-white sm:text-lg">
            {team.name}
          </span>
          <span className="truncate text-xs font-semibold text-muted tabular-nums">
            {team.shortName} · {formatRecord(displayRecord)}
          </span>
        </span>
      </Link>
    </div>
  );
}

export const GameCard = memo(function GameCard({
  game,
  featured = false,
}: {
  game: Game;
  featured?: boolean;
}) {
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
  const isLive = effectiveStatus === "LIVE";

  return (
    <article
      className={cardClasses({
        className: cn(
          "translucent-card group relative w-full overflow-hidden border-white/[0.1] p-4 transition-all duration-150 ease-standard hover:-translate-y-0.5 hover:border-white/25 hover:shadow-[inset_0_1px_0_rgba(255,255,255,0.16),0_22px_40px_-20px_rgba(0,0,0,0.96)]",
          isLive &&
            "border-live/50 shadow-[inset_0_1px_0_rgba(251,113,133,0.28),0_20px_42px_-20px_rgba(244,63,94,0.22),0_18px_36px_-22px_rgba(0,0,0,0.95)]",
          featured && "p-5 sm:px-6"
        ),
      })}
    >
      {/* Ambient split floodlight aura without overriding card elevation gradient */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 opacity-75 transition-opacity duration-200 group-hover:opacity-100"
        style={{
          backgroundImage: `radial-gradient(circle at 8% 15%, ${game.awayTeam.accentColor}${awayWon || isLive ? "2a" : "18"}, transparent 46%), radial-gradient(circle at 92% 85%, ${game.homeTeam.accentColor}${homeWon || isLive ? "2a" : "18"}, transparent 46%)`,
        }}
      />

      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 h-[3px] opacity-95 transition-opacity group-hover:opacity-100"
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
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/[0.08] pb-2.5">
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

        {featured ? (
          <div className="grid grid-cols-1 gap-4 py-4 md:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] md:items-center md:gap-6">
            <FeaturedTeamSide team={game.awayTeam} record={awayRecord} align="left" />

            <div className="flex items-center justify-center gap-4 border-y border-white/[0.06] py-2 md:border-y-0 md:py-0">
              {showScore ? (
                <>
                  <span
                    className={cn(
                      "font-display text-3xl font-extrabold tabular-nums tracking-tight sm:text-4xl",
                      awayLost ? "text-muted/55" : "text-white drop-shadow-[0_2px_12px_rgba(255,255,255,0.2)]"
                    )}
                  >
                    {game.awayScore}
                  </span>
                  <span className="text-xs font-bold uppercase tracking-[0.18em] text-muted/70">
                    vs
                  </span>
                  <span
                    className={cn(
                      "font-display text-3xl font-extrabold tabular-nums tracking-tight sm:text-4xl",
                      homeLost ? "text-muted/55" : "text-white drop-shadow-[0_2px_12px_rgba(255,255,255,0.2)]"
                    )}
                  >
                    {game.homeScore}
                  </span>
                </>
              ) : (
                <span className="text-xs font-bold uppercase tracking-[0.2em] text-muted">
                  vs
                </span>
              )}
            </div>

            <FeaturedTeamSide team={game.homeTeam} record={homeRecord} align="right" />
          </div>
        ) : (
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
        )}

        {topPerformer || game.venue ? (
          <div className="flex items-center justify-between gap-2 border-t border-white/[0.08] pt-2 text-2xs text-muted">
            {topPerformer ? (
              <span className="flex min-w-0 items-center gap-1">
                <Sparkles size={11} aria-hidden="true" className="shrink-0 text-archive" />
                <span className="truncate font-semibold text-foreground/95">
                  {topPerformer.playerName}
                </span>
                <span className="font-mono shrink-0 font-bold text-archive">
                  · {topPerformer.pts} PTS
                </span>
              </span>
            ) : null}
            {game.venue ? (
              <span className="flex min-w-0 items-center gap-1">
                <MapPin size={11} aria-hidden="true" className="shrink-0 text-muted/80" />
                <span className="truncate font-medium">{game.venue}</span>
              </span>
            ) : null}
          </div>
        ) : null}

        <CardActions actions={actions} status={effectiveStatus} />
      </div>
    </article>
  );
});
