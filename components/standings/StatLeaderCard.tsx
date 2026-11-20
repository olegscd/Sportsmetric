import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { PlayerAvatar } from "@/components/ui/PlayerAvatar";
import { TeamBadge } from "@/components/ui/TeamBadge";
import type { StatLeaderEntry } from "@/lib/derivations";
import Link from "next/link";

interface StatLeaderCardProps {
  title: string;
  entries: StatLeaderEntry[];
  formatValue: (value: number) => string;
}

export function StatLeaderCard({ title, entries, formatValue }: StatLeaderCardProps) {
  return (
    <Card className="w-full p-4">
      <div className="mb-2.5 flex items-center justify-between gap-2 border-b border-border/60 pb-2">
        <p className="text-2xs font-bold uppercase tracking-wider text-muted">
          {title}
        </p>
      </div>
      <div className="flex flex-col gap-2">
        {entries.length === 0 ? (
          <p className="py-4 text-center text-xs font-medium text-muted">No data yet.</p>
        ) : (
          entries.map((entry, index) => {
            const isLeader = index === 0;
            if (isLeader) {
              return (
                <Link
                  key={entry.player.id}
                  href={`/players/${entry.player.id}`}
                  className="group relative flex items-center gap-3 overflow-hidden rounded-card border border-archive/35 p-2.5 transition-all hover:border-archive/60"
                  style={{
                    backgroundImage: `linear-gradient(125deg, ${entry.team.accentColor}2e 0%, rgba(10,16,28,0.92) 70%)`,
                  }}
                >
                  <Badge tone="archive" size="sm" className="w-6 shrink-0 justify-center tabular-nums">
                    1
                  </Badge>
                  <PlayerAvatar
                    player={entry.player}
                    accentColor={entry.team.accentColor}
                    size="md"
                  />
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="truncate text-xs font-extrabold text-foreground transition-colors group-hover:text-archive">
                      {entry.player.name}
                    </span>
                    <span className="mt-0.5 flex items-center gap-1.5 text-3xs font-semibold uppercase tracking-wide text-muted">
                      <TeamBadge team={entry.team} size="sm" className="h-4 w-4 text-[7px]" />
                      <span className="truncate">{entry.team.shortName}</span>
                    </span>
                  </span>
                  <span className="font-display shrink-0 text-2xl font-black tabular-nums leading-none text-archive">
                    {formatValue(entry.value)}
                  </span>
                </Link>
              );
            }
            return (
              <Link
                key={entry.player.id}
                href={`/players/${entry.player.id}`}
                className="flex min-h-10 items-center gap-2.5 rounded-control px-2 py-1 transition-colors hover:bg-elevated/60"
              >
                <Badge tone="neutral" size="sm" className="w-6 justify-center tabular-nums">
                  {index + 1}
                </Badge>
                <TeamBadge team={entry.team} size="sm" />
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate text-xs font-bold text-foreground">
                    {entry.player.name}
                  </span>
                  <span className="truncate text-3xs font-semibold uppercase tracking-wide text-muted">
                    {entry.team.shortName}
                  </span>
                </span>
                <span className="font-display shrink-0 text-lg font-extrabold tabular-nums leading-none text-foreground">
                  {formatValue(entry.value)}
                </span>
              </Link>
            );
          })
        )}
      </div>
    </Card>
  );
}
