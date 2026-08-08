import { TeamBadge } from "@/components/ui/TeamBadge";
import type { DerivedTeamStandings } from "@/lib/derivations";
import { cn } from "@/lib/utils";
import type { Team } from "@/types/sports";
import Link from "next/link";

interface StandingsTableProps {
  standings?: DerivedTeamStandings[];
  teams?: Team[];
  highlightTeamId?: string;
  isOldSeason?: boolean;
}

export function StandingsTable({
  standings,
  teams,
  highlightTeamId,
  isOldSeason = false,
}: StandingsTableProps) {
  const rows = standings
    ? standings.map((s, index) => ({
        index: index + 1,
        team: s.team,
        wins: s.wins,
        losses: s.losses,
        pct: s.winPct.toFixed(3).replace(/^0/, ""),
        pf: s.pointsFor,
        pa: s.pointsAgainst,
        diff: s.pointDiff > 0 ? `+${s.pointDiff}` : `${s.pointDiff}`,
        streak: s.streak,
      }))
    : (teams ?? []).map((team, index) => {
        const total = team.record.wins + team.record.losses;
        const pctVal = total > 0 ? team.record.wins / total : 0;
        return {
          index: index + 1,
          team,
          wins: team.record.wins,
          losses: team.record.losses,
          pct: pctVal.toFixed(3).replace(/^0/, ""),
          pf: undefined,
          pa: undefined,
          diff: undefined,
          streak: undefined,
        };
      });

  const showDiffAndStreak = standings && !isOldSeason;

  return (
    <div className="overflow-x-auto rounded-2xl border border-stone-300/60 bg-[#F4EBD9] shadow-sm">
      <table className="w-full text-left text-sm">
        <thead>
          <tr className="border-b border-stone-300/80 text-[11px] font-bold text-zinc-700">
            <th className="py-2.5 pl-3 font-bold">#</th>
            <th className="py-2.5 font-bold">Team</th>
            <th className="py-2.5 pr-3 text-right font-bold">W</th>
            <th className="py-2.5 pr-3 text-right font-bold">L</th>
            <th className="py-2.5 pr-3 text-right font-bold">PCT</th>
            {showDiffAndStreak && (
              <>
                <th className="py-2.5 pr-3 text-right font-bold">DIFF</th>
                <th className="py-2.5 pr-3 text-right font-bold">STRK</th>
              </>
            )}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr
              key={row.team.id}
              className={cn(
                "border-t border-stone-300/60 transition-colors hover:bg-[#EAE0CD]",
                row.team.id === highlightTeamId && "bg-amber-100/60"
              )}
            >
              <td className="py-2.5 pl-3 font-semibold text-zinc-600">{row.index}</td>
              <td className="py-2.5">
                <Link href={`/teams/${row.team.id}`} className="flex items-center gap-2">
                  <TeamBadge team={row.team} size="sm" />
                  <span className="font-bold text-zinc-900">{row.team.shortName}</span>
                </Link>
              </td>
              <td className="py-2.5 pr-3 text-right tabular-nums font-bold text-zinc-900">
                {row.wins}
              </td>
              <td className="py-2.5 pr-3 text-right tabular-nums font-bold text-zinc-900">
                {row.losses}
              </td>
              <td className="py-2.5 pr-3 text-right tabular-nums font-medium text-zinc-700">
                {row.pct}
              </td>
              {showDiffAndStreak && (
                <>
                  <td
                    className={cn(
                      "py-2.5 pr-3 text-right tabular-nums font-mono text-xs font-semibold",
                      row.diff && row.diff.startsWith("+")
                        ? "text-emerald-700"
                        : "text-zinc-600"
                    )}
                  >
                    {row.diff}
                  </td>
                  <td className="py-2.5 pr-3 text-right tabular-nums text-xs font-semibold text-foreground">
                    {row.streak}
                  </td>
                </>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
