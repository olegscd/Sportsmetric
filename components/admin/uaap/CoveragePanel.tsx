"use client";

import { cn } from "@/lib/utils";
import { TableShell } from "@/components/ui/Table";
import type { UAAPTable } from "@/lib/uaap-schema";

/**
 * Season x sport grid of what has been digitised. Clicking a cell jumps the
 * editor straight to that division so gaps can be worked through in order.
 */
export function CoveragePanel({
  tables,
  seasons,
  sports,
  activeSeason,
  activeSport,
  onSelect,
}: {
  tables: UAAPTable[];
  seasons: string[];
  sports: string[];
  activeSeason: string;
  activeSport: string;
  onSelect: (season: string, sport: string, division?: string) => void;
}) {
  const bySeasonSport = new Map<string, UAAPTable[]>();
  for (const table of tables) {
    const key = `${table.season}|${table.sport}`;
    const bucket = bySeasonSport.get(key);
    if (bucket) bucket.push(table);
    else bySeasonSport.set(key, [table]);
  }

  const totalPossible = seasons.length * sports.length;
  const filled = Array.from(bySeasonSport.keys()).filter((key) => {
    const [season, sport] = key.split("|");
    return seasons.includes(season) && sports.includes(sport);
  }).length;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted">
          <strong className="text-foreground">{filled}</strong> of {totalPossible} season and sport
          combinations have at least one division recorded.
        </p>
        <div className="flex items-center gap-3 text-3xs text-muted">
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-sm bg-archive/70" />
            Recorded
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-sm border border-border bg-surface-2" />
            Empty
          </span>
        </div>
      </div>

      <TableShell>
        <table className="border-collapse text-left text-xs">
          <thead>
            <tr>
              <th scope="col" className="sticky left-0 z-20 bg-surface-2 py-1.5 pl-3 pr-3 text-3xs font-bold uppercase tracking-wider text-muted">
                Season
              </th>
              {sports.map((sport) => (
                <th
                  scope="col"
                  key={sport}
                  className="px-1 pb-1.5 text-3xs font-semibold text-muted align-bottom"
                >
                  <span className="block w-10 truncate" title={sport}>
                    {sport.slice(0, 3)}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {seasons.map((season) => (
              <tr key={season}>
                <td className="sticky left-0 z-10 whitespace-nowrap bg-surface py-0.5 pl-3 pr-3 font-mono text-2xs text-foreground">
                  {season}
                </td>
                {sports.map((sport) => {
                  const divisions = bySeasonSport.get(`${season}|${sport}`) || [];
                  const count = divisions.length;
                  const isActive = season === activeSeason && sport === activeSport;
                  return (
                    <td key={sport} className="p-0.5">
                      <button
                        type="button"
                        onClick={() => onSelect(season, sport, divisions[0]?.division)}
                        title={
                          count > 0
                            ? `${season} ${sport}: ${divisions
                                .map((d) => d.division)
                                .join(", ")}`
                            : `${season} ${sport}: nothing recorded yet`
                        }
                        className={cn(
                          "h-10 w-10 cursor-pointer rounded-control text-2xs font-bold transition-colors",
                          count > 0
                            ? "bg-archive/70 text-bg hover:bg-archive"
                            : "border border-border bg-surface-2 text-muted hover:border-archive/50",
                          isActive && "ring-2 ring-archive ring-offset-1 ring-offset-surface"
                        )}
                      >
                        {count > 0 ? count : ""}
                      </button>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </TableShell>
    </div>
  );
}