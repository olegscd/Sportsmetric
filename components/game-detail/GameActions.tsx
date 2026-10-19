import { gameActions } from "@/lib/watch-links";
import type { Game, GameStatus, Season } from "@/types/sports";
import { ExternalLink, PlayCircle, Ticket, Tv } from "lucide-react";

const ICONS = { tickets: Ticket, watch: Tv, replay: PlayCircle } as const;
const VERBS = { tickets: "Tickets", watch: "Watch on", replay: "Replay on" } as const;

/**
 * Official tickets / where-to-watch / replay links for one game. Minimal
 * styling on purpose: the game card redesign will decide final placement.
 */
export function GameActions({ game, status, season }: { game: Game; status: GameStatus; season?: Season }) {
  const actions = gameActions({ links: game.links, status }, season);
  if (!actions.length) return null;
  return <div className="flex flex-wrap gap-2">
    {actions.map(action => {
      const Icon = ICONS[action.kind];
      return <a key={action.kind} href={action.url} target="_blank" rel="nofollow noopener noreferrer"
        className="inline-flex min-h-10 items-center gap-1.5 rounded-control border border-border bg-surface px-3 text-xs font-semibold text-foreground transition-colors hover:border-primary/40">
        <Icon size={14} aria-hidden="true" className="text-primary" />
        {VERBS[action.kind]}{action.label ? ` ${action.label}` : ""}
        {action.detail && <span className="font-normal text-muted">· {action.detail}</span>}
        <ExternalLink size={11} aria-hidden="true" className="text-muted" />
        <span className="sr-only">(opens in a new tab)</span>
      </a>;
    })}
  </div>;
}
