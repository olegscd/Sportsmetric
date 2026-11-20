import { formatAvg, formatPct } from "@/lib/utils";
import type { Player, SeasonAverages } from "@/types/sports";

export interface StatCardTile {
  label: string;
  value: string;
}

/** Identifies volleyball players from either extended stats or position codes. */
export function isVolleyballPlayer(player: Player, avg: SeasonAverages): boolean {
  return (
    avg.killsPerSet !== undefined ||
    avg.avgPerSet !== undefined ||
    player.position === "OH" ||
    player.position === "MB" ||
    player.position === "S" ||
    player.position === "L" ||
    player.position === "OP"
  );
}

/** Formats the headline stat tiles for a shareable player stat card. */
export function exportStatTiles(
  player: Player,
  averages?: SeasonAverages
): StatCardTile[] {
  const avg = averages ?? player.seasonAverages;
  const pos = (player.position || "OH").toUpperCase();

  if (isVolleyballPlayer(player, avg)) {
    if (pos.startsWith("L")) {
      return [
        { label: "Digs / Set", value: formatAvg(avg.avgDig ?? avg.digsPerSet ?? 0) },
        { label: "Dig Success", value: formatPct(avg.successDig ?? 0) },
        { label: "Rec Success", value: formatPct(avg.successRec ?? 0) },
      ];
    }
    if (pos.startsWith("S")) {
      return [
        { label: "Sets / Set", value: formatAvg(avg.avgSet ?? 0) },
        { label: "Setting %", value: formatPct(avg.successSet ?? 0) },
        { label: "Digs / Set", value: formatAvg(avg.avgDig ?? 0) },
      ];
    }
    if (pos.startsWith("MB")) {
      return [
        { label: "PTS / Set", value: formatAvg(avg.avgPerSet ?? avg.ppg ?? 0) },
        { label: "Blocks / Set", value: formatAvg(avg.avgBlk ?? avg.blocksPerSet ?? 0) },
        { label: "Atk Efficiency", value: formatPct(avg.efficiencyAtk ?? avg.attackPct ?? 0) },
      ];
    }
    return [
      { label: "PTS / Set", value: formatAvg(avg.avgPerSet ?? avg.ppg ?? 0) },
      { label: "Kills / Set", value: formatAvg(avg.avgAtk ?? avg.killsPerSet ?? 0) },
      { label: "Atk Efficiency", value: formatPct(avg.efficiencyAtk ?? avg.attackPct ?? 0) },
    ];
  }

  return [
    { label: "PPG", value: formatAvg(avg.ppg) },
    { label: "RPG", value: formatAvg(avg.rpg) },
    { label: "APG", value: formatAvg(avg.apg) },
    { label: "3P%", value: formatPct(avg.threePtPct) },
  ];
}
