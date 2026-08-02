"use client";

import { useSportsData } from "@/context/SportsDataContext";
import type { BoxScoreItem } from "@/types/sports";

export function BoxScoreTable({
  items,
  league,
}: {
  items: BoxScoreItem[];
  league?: string;
}) {
  const { players } = useSportsData();

  if (items.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-muted">
        Box score not available yet.
      </p>
    );
  }

  const isVolleyball =
    league === "PVL" || items.some((item) => item.atkPts !== undefined || item.digs !== undefined);

  if (isVolleyball) {
    return (
      <div className="overflow-x-auto">
        <table className="w-full min-w-[500px] text-left text-xs">
          <thead>
            <tr className="text-muted border-b border-border">
              <th className="py-2 pr-2 font-medium">Player</th>
              <th className="px-1.5 py-2 text-right font-medium">POS</th>
              <th className="px-1.5 py-2 text-right font-medium text-foreground">PTS</th>
              <th className="px-1.5 py-2 text-right font-medium">ATK</th>
              <th className="px-1.5 py-2 text-right font-medium">BLK</th>
              <th className="px-1.5 py-2 text-right font-medium">ACE</th>
              <th className="px-1.5 py-2 text-right font-medium">DIG</th>
              <th className="px-1.5 py-2 text-right font-medium">REC</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => {
              const player = players.find((p) => p.id === item.playerId);
              const pos = player?.position ?? "OH";
              const atkPts = item.atkPts ?? Math.round(item.pts * 0.8);
              const blkPts = item.blkPts ?? item.blk ?? Math.round(item.pts * 0.12);
              const acePts = item.acePts ?? Math.max(0, item.pts - atkPts - blkPts);
              const digs = item.digs ?? (pos === "L" ? 12 : 3);
              const receptions = item.receptions ?? (pos === "L" ? 10 : 2);

              return (
                <tr
                  key={item.playerId}
                  className="border-t border-border/50 hover:bg-surface/60 transition-colors"
                >
                  <td className="max-w-[150px] truncate py-2 pr-2 font-semibold text-foreground">
                    {player ? `#${player.jerseyNumber} ${player.name}` : item.playerId}
                  </td>
                  <td className="px-1.5 py-2 text-right tabular-nums text-muted">{pos}</td>
                  <td className="px-1.5 py-2 text-right tabular-nums font-bold text-foreground">
                    {item.pts}
                  </td>
                  <td className="px-1.5 py-2 text-right tabular-nums text-emerald-500 font-medium">
                    {atkPts}
                  </td>
                  <td className="px-1.5 py-2 text-right tabular-nums text-amber-500 font-medium">
                    {blkPts}
                  </td>
                  <td className="px-1.5 py-2 text-right tabular-nums text-sky-500 font-medium">
                    {acePts}
                  </td>
                  <td className="px-1.5 py-2 text-right tabular-nums text-muted">{digs}</td>
                  <td className="px-1.5 py-2 text-right tabular-nums text-muted">{receptions}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
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
            const player = players.find((p) => p.id === item.playerId);
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
