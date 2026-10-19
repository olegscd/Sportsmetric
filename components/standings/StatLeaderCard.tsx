import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
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
    <Card className="w-full p-3.5">
      <p className="mb-2 text-2xs font-bold uppercase tracking-wider text-muted">
        {title}
      </p>
      <div className="flex flex-col gap-1">
        {entries.length === 0 ? (
          <p className="py-4 text-center text-xs font-medium text-muted">No data yet.</p>
        ) : (
          entries.map((entry, index) => (
            <Link
              key={entry.player.id}
              href={`/players/${entry.player.id}`}
              className="-mx-1 flex min-h-11 items-center gap-2 rounded-control px-1 transition-colors hover:bg-surface-2"
            >
              <Badge
                tone={index === 0 ? "archive" : "neutral"}
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
              <span className="shrink-0 text-sm font-black tabular-nums text-foreground">
                {formatValue(entry.value)}
              </span>
            </Link>
          ))
        )}
      </div>
    </Card>
  );
}
