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

function RankChip({ index, showPlayoffZone }: { index: number; showPlayoffZone: boolean }) {
  if (index === 1) {
    return (
      <span className="inline-flex h-6 w-6 items-center justify-center rounded-full border border-archive/45 bg-archive/15 text-xs font-extrabold tabular-nums text-archive">
        1
      </span>
    );
  }
  if (showPlayoffZone && index <= 4) {
    return (
      <span className="inline-flex h-6 w-6 items-center justify-center rounded-full border border-primary/35 bg-primary/10 text-xs font-bold tabular-nums text-foreground">
        {index}
      </span>
    );
  }
  return <span className="text-xs font-semibold tabular-nums text-muted">{index}</span>;
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
      winPctNum: s.winPct,
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
        winPctNum: pctVal,
        pf: undefined,
        pa: undefined,
        diff: undefined,
        streak: undefined,
      };
    });

  const showDiffAndStreak = standings && !isOldSeason;
  const showPlayoffCutoff = rows.length > 4 && !isOldSeason;

  return (
    <TableShell translucent>
      <table className="w-full min-w-[34rem] text-left text-sm">
        <thead>
          <tr>
            <Th sticky className="w-12 pl-3 text-center">#</Th>
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
            const isCutoffRow = showPlayoffCutoff && row.index === 4;
            return (
              <tr
                key={row.team.id}
                className={cn(
                  "transition-colors hover:bg-elevated/55",
                  highlighted && "bg-primary/10",
                  isCutoffRow && "[&>td]:border-b-2 [&>td]:border-dashed [&>td]:border-b-primary/40"
                )}
              >
                <Td sticky className="w-12 pl-3 text-center">
                  <RankChip index={row.index} showPlayoffZone={rows.length > 4} />
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
                    className="relative flex min-h-9 items-center gap-2.5 rounded-control hover:text-primary"
                  >
                    <TeamBadge team={row.team} size="sm" />
                    <span className="min-w-0 truncate">
                      <span className="font-bold text-foreground">{row.team.shortName}</span>
                      {row.team.name !== row.team.shortName ? (
                        <span className="ml-2 hidden text-xs font-medium text-muted sm:inline">
                          {row.team.name}
                        </span>
                      ) : null}
                    </span>
                  </Link>
                </Td>
                <Td numeric className="w-12 pl-2 font-bold">
                  {row.wins}
                </Td>
                <Td numeric className="w-12 font-bold text-muted">
                  {row.losses}
                </Td>
                <Td numeric className="w-24 font-mono text-xs font-semibold text-muted">
                  <div className="flex items-center justify-end gap-2">
                    <span className="hidden h-1.5 w-10 overflow-hidden rounded-full bg-white/[0.06] sm:inline-block">
                      <span
                        className="block h-full rounded-full"
                        style={{
                          width: `${Math.round(row.winPctNum * 100)}%`,
                          backgroundColor: row.team.accentColor,
                        }}
                      />
                    </span>
                    <span className="tabular-nums text-foreground/90">{row.pct}</span>
                  </div>
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
