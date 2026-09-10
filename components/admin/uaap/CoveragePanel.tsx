"use client";

import { cn } from "@/lib/utils";
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
        <div className="flex items-center gap-3 text-[10px] text-muted">
          <span className="inline-flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-sm bg-amber-500/70" />
            Recorded
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-sm bg-elevated border border-border" />
            Empty
          </span>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="text-left text-xs border-collapse">
          <thead>
            <tr>
              <th className="sticky left-0 bg-surface py-1.5 pr-3 text-[10px] font-bold uppercase tracking-wider text-muted">
                Season
              </th>
              {sports.map((sport) => (
                <th
                  key={sport}
                  className="px-1 pb-1.5 text-[10px] font-semibold text-muted align-bottom"
                >
                  <span className="block w-7 truncate" title={sport}>
                    {sport.slice(0, 3)}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {seasons.map((season) => (
              <tr key={season}>
                <td className="sticky left-0 bg-surface py-0.5 pr-3 font-mono text-[11px] text-foreground whitespace-nowrap">
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
                          "w-7 h-6 rounded-sm text-[10px] font-bold transition-all cursor-pointer",
                          count > 0
                            ? "bg-amber-500/70 text-slate-950 hover:bg-amber-400"
                            : "bg-elevated border border-border text-muted hover:border-amber-500/50",
                          isActive && "ring-2 ring-amber-400 ring-offset-1 ring-offset-surface"
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
      </div>
    </div>
  );
}