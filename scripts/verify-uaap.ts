import fs from "fs";
import path from "path";
import {
  legacyRecordsToTables,
  makeDivisionKey,
  createEmptyTable,
  normalizeChessMedalists,
  formatCellValue,
  COLUMN_PRESETS,
  type LegacyStandingRecord,
} from "../lib/uaap-schema";
import { mergeUAAPData, type UAAPAdminOverrides } from "../lib/uaap-data";
import { parsePastedTable, guessTargets, applyImport } from "../lib/uaap-import";

let failures = 0;
function check(name: string, condition: boolean, detail?: unknown) {
  if (condition) {
    console.log(`  ok   ${name}`);
  } else {
    failures += 1;
    console.log(`  FAIL ${name}`, detail !== undefined ? JSON.stringify(detail) : "");
  }
}

const standings: LegacyStandingRecord[] = JSON.parse(
  fs.readFileSync(path.resolve("data/uaap_standings.json"), "utf-8")
);
const extras = JSON.parse(fs.readFileSync(path.resolve("data/uaap_archive_extras.json"), "utf-8"));

console.log("\n1. Legacy adapter");
const tables = legacyRecordsToTables(standings);
check("every legacy record lands in a table", tables.reduce((n, t) => n + t.rows.length, 0) === standings.length, {
  rows: tables.reduce((n, t) => n + t.rows.length, 0),
  records: standings.length,
});

const winLoss = tables.find((t) => t.season === "1998-1999" && t.sport === "Badminton");
check("win-loss era infers W/L/PCT columns", winLoss?.columns.map((c) => c.key).join(",") === "wins,losses,pct", winLoss?.columns);

const pointsTable = tables.find((t) => t.sport === "General Championship");
check("points era infers only a PTS column", pointsTable?.columns.map((c) => c.key).join(",") === "points", pointsTable?.columns);

const placement = tables.find((t) => t.season === "2003-2004" && t.sport === "Badminton");
check("placement-only era infers zero stat columns", placement?.columns.length === 0, placement?.columns);

const bare = tables.find((t) => t.season === "1988-1989" && t.sport === "Basketball");
check("rank-only era still produces rows", (bare?.rows.length ?? 0) > 0 && bare?.columns.length === 0);

console.log("\n2. Derived win percentage");
const wlRow = winLoss!.rows[0];
const pctCol = winLoss!.columns.find((c) => c.derived)!;
check("PCT computed from W and L", formatCellValue(wlRow, pctCol) === "1.000", formatCellValue(wlRow, pctCol));

console.log("\n3. Division normalisation");
check(
  "Junior and Juniors collapse to one key",
  makeDivisionKey("1987-1988", "Chess", "Junior") === makeDivisionKey("1987-1988", "Chess", "Juniors")
);

console.log("\n4. Merge precedence");
const custom = createEmptyTable("2003-2004", "Basketball", "Men's", [
  { key: "sets_won", label: "Sets", type: "number" },
]);
custom.rows = [{ rank: 1, team: "FEU", values: { sets_won: 9 }, details: "Champion" }];

const overrides: UAAPAdminOverrides = {
  updated_at: new Date().toISOString(),
  tables_overrides: { [makeDivisionKey("2003-2004", "Basketball", "Men's")]: custom },
  standings_overrides: {},
  deleted_divisions: [],
  extras_overrides: { awards: {}, chess_medalists: {} },
};

const merged = mergeUAAPData(standings, extras, overrides);
const overridden = merged.tables.find(
  (t) => t.season === "2003-2004" && t.sport === "Basketball" && t.division === "Men's"
);
check("custom columns survive the merge", overridden?.columns[0]?.key === "sets_won", overridden?.columns);
check("override replaces base rows", overridden?.rows.length === 1, overridden?.rows.length);
check("unrelated divisions untouched", merged.tables.length === tables.length, {
  merged: merged.tables.length,
  base: tables.length,
});

const deleted = mergeUAAPData(standings, extras, {
  ...overrides,
  tables_overrides: {},
  deleted_divisions: [makeDivisionKey("2003-2004", "Basketball", "Men's")],
});
check("deleted divisions disappear", deleted.tables.length === tables.length - 1);

console.log("\n5. Legacy overrides still readable");
const legacyOverride = mergeUAAPData(standings, extras, {
  ...overrides,
  tables_overrides: {},
  standings_overrides: {
    [makeDivisionKey("1900-1901", "Chess", "Men's")]: [
      {
        season: "1900-1901", sport: "Chess", division: "Men's", stage: "Final Standings",
        rank: 1, team: "UST", wins: 5, losses: 1, pct: null, points: null,
        details: "Champion", source_page: "legacy",
      },
    ],
  },
});
check(
  "pre-flexible-column overrides convert to tables",
  legacyOverride.tables.some((t) => t.season === "1900-1901" && t.columns.length === 3)
);

console.log("\n6. Bulk import parser");
const pasted = `1  FEU   12-2  Champion
2  UST   11-3  Runner-up
3  UP     8-6`;
const grid = parsePastedTable(pasted);
check("splits into 3 rows", grid.rows.length === 3, grid.rows);
const targets = guessTargets(grid, COLUMN_PRESETS[0].columns);
const importedRows = applyImport(grid, targets, COLUMN_PRESETS[0].columns);
check("school column detected", importedRows[0]?.team === "FEU", importedRows[0]);
check("combined 12-2 record split into W and L", importedRows[0]?.values.wins === 12 && importedRows[0]?.values.losses === 2, importedRows[0]?.values);
check("notes captured", importedRows[0]?.details === "Champion", importedRows[0]?.details);

const csv = `Rank,School,W,L,Notes
1,Ateneo,14,0,Champion
2,La Salle,11,3,`;
const csvGrid = parsePastedTable(csv);
check("CSV header row detected", csvGrid.headers?.[0] === "Rank", csvGrid.headers);
const csvRows = applyImport(csvGrid, guessTargets(csvGrid, COLUMN_PRESETS[0].columns), COLUMN_PRESETS[0].columns);
check("full school names resolve to codes", csvRows[0]?.team === "ADMU" && csvRows[1]?.team === "DLSU", csvRows.map((r) => r.team));
check("header-matched stat columns fill", csvRows[0]?.values.wins === 14, csvRows[0]?.values);

console.log("\n7. Chess medalists normalisation");
const flatShape = normalizeChessMedalists(extras.chess_medalists["Chess|1987-1988"]["Juniors"]);
check("flat base list becomes board-keyed", !!flatShape && Object.keys(flatShape)[0] === "1", flatShape && Object.keys(flatShape));
const boardShape = normalizeChessMedalists({ "1": [{ medal: "gold", player: "A", school: "UST" }] });
check("admin board map passes through", boardShape?.["1"]?.[0]?.medal === "gold", boardShape);

console.log(failures === 0 ? "\nAll checks passed.\n" : `\n${failures} check(s) failed.\n`);
process.exit(failures === 0 ? 0 : 1);
