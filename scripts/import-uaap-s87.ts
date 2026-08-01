/**
 * Parses uaap_season_stats into Games + Players for UAAP Season 87 (2024-25).
 * Uses the latest export for steals/blocks/turnovers/fouls; backfills any games
 * missing from that export from the prior CSV so the full schedule stays intact.
 * Run: npx tsx scripts/import-uaap-s87.ts
 */
import { execFileSync } from "child_process";
import fs from "fs";
import path from "path";
import { importUaapStats, type UaapStatsRow } from "./uaap-import-core";

const DEFENSE_XLSX_PATH = path.resolve(
  "c:/Users/olegs/script/uaap_season_stats_20260801_131451.xlsx"
);
const FALLBACK_CSV_PATH = path.resolve("c:/Users/olegs/script/uaap_season_stats.csv");
const OUT_PATH = path.resolve("scripts/generated/uaap-s87-import.json");
const PYTHON = path.resolve("scripts/read_uaap_xlsx.py");

function readXlsxRows(xlsxPath: string): Record<string, string>[] {
  const raw = execFileSync("python", [PYTHON, xlsxPath], { encoding: "utf8" });
  return JSON.parse(raw) as Record<string, string>[];
}

function readCsvRows(csvPath: string): Record<string, string>[] {
  const text = fs.readFileSync(csvPath, "utf8");
  const lines = text.trim().split(/\r?\n/);
  const header = lines[0].split(",");
  return lines.slice(1).map((line) => {
    const values: string[] = [];
    let current = "";
    let inQuotes = false;
    for (const ch of line) {
      if (ch === '"') {
        inQuotes = !inQuotes;
        continue;
      }
      if (ch === "," && !inQuotes) {
        values.push(current);
        current = "";
        continue;
      }
      current += ch;
    }
    values.push(current);
    return Object.fromEntries(header.map((key, i) => [key, values[i] ?? ""]));
  });
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
  const fallbackRows = readCsvRows(FALLBACK_CSV_PATH);
  const normalized = mergeRows(primaryRows, fallbackRows);

  const result = importUaapStats(normalized, {
    seasonId: "2024-25",
    label: "UAAP Season 87 (2024-25)",
    gameIdPrefix: "uaap-s87-g",
    sourcePath: DEFENSE_XLSX_PATH,
    outPath: OUT_PATH,
    useCurrentTeamIds: false,
  });

  const backfilled = fallbackRows.some(
    (row) => !primaryRows.some((primary) => primary.game_id === row.game_id)
  );

  console.log(
    `Imported ${result.gameCount} games, ${result.playerCount} players → ${OUT_PATH}` +
      ` (defense stats from ${path.basename(DEFENSE_XLSX_PATH)})`
  );
  if (backfilled) {
    console.log("Backfilled rows for games missing from the defense export.");
  }
}

main();
