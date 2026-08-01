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
    <div className="overflow-x-auto rounded-2xl border border-border bg-surface">
      <table className="w-full text-left text-sm">
        <thead>
          <tr className="border-b border-border text-[11px] text-muted">
            <th className="py-2 pl-3 font-medium">#</th>
            <th className="py-2 font-medium">Team</th>
            <th className="py-2 pr-3 text-right font-medium">W</th>
            <th className="py-2 pr-3 text-right font-medium">L</th>
            <th className="py-2 pr-3 text-right font-medium">PCT</th>
            {showDiffAndStreak && (
              <>
                <th className="py-2 pr-3 text-right font-medium">DIFF</th>
                <th className="py-2 pr-3 text-right font-medium">STRK</th>
              </>
            )}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr
              key={row.team.id}
              className={cn(
                "border-t border-border/50 transition-colors hover:bg-surface/80",
                row.team.id === highlightTeamId && "bg-primary/10"
              )}
            >
              <td className="py-2.5 pl-3 text-muted">{row.index}</td>
              <td className="py-2.5">
                <Link href={`/teams/${row.team.id}`} className="flex items-center gap-2">
                  <TeamBadge team={row.team} size="sm" />
                  <span className="font-semibold text-foreground">{row.team.shortName}</span>
                </Link>
              </td>
              <td className="py-2.5 pr-3 text-right tabular-nums text-foreground">
                {row.wins}
              </td>
              <td className="py-2.5 pr-3 text-right tabular-nums text-foreground">
                {row.losses}
              </td>
              <td className="py-2.5 pr-3 text-right tabular-nums text-muted">
                {row.pct}
              </td>
              {showDiffAndStreak && (
                <>
                  <td
                    className={cn(
                      "py-2.5 pr-3 text-right tabular-nums font-mono text-xs",
                      row.diff && row.diff.startsWith("+")
                        ? "font-semibold text-emerald-500"
                        : "text-muted"
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
