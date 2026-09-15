/**
 * Smoke-check the UAAP archive paste/scan parser against real annual-report shapes.
 * Run: npx tsx scripts/verify-uaap-archive-import.ts
 */
import {
  applyImport,
  detectColumnPreset,
  extractAwardsFromText,
  extractStandingsFromReport,
  guessTargets,
  parsePastedTable,
  parsePlacementLabel,
} from "../lib/uaap-import";
import { COLUMN_PRESETS, normalizeSeasonLabel } from "../lib/uaap-schema";
import { matchSchoolCode } from "../lib/uaap-schools";

function assert(cond: unknown, message: string) {
  if (!cond) throw new Error(message);
}

const placementMd = `
#### **MEN’S DIVISION**

| | | |
| :--- | :---: | :--- |
| **Champion** | : | **Far Eastern University** |
| **Second Place** | : | **University of Santo Tomas** |
| **Third Place** | : | **University of the Philippines** |

#### **Most Valuable Player**

Lloyd Escoses - FEU

#### **Rookie of the Year**

Wilmer Frias - FEU
`;

const winLossMd = `
| TEAMS | GP | WIN | LOSS |
| :--- | :---: | :---: | :---: |
| **UP** | 10 | 9 | 1 |
| **UST** | 10 | 9 | 1 |
| **AdU** | 10 | 4 | 6 |
`;

const spaced = `1 University of the Philippines 8 6 Champion
2 De La Salle University 7 7 Runner-up`;

const extracted = extractStandingsFromReport(placementMd, "Men's");
const grid = parsePastedTable(extracted.paste);
const preset = detectColumnPreset(grid.headers);
const columns = preset?.columns ?? COLUMN_PRESETS[0].columns;
const rows = applyImport(grid, guessTargets(grid, columns), columns);

assert(rows.length === 3, `expected 3 placement rows, got ${rows.length}`);
assert(rows[0]?.team === "FEU", `champion school should be FEU, got ${rows[0]?.team}`);
assert(rows[0]?.rank === 1, `champion rank should be 1, got ${rows[0]?.rank}`);
assert(extracted.awards.mvp?.player.includes("Escoses"), "MVP should parse from scan");
assert(extracted.awards.rookie_of_the_year?.school === "FEU", "ROTY school should be FEU");

const wl = parsePastedTable(winLossMd);
const wlPreset = detectColumnPreset(wl.headers);
assert(wlPreset?.id === "win-loss", `expected win-loss preset, got ${wlPreset?.id}`);
const wlCols = wlPreset?.columns ?? [];
const wlRows = applyImport(wl, guessTargets(wl, wlCols), wlCols);
assert(wlRows[0]?.values.wins === 9, `UP wins should be 9, got ${wlRows[0]?.values.wins}`);

const spaceGrid = parsePastedTable(spaced);
assert(
  spaceGrid.rows[0]?.some((c) => matchSchoolCode(c) === "UP"),
  "space-separated school names should coalesce"
);

const awardsTable = extractAwardsFromText(`
| **MOST VALUABLE PLAYER** | : | **DARWIN DELA CALZADA** | (UP) |
| **ROOKIE OF THE YEAR** | : | **FRANCIS FUENTES** | (UST) |
`);
assert(awardsTable.mvp?.school === "UP", `table MVP school, got ${awardsTable.mvp?.school}`);
assert(parsePlacementLabel("Third Palce")?.rank === 3, "OCR 'Palce' should still rank 3rd");
assert(normalizeSeasonLabel("2004 – 05") === "2004-2005", "season shorthand should normalize");

console.log("UAAP archive import parser checks passed.");
