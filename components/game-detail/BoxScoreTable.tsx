import { getPlayerById } from "@/lib/data";
import type { BoxScoreItem } from "@/types/sports";

export function BoxScoreTable({ items }: { items: BoxScoreItem[] }) {
  if (items.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-muted">
        Box score not available yet.
      </p>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[500px] text-left text-xs">
        <thead>
          <tr className="text-muted border-b border-border">
            <th className="py-2 pr-2 font-medium">Player</th>
            <th className="px-1.5 py-2 text-right font-medium">MIN</th>
            <th className="px-1.5 py-2 text-right font-medium">PTS</th>
            <th className="px-1.5 py-2 text-right font-medium">REB</th>
            <th className="px-1.5 py-2 text-right font-medium">AST</th>
            <th className="px-1.5 py-2 text-right font-medium">STL</th>
            <th className="px-1.5 py-2 text-right font-medium">BLK</th>
            <th className="px-1.5 py-2 text-right font-medium">TO</th>
            <th className="px-1.5 py-2 text-right font-medium">PF</th>
            <th className="px-1.5 py-2 text-right font-medium">FG</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => {
            const player = getPlayerById(item.playerId);
            return (
              <tr key={item.playerId} className="border-t border-border/50 hover:bg-surface/60 transition-colors">
                <td className="max-w-[140px] truncate py-2 pr-2 font-semibold text-foreground">
                  {player ? `#${player.jerseyNumber} ${player.name}` : item.playerId}
                </td>
                <td className="px-1.5 py-2 text-right tabular-nums text-muted">{item.min}</td>
                <td className="px-1.5 py-2 text-right tabular-nums font-bold text-foreground">
                  {item.pts}
                </td>
                <td className="px-1.5 py-2 text-right tabular-nums text-muted">{item.reb}</td>
                <td className="px-1.5 py-2 text-right tabular-nums text-muted">{item.ast}</td>
                <td className="px-1.5 py-2 text-right tabular-nums text-muted">{item.stl ?? 0}</td>
                <td className="px-1.5 py-2 text-right tabular-nums text-muted">{item.blk ?? 0}</td>
                <td className="px-1.5 py-2 text-right tabular-nums text-muted">{item.to ?? 0}</td>
                <td className="px-1.5 py-2 text-right tabular-nums text-muted">{item.pf ?? 0}</td>
                <td className="px-1.5 py-2 text-right tabular-nums text-muted">
                  {item.fgM}-{item.fgA}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
