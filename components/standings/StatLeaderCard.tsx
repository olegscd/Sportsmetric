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
    <div className="w-full rounded-2xl border border-stone-300/60 bg-[#F4EBD9] p-3 shadow-sm">
      <p className="mb-2 text-[11px] font-bold uppercase tracking-wide text-zinc-700">
        {title}
      </p>
      <div className="flex flex-col gap-2.5">
        {entries.length === 0 ? (
          <p className="py-4 text-center text-xs font-medium text-zinc-600">No data yet.</p>
        ) : (
          entries.map((entry, index) => (
            <Link
              key={entry.player.id}
              href={`/players/${entry.player.id}`}
              className="flex items-center gap-2 rounded-xl p-1 -mx-1 active:scale-[0.99] transition-transform hover:bg-[#EAE0CD]"
            >
              <span className="w-3 text-xs font-extrabold text-zinc-600">{index + 1}</span>
              <TeamBadge team={entry.team} size="sm" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-bold text-zinc-900">
                  {entry.player.name}
                </p>
                <p className="truncate text-[10px] font-semibold text-zinc-600">{entry.team.shortName}</p>
              </div>
              <span className="shrink-0 text-sm font-black tabular-nums text-zinc-950">
                {formatValue(entry.value)}
              </span>
            </Link>
          ))
        )}
      </div>
    </div>
  );
}
