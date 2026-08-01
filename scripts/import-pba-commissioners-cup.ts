/**
 * Imports PBA 50th Season Commissioner's Cup stats from xlsx.
 * Backfills game 133 from GSA/GMA when missing from the export.
 * Run: npx tsx scripts/import-pba-commissioners-cup.ts
 */
import { execFileSync } from "child_process";
import fs from "fs";
import os from "os";
import path from "path";
import {
  getPbaCommCupBackfillRows,
  PBA_COMM_CUP_SKIPPED_GAME_IDS,
} from "./pba-comm-cup-backfill";
import { importPbaStats, type PbaStatsRow } from "./pba-import-core";

export const PBA_COMM_CUP_SEASON_ID = "pba-comm-cup-50";

const COMM_TEAM_CODES = [
  "BWB",
  "CON",
  "GIN",
  "MAG",
  "MBK",
  "MER",
  "NLX",
  "PHX",
  "ROS",
  "SMB",
  "TER",
  "TGR",
  "TNT",
];

const XLSX_PATH = path.resolve("c:/Users/olegs/script/pba_season_stats_20260801_151057.xlsx");
const OUT_PATH = path.resolve("scripts/generated/pba-comm-cup-import.json");
const PYTHON = path.resolve("scripts/read_uaap_xlsx.py");

function readXlsxRows(xlsxPath: string): Record<string, string>[] {
  const tmpPath = path.join(os.tmpdir(), `pba-import-${Date.now()}.json`);
  execFileSync("python", [PYTHON, xlsxPath, tmpPath], { encoding: "utf8" });
  const raw = fs.readFileSync(tmpPath, "utf8");
  fs.unlinkSync(tmpPath);
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

function mergeRows(primary: PbaStatsRow[], backfill: PbaStatsRow[]): PbaStatsRow[] {
  const primaryGameIds = new Set(primary.map((row) => row.game_id));
  const supplemental = backfill.filter((row) => !primaryGameIds.has(row.game_id));
  return [...primary, ...supplemental];
}

function main() {
  const primaryRows = readXlsxRows(XLSX_PATH).map(normalizeRow);
  const backfillRows = getPbaCommCupBackfillRows();
  const normalized = mergeRows(primaryRows, backfillRows);

  const result = importPbaStats(normalized, {
    seasonId: PBA_COMM_CUP_SEASON_ID,
    label: "PBA 50th Season Commissioner's Cup",
    league: "PBA",
    gameIdPrefix: "pba-comm-g",
    sourcePath: XLSX_PATH,
    outPath: OUT_PATH,
    teamCodes: COMM_TEAM_CODES,
    macauVariant: "MBK",
  });

  const backfilledGames = backfillRows.length > 0 ? 1 : 0;

  console.log(
    `Imported ${result.gameCount} games, ${result.playerCount} players, ${result.teamCount} teams → ${OUT_PATH}`
  );
  if (backfilledGames > 0) {
    console.log("Backfilled game 133 (MAG 120, SMB 101) from GSA/GMA box score.");
  }
  if (PBA_COMM_CUP_SKIPPED_GAME_IDS.length > 0) {
    console.log(
      `Skipped game ID(s) ${PBA_COMM_CUP_SKIPPED_GAME_IDS.join(", ")} — rescheduled/no separate box score (MER vs TNT G3 is game 185).`
    );
  }
}

main();
