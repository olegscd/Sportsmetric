import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { TeamBadge } from "@/components/ui/TeamBadge";
import type { StatLeaderEntry } from "@/lib/derivations";
import { cn } from "@/lib/utils";
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
      <div className="flex flex-col gap-1.5">
        {entries.length === 0 ? (
          <p className="py-4 text-center text-xs font-medium text-muted">No data yet.</p>
        ) : (
          entries.map((entry, index) => {
            const isLeader = index === 0;
            return (
              <Link
                key={entry.player.id}
                href={`/players/${entry.player.id}`}
                className={cn(
                  "flex min-h-11 items-center gap-2.5 rounded-control px-2 py-1.5 transition-colors",
                  isLeader
                    ? "border border-archive/25 bg-archive/[0.06] hover:bg-archive/[0.11]"
                    : "hover:bg-elevated/60"
                )}
              >
                <Badge
                  tone={isLeader ? "archive" : "neutral"}
                  size="sm"
                  className="w-6 justify-center tabular-nums"
                >
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
                <span
                  className={cn(
                    "font-display shrink-0 text-lg font-extrabold tabular-nums leading-none",
                    isLeader ? "text-archive" : "text-foreground"
                  )}
                >
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
