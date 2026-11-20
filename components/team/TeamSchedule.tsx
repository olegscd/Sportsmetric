"use client";

import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { TeamBadge } from "@/components/ui/TeamBadge";
import { isPlayoffGame } from "@/lib/derivations";
import { useGameModal } from "@/lib/game-modal-context";
import { buildTeamSchedule, type TeamScheduleEntry } from "@/lib/team-schedule";
import { cn, formatGameDate, formatStartTime } from "@/lib/utils";
import type { Game, Team } from "@/types/sports";
import { CalendarDays } from "lucide-react";
import { useMemo } from "react";

function ScheduleRow({ entry, onOpen }: { entry: TeamScheduleEntry; onOpen: (id: string) => void }) {
  const { game, status, opponent, isHome, teamScore, opponentScore, result } = entry;
  const isLive = status === "LIVE";
  const isFinal = status === "FINAL";
  const marker = result ?? (isLive ? "LIVE" : "—");
  const dateStr = formatGameDate(game.startTime, true);
  const resultLabel = result === "W" ? "Win" : result === "L" ? "Loss" : result === "T" ? "Tie" : null;

  return (
    <li>
      <button
        type="button"
        onClick={() => onOpen(game.id)}
        aria-label={`${isHome ? "vs" : "at"} ${opponent.name}${resultLabel ? `, ${resultLabel} ${teamScore}-${opponentScore}` : isLive ? ", live" : ""}`}
        className="flex w-full items-center gap-3 rounded-control px-2 py-2.5 text-left transition-colors duration-150 ease-standard hover:bg-white/[0.04] focus-visible:bg-white/[0.04]"
      >
        <span
          aria-hidden="true"
          className={cn(
            "flex h-9 w-9 shrink-0 items-center justify-center rounded-full border text-3xs font-black",
            result === "W" && "border-positive/30 bg-positive/15 text-positive",
            result === "L" && "border-negative/30 bg-negative/15 text-negative",
            result === "T" && "border-border bg-elevated text-muted",
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
            </span>
            {isPlayoffGame(game) ? (
              <Badge tone="archive" size="sm">
                Playoffs
              </Badge>
            ) : null}
          </span>
          <span className="block truncate text-2xs text-muted">
            {isFinal ? dateStr : formatStartTime(game.startTime)}
            {game.venue ? ` • ${game.venue}` : ""}
          </span>
        </span>

        <span className="ml-auto flex shrink-0 items-center gap-2">
          {isLive ? (
            <Badge tone="live" size="sm" dot>
              Live
            </Badge>
          ) : null}
          {isFinal || isLive ? (
            <span className="text-sm font-bold tabular-nums text-foreground">
              {teamScore}-{opponentScore}
            </span>
          ) : (
            <Badge tone="outline" size="sm">
              Upcoming
            </Badge>
          )}
        </span>
      </button>
    </li>
  );
}

function ScheduleGroup({
  title,
  entries,
  onOpen,
}: {
  title: string;
  entries: TeamScheduleEntry[];
  onOpen: (id: string) => void;
}) {
  if (entries.length === 0) return null;
  return (
    <div className="flex flex-col gap-2">
      <h3 className="text-2xs font-bold uppercase tracking-wide text-muted">
        {title} <span className="tabular-nums">({entries.length})</span>
      </h3>
      <ul className="flex flex-col divide-y divide-white/[0.06]">
        {entries.map((entry) => (
          <ScheduleRow key={entry.game.id} entry={entry} onOpen={onOpen} />
        ))}
      </ul>
    </div>
  );
}

export function TeamSchedule({ team, games }: { team: Team; games: Game[] }) {
  const { openGame } = useGameModal();
  const { upcoming, completed } = useMemo(() => buildTeamSchedule(games, team), [games, team]);

  if (upcoming.length === 0 && completed.length === 0) {
    return (
      <EmptyState
        icon={<CalendarDays size={22} aria-hidden="true" />}
        title="No games yet"
        description="This team's schedule and results will appear here once games are posted."
      />
    );
  }

  return (
    <Card translucent className="flex flex-col gap-5 p-4">
      <ScheduleGroup title="Live & Upcoming" entries={upcoming} onOpen={openGame} />
      <ScheduleGroup title="Results" entries={completed} onOpen={openGame} />
    </Card>
  );
}
