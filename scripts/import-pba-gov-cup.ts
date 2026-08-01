/**
 * Imports PBA 50th Season Governors' Cup stats from xlsx.
 * Run: npx tsx scripts/import-pba-gov-cup.ts
 */
import { execFileSync } from "child_process";
import path from "path";
import { importPbaStats, type PbaStatsRow } from "./pba-import-core";

export const PBA_GOV_CUP_SEASON_ID = "pba-gov-cup-50";

const XLSX_PATH = path.resolve("c:/Users/olegs/script/pba_season_stats_20260801_143020.xlsx");
const OUT_PATH = path.resolve("scripts/generated/pba-gov-cup-import.json");
const PYTHON = path.resolve("scripts/read_uaap_xlsx.py");

function readXlsxRows(xlsxPath: string): Record<string, string>[] {
  const raw = execFileSync("python", [PYTHON, xlsxPath], { encoding: "utf8" });
  return JSON.parse(raw) as Record<string, string>[];
}

function normalizeRow(row: Record<string, string>): PbaStatsRow {
  return {
    game_id: row.game_id,
    game_date: row.game_date,
    venue: row.venue,
    team: row.team,
    opponent: row.opponent,
    team_score: row.team_score,
    player: row.player,
    jersey: row.jersey,
    mins: row.mins,
    pts: row.pts,
    reb: row.reb,
    ast: row.ast,
    stl: row.stl,
    blk: row.blk,
    to: row.to,
    pf: row.pf,
    fg2_pct: row.fg2_pct,
    fg3_pct: row.fg3_pct,
    ft_pct: row.ft_pct,
  };
}

function main() {
  const rows = readXlsxRows(XLSX_PATH).map(normalizeRow);
  const result = importPbaStats(rows, {
    seasonId: PBA_GOV_CUP_SEASON_ID,
    label: "PBA 50th Season Governors' Cup",
    league: "PBA",
    gameIdPrefix: "pba-gov-g",
    sourcePath: XLSX_PATH,
    outPath: OUT_PATH,
    teamCodes: ["BWB", "CON", "GIN", "MAG", "MER", "MGP", "NLX", "PHX", "ROS", "SMB", "TER", "TGR", "TNT"],
    macauVariant: "MGP",
  });

  console.log(
    `Imported ${result.gameCount} games, ${result.playerCount} players, ${result.teamCount} teams → ${OUT_PATH}`
  );
}

main();
