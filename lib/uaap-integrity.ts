import { getSchoolCode } from "./uaap-schools";
import { type UAAPTable } from "./uaap-schema";

/** Structural checks are screening rules, not historical source verification. */
export function tableIntegrityIssues(table: UAAPTable): string[] {
  const issues: string[] = [];
  const schools = new Set<string>();
  const columns = new Set<string>();
  for (const column of table.columns) {
    if (!column.key || columns.has(column.key)) issues.push(`Duplicate or empty column: ${column.key}`);
    columns.add(column.key);
    if (column.decimals !== undefined && (!Number.isInteger(column.decimals) || column.decimals < 0 || column.decimals > 6)) {
      issues.push(`Invalid precision: ${column.key}`);
    }
  }
  if (!table.season || !table.sport || !table.division || !table.stage) issues.push("Missing competition identity.");
  for (const row of table.rows) {
    const school = getSchoolCode(row.team);
    if (!school || schools.has(school)) issues.push(`Duplicate or empty school: ${row.team}`);
    schools.add(school);
    if (!Number.isInteger(row.rank) || row.rank < 1) issues.push(`Invalid rank for ${row.team}.`);
    for (const col of table.columns.filter(c => !c.derived && c.type !== "text")) {
      const value = row.values[col.key];
      if (value !== null && value !== undefined && (typeof value !== "number" || !Number.isFinite(value))) {
        issues.push(`Invalid ${col.key} for ${row.team}.`);
      }
    }
    for (const key of ["wins", "losses", "draws", "games", "gold", "silver", "bronze"]) {
      const value = row.values[key];
      if (value !== null && value !== undefined && (typeof value !== "number" || !Number.isInteger(value) || value < 0)) {
        issues.push(`Invalid ${key} for ${row.team}.`);
      }
    }
    const { wins: w, losses: l, draws: d, games: g, pct } = row.values;
    if (typeof pct === "number" && (pct < 0 || pct > 1)) issues.push(`PCT outside 0-1 for ${row.team}.`);
    if (typeof g === "number" && typeof w === "number" && typeof l === "number" &&
      (!columns.has("draws") || typeof d === "number") && w + l + (typeof d === "number" ? d : 0) !== g) {
      issues.push(`Games do not equal W/D/L for ${row.team}.`);
    }
    if (typeof pct === "number" && typeof w === "number" && typeof l === "number" && w + l > 0 &&
      !table.columns.some(c => c.key === "pct" && c.derived) && Math.abs(pct - w / (w + l)) > 0.00051) {
      issues.push(`PCT mismatch for ${row.team}.`);
    }
    if (typeof d === "number" && d > 0 && table.columns.some(c => c.derived?.kind === "winPct")) {
      issues.push("Win percentage excludes reported draws.");
    }
  }
  // Equal ranks can be official ties/co-champions; never demand unique ranks.
  return [...new Set(issues)];
}
