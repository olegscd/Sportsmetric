import type { League, PlayByPlayEvent, PlayByPlayEventType, Team } from "@/types/sports";
import {
  Circle,
  CircleCheck,
  CircleX,
  Clock,
  Flag,
  Hand,
  Repeat,
  RotateCcw,
  Shield,
  TriangleAlert,
  Users,
} from "lucide-react";
import type { ComponentType } from "react";

const EVENT_ICONS: Record<
  PlayByPlayEventType,
  ComponentType<{ size?: number; className?: string }>
> = {
  FG_MADE: CircleCheck,
  FG_MISSED: CircleX,
  "3PT_MADE": CircleCheck,
  FT_MADE: CircleCheck,
  REBOUND: RotateCcw,
  ASSIST: Users,
  STEAL: Hand,
  BLOCK: Shield,
  TURNOVER: CircleX,
  FOUL: TriangleAlert,
  SUB: Repeat,
  TIMEOUT: Clock,
  PERIOD_END: Flag,
  KILL: CircleCheck,
  SERVE_ACE: CircleCheck,
  BLOCK_POINT: Shield,
};

function periodLabel(period: number, league: League): string {
  return league === "PVL" ? `Set ${period}` : `Q${period}`;
}

interface PlayByPlayFeedProps {
  events: PlayByPlayEvent[];
  homeTeam: Team;
  awayTeam: Team;
  league: League;
}

export function PlayByPlayFeed({ events, homeTeam, awayTeam, league }: PlayByPlayFeedProps) {
  if (events.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-muted">
        Play-by-play not available yet.
      </p>
    );
  }

  // Precompute period-header boundaries in a single pure pass, rather than
  // mutating a variable from inside the render-producing map below.
  const rows = [...events].reverse().reduce<
    { event: PlayByPlayEvent; showPeriodHeader: boolean }[]
  >((acc, event) => {
    const previous = acc[acc.length - 1];
    acc.push({ event, showPeriodHeader: previous?.event.period !== event.period });
    return acc;
  }, []);

  return (
    <div className="flex flex-col">
      {rows.map(({ event, showPeriodHeader }) => {
        const Icon = EVENT_ICONS[event.type] ?? Circle;
        const accentColor =
          event.scoringTeamId === homeTeam.id
            ? homeTeam.accentColor
            : event.scoringTeamId === awayTeam.id
              ? awayTeam.accentColor
              : undefined;

        return (
          <div key={event.id}>
            {showPeriodHeader ? (
              <p className="sticky top-0 -mx-4 bg-elevated px-4 py-1.5 text-[11px] font-bold uppercase tracking-wide text-muted">
                {periodLabel(event.period, league)}
              </p>
            ) : null}
            <div
              className="flex items-start gap-3 border-l-2 py-2.5 pl-3"
              style={{ borderColor: accentColor ?? "var(--color-border)" }}
            >
              <Icon size={16} className="mt-0.5 shrink-0 text-muted" />
              <div className="flex-1">
                <p className="text-sm text-foreground">{event.description}</p>
                <p className="mt-0.5 text-[11px] text-muted">{event.timestamp}</p>
              </div>
              <p className="shrink-0 text-xs font-semibold tabular-nums text-muted">
                {event.currentScore.away}-{event.currentScore.home}
              </p>
            </div>
          </div>
        );
      })}
    </div>
  );
}
