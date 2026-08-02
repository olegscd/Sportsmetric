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
    <div className="w-full rounded-2xl border border-border bg-surface p-3">
      <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted">
        {title}
      </p>
      <div className="flex flex-col gap-2.5">
        {entries.length === 0 ? (
          <p className="py-4 text-center text-xs text-muted">No data yet.</p>
        ) : (
          entries.map((entry, index) => (
            <Link
              key={entry.player.id}
              href={`/players/${entry.player.id}`}
              className="flex items-center gap-2 rounded-xl p-1 -mx-1 active:scale-[0.99]"
            >
              <span className="w-3 text-xs font-bold text-muted">{index + 1}</span>
              <TeamBadge team={entry.team} size="sm" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-semibold text-foreground">
                  {entry.player.name}
                </p>
                <p className="truncate text-[10px] text-muted">{entry.team.shortName}</p>
              </div>
              <span className="shrink-0 text-sm font-bold tabular-nums text-primary">
                {formatValue(entry.value)}
              </span>
            </Link>
          ))
        )}
      </div>
    </div>
  );
}
