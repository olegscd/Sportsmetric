"use client";

import { TableShell, Td, Th } from "@/components/ui/Table";
import { useSportsData } from "@/context/SportsDataContext";
import { formatAvg, formatPct } from "@/lib/utils";
import type { League, Player } from "@/types/sports";
import Link from "next/link";

function isVolleyballLeague(league: League): boolean {
  return league === "PVL";
}

export function TeamStatsTable({ players, league }: { players: Player[]; league: League }) {
  const { getPlayerAverages } = useSportsData();

  if (players.length === 0) {
    return <p className="py-8 text-center text-sm text-muted">No stats yet.</p>;
  }

  const roster = [...players].sort((a, b) => a.jerseyNumber - b.jerseyNumber);
  const volleyball = isVolleyballLeague(league);

  return (
    <TableShell>
      <table className="w-full min-w-[26rem] text-left text-xs">
        <thead>
          <tr>
            <Th sticky className="min-w-36 pl-3">Player</Th>
            {volleyball ? (
              <>
                <Th numeric className="px-2">Kills/Set</Th>
                <Th numeric className="px-2">Digs/Set</Th>
                <Th numeric className="px-2 pr-3">Blocks/Set</Th>
              </>
            ) : (
              <>
                <Th numeric className="px-2">PPG</Th>
                <Th numeric className="px-2">RPG</Th>
                <Th numeric className="px-2">APG</Th>
                <Th numeric className="px-2 pr-3">3P%</Th>
              </>
            )}
          </tr>
        </thead>
        <tbody>
          {roster.map((player) => {
            const avg = getPlayerAverages(player);
            return (
              <tr key={player.id} className="transition-colors hover:bg-elevated/50">
                <Td sticky className="max-w-40 truncate pl-3 font-semibold">
                  <Link
                    href={`/players/${encodeURIComponent(player.id)}`}
                    className="hover:text-primary hover:underline"
                  >
                    #{player.jerseyNumber} {player.name}
                  </Link>
                </Td>
                {volleyball ? (
                  <>
                    <Td numeric className="px-2">{formatAvg(avg.killsPerSet ?? avg.avgAtk ?? 0)}</Td>
                    <Td numeric className="px-2">{formatAvg(avg.digsPerSet ?? avg.avgDig ?? 0)}</Td>
                    <Td numeric className="px-2 pr-3">{formatAvg(avg.blocksPerSet ?? avg.avgBlk ?? 0)}</Td>
                  </>
                ) : (
                  <>
                    <Td numeric className="px-2">{formatAvg(avg.ppg)}</Td>
                    <Td numeric className="px-2">{formatAvg(avg.rpg)}</Td>
                    <Td numeric className="px-2">{formatAvg(avg.apg)}</Td>
                    <Td numeric className="px-2 pr-3">{formatPct(avg.threePtPct)}</Td>
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
