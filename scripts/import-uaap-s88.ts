/**
 * Parses uaap_season_stats xlsx into Games + Players for UAAP Season 88 (2025-26).
 * Uses the latest export for steals/blocks/turnovers/fouls; backfills any games
 * missing from that export from the prior file so the full schedule stays intact.
 * Run: npx tsx scripts/import-uaap-s88.ts
 */
import { execFileSync } from "child_process";
import path from "path";
import { importUaapStats, type UaapStatsRow } from "./uaap-import-core";

const DEFENSE_XLSX_PATH = path.resolve(
  "c:/Users/olegs/script/uaap_season_stats_20260801_130855.xlsx"
);
const FALLBACK_XLSX_PATH = path.resolve(
  "c:/Users/olegs/script/uaap_season_stats_20260801_120815.xlsx"
);
const OUT_PATH = path.resolve("scripts/generated/uaap-s88-import.json");
const PYTHON = path.resolve("scripts/read_uaap_xlsx.py");

function readXlsxRows(xlsxPath: string): Record<string, string>[] {
  const raw = execFileSync("python", [PYTHON, xlsxPath], { encoding: "utf8" });
  return JSON.parse(raw) as Record<string, string>[];
}

function normalizeRow(row: Record<string, string>): UaapStatsRow {
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

function mergeRows(
  primary: Record<string, string>[],
  fallback: Record<string, string>[]
): UaapStatsRow[] {
  const primaryGameIds = new Set(primary.map((row) => row.game_id));
  const missingFromPrimary = fallback.filter((row) => !primaryGameIds.has(row.game_id));
  return [...primary, ...missingFromPrimary].map(normalizeRow);
}

function main() {
  const primaryRows = readXlsxRows(DEFENSE_XLSX_PATH);
  const fallbackRows = readXlsxRows(FALLBACK_XLSX_PATH);
  const normalized = mergeRows(primaryRows, fallbackRows);

  const result = importUaapStats(normalized, {
    seasonId: "2025-26",
    label: "UAAP Season 88 (2025-26)",
    gameIdPrefix: "uaap-s88-g",
    sourcePath: DEFENSE_XLSX_PATH,
    outPath: OUT_PATH,
    useCurrentTeamIds: true,
  });

  const backfilledGames = new Set(fallbackRows.map((row) => row.game_id)).size - new Set(
    primaryRows.map((row) => row.game_id)
  ).size;

  console.log(
    `Imported ${result.gameCount} games, ${result.playerCount} players → ${OUT_PATH}` +
      ` (defense stats from ${path.basename(DEFENSE_XLSX_PATH)})`
  );
  if (backfilledGames > 0) {
    console.log(`Backfilled rows for games missing from the defense export.`);
  }
}

main();
