import { Badge } from "@/components/ui/Badge";
import { TableShell, Td, Th } from "@/components/ui/Table";
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

function StreakBadge({ streak }: { streak?: string }) {
  if (!streak || streak === "-") {
    return <span className="text-xs text-muted">—</span>;
  }
  const isWin = streak.startsWith("W");
  return (
    <Badge tone={isWin ? "success" : "negative"} size="sm">
      {streak}
    </Badge>
  );
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
    <TableShell>
      <table className="w-full min-w-[34rem] text-left text-sm">
        <thead>
          <tr>
            <Th sticky className="w-12 pl-3">#</Th>
            <Th className="sticky left-12 z-20 min-w-36 px-2">Team</Th>
            <Th numeric className="w-12 pl-2">W</Th>
            <Th numeric className="w-12">L</Th>
            <Th numeric className="w-16">PCT</Th>
            {showDiffAndStreak && (
              <>
                <Th numeric className="w-20">DIFF</Th>
                <Th numeric className="w-20 pr-4">STRK</Th>
              </>
            )}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const highlighted = row.team.id === highlightTeamId;
            const diffPositive = typeof row.diff === "string" && row.diff.startsWith("+");
            const diffNegative = typeof row.diff === "string" && row.diff.startsWith("-");
            return (
              <tr
                key={row.team.id}
                className={cn(
                  "transition-colors hover:bg-elevated/50",
                  highlighted && "bg-primary/10"
                )}
              >
                <Td sticky className="w-12 pl-3 text-xs font-semibold text-muted">
                  {row.index}
                </Td>
                <Td className="sticky left-12 z-10 bg-surface px-2">
                  <span
                    aria-hidden="true"
                    className={cn(
                      "pointer-events-none absolute inset-0 z-0",
                      highlighted && "bg-primary/10"
                    )}
                  />
                  <Link
                    href={`/teams/${row.team.id}`}
                    className="relative flex min-h-9 items-center gap-2 rounded-control hover:text-primary"
                  >
                    <TeamBadge team={row.team} size="sm" />
                    <span className="truncate font-bold text-foreground">
                      {row.team.shortName}
                    </span>
                  </Link>
                </Td>
                <Td numeric className="w-12 pl-2 font-bold">
                  {row.wins}
                </Td>
                <Td numeric className="w-12 font-bold">
                  {row.losses}
                </Td>
                <Td numeric className="w-16 font-mono text-xs font-medium text-muted">
                  {row.pct}
                </Td>
                {showDiffAndStreak && (
                  <>
                    <Td
                      numeric
                      className={cn(
                        "w-20 font-mono text-xs font-semibold",
                        diffPositive
                          ? "text-positive"
                          : diffNegative
                            ? "text-negative"
                            : "text-muted"
                      )}
                    >
                      {row.diff}
                    </Td>
                    <Td numeric className="w-20 pr-4">
                      <StreakBadge streak={row.streak} />
                    </Td>
                  </>
                )}
              </tr>
            );
          })}
        </tbody>
      </table>
    </TableShell>
  );
}
