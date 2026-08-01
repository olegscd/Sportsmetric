import { formatAvg, formatPct } from "@/lib/utils";
import type { League, Player } from "@/types/sports";

function isVolleyballLeague(league: League): boolean {
  return league === "PVL";
}

export function TeamStatsTable({ players, league }: { players: Player[]; league: League }) {
  if (players.length === 0) {
    return <p className="py-8 text-center text-sm text-muted">No stats yet.</p>;
  }

  const roster = [...players].sort((a, b) => a.jerseyNumber - b.jerseyNumber);
  const volleyball = isVolleyballLeague(league);

  return (
    <div className="overflow-x-auto rounded-2xl border border-border bg-surface">
      <table className="w-full min-w-[420px] text-left text-xs">
        <thead>
          <tr className="text-muted">
            <th className="py-2 pr-2 pl-3 font-medium">Player</th>
            {volleyball ? (
              <>
                <th className="px-2 font-medium">Kills/Set</th>
                <th className="px-2 font-medium">Digs/Set</th>
                <th className="px-2 pr-3 font-medium">Blocks/Set</th>
              </>
            ) : (
              <>
                <th className="px-2 font-medium">PPG</th>
                <th className="px-2 font-medium">RPG</th>
                <th className="px-2 font-medium">APG</th>
                <th className="px-2 pr-3 font-medium">3P%</th>
              </>
            )}
          </tr>
        </thead>
        <tbody>
          {roster.map((player) => {
            const avg = player.seasonAverages;
            return (
              <tr key={player.id} className="border-t border-border">
                <td className="max-w-[140px] truncate py-2.5 pr-2 pl-3 font-semibold text-foreground">
                  #{player.jerseyNumber} {player.name}
                </td>
                {volleyball ? (
                  <>
                    <td className="px-2 tabular-nums text-foreground">
                      {formatAvg(avg.killsPerSet ?? 0)}
                    </td>
                    <td className="px-2 tabular-nums text-foreground">
                      {formatAvg(avg.digsPerSet ?? 0)}
                    </td>
                    <td className="px-2 pr-3 tabular-nums text-foreground">
                      {formatAvg(avg.blocksPerSet ?? 0)}
                    </td>
                  </>
                ) : (
                  <>
                    <td className="px-2 tabular-nums text-foreground">{formatAvg(avg.ppg)}</td>
                    <td className="px-2 tabular-nums text-foreground">{formatAvg(avg.rpg)}</td>
                    <td className="px-2 tabular-nums text-foreground">{formatAvg(avg.apg)}</td>
                    <td className="px-2 pr-3 tabular-nums text-foreground">
                      {formatPct(avg.threePtPct)}
                    </td>
                  </>
                )}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
