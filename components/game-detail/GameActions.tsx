import { gameActions } from "@/lib/watch-links";
import type { Game, GameStatus, Season } from "@/types/sports";
import { ExternalLink, PlayCircle, Ticket, Tv } from "lucide-react";

const ICONS = { tickets: Ticket, watch: Tv, replay: PlayCircle } as const;
const VERBS = { tickets: "Tickets", watch: "Watch on", replay: "Replay on" } as const;

/** Official links follow the same status rules as the game card. */
export function GameActions({ game, status, season }: { game: Game; status: GameStatus; season?: Season }) {
  const actions = gameActions({ links: game.links, status, startTime: game.startTime }, season);
  if (!actions.length) return null;
  return <div className="flex flex-wrap gap-2">
    {actions.map(action => {
      const Icon = ICONS[action.kind];
      return <a key={action.kind} href={action.url} target="_blank" rel="nofollow noopener noreferrer"
        className="inline-flex min-h-8 items-center gap-1.5 rounded-control px-2 text-xs font-semibold text-foreground transition-colors hover:bg-surface-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary">
        <Icon size={14} aria-hidden="true" className="text-primary" />
        {status === "LIVE" ? "Livestream on" : VERBS[action.kind]}{action.label ? ` ${action.label}` : ""}
        {action.detail && <span className="font-normal text-muted">· {action.detail}</span>}
        <ExternalLink size={11} aria-hidden="true" className="text-muted" />
        <span className="sr-only">(opens in a new tab)</span>
      </a>;
    })}
  </div>;
}
