import { execFileSync } from "child_process";
import fs from "fs";
import path from "path";
import { importPvlStats, type PvlStatsRow } from "./pvl-import-core";

const PYTHON_READER = path.resolve("scripts/read_uaap_xlsx.py");
const XLSX_PATH = path.resolve("PVL stats/pvl_stats_premier_volleyball_league_open_conf_2022.xlsx");
const OUT_PATH = path.resolve("scripts/generated/pvl-2022-open-import.json");

function main() {
  console.log("Importing PVL 2022 Open Conference stats...");
  if (!fs.existsSync(XLSX_PATH)) {
    console.error(`File not found: ${XLSX_PATH}`);
    process.exit(1);
  }

  const raw = execFileSync("python", [PYTHON_READER, XLSX_PATH], {
    encoding: "utf8",
    maxBuffer: 50 * 1024 * 1024,
  });
  const rows = JSON.parse(raw) as PvlStatsRow[];

  const res = importPvlStats(rows, {
    seasonId: "pvl-2022-open",
    label: "PVL 2022 Open Conference",
    gameIdPrefix: "pvl-2022-open-g",
    sourceFile: XLSX_PATH,
    outPath: OUT_PATH,
  });

  console.log(
    `Successfully imported PVL 2022 Open Conference: ${res.gameCount} games, ${res.playerCount} players, ${res.teamCount} teams -> ${OUT_PATH}`
  );
}

main();
