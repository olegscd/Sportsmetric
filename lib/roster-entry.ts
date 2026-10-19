import type { Player, Position } from "@/types/sports";

export const BASKETBALL_POSITIONS: Position[] = ["PG", "SG", "SF", "PF", "C"];
export const VOLLEYBALL_POSITIONS: Position[] = ["OH", "OP", "MB", "S", "L"];

export interface RosterRow {
  jerseyNumber: number;
  name: string;
  position: Position;
  height: string;
}

/** Accept spreadsheet columns or `#7 Name PG 6-2`, retaining line numbers on errors. */
export function parseRosterEntry(text: string, volleyball = false) {
  const rows: RosterRow[] = [];
  const issues: string[] = [];
  const positions = volleyball ? VOLLEYBALL_POSITIONS : BASKETBALL_POSITIONS;
  const names = new Set<string>();
  const jerseys = new Set<number>();
  text.split(/\r?\n/).forEach((raw, index) => {
    const line = raw.trim();
    if (!line) return;
    let jersey = "", name = "", position = "", height = "";
    if (/[|,\t]/.test(line)) {
      const columns = line.split(/[|,\t]/).map(value => value.trim());
      if (/^(?:#|jersey|jersey #|number)$/i.test(columns[0]) && /^name$/i.test(columns[1])) return;
      [jersey = "", name = "", position = "", height = ""] = columns;
      if (columns.length > 4) { issues.push(`Line ${index + 1}: Use four columns: jersey, name, position, height.`); return; }
    } else {
      const match = line.match(/^#?(\d+)\s+(.+?)\s+(PG|SG|SF|PF|C|G|F|OH|OP|MB|S|L)(?:\s+(.+))?$/i);
      if (!match) { issues.push(`Line ${index + 1}: Use “#7 Full Name ${positions[0]} 6-2” or four spreadsheet columns.`); return; }
      [, jersey, name, position, height = ""] = match;
    }
    const numericJersey = Number(jersey.replace(/^#/, ""));
    position = position.toUpperCase();
    if (!volleyball && position === "G") position = "SG";
    if (!volleyball && position === "F") position = "SF";
    if (!/^#?\d{1,2}$/.test(jersey) || !Number.isInteger(numericJersey)) { issues.push(`Line ${index + 1}: Jersey must be a whole number from 0 to 99.`); return; }
    if (!name || !positions.includes(position as Position)) { issues.push(`Line ${index + 1}: Enter a name and a valid position (${positions.join(", ")}).`); return; }
    if (names.has(name.toLowerCase()) || (numericJersey > 0 && jerseys.has(numericJersey))) { issues.push(`Line ${index + 1}: Duplicate player name or jersey number in this batch.`); return; }
    names.add(name.toLowerCase());
    jerseys.add(numericJersey);
    rows.push({ jerseyNumber: numericJersey, name, position: position as Position, height });
  });
  if (rows.length > 500) issues.push("Import up to 500 players at a time.");
  return { rows, issues };
}

export function rosterConflicts(rows: Pick<RosterRow, "name" | "jerseyNumber">[], existing: Player[]) {
  return rows.flatMap(row => {
    if (existing.some(player => player.name.trim().toLowerCase() === row.name.trim().toLowerCase())) return [`${row.name} is already on this roster.`];
    if (row.jerseyNumber > 0 && existing.some(player => player.jerseyNumber === row.jerseyNumber)) return [`Jersey #${row.jerseyNumber} is already in use on this roster.`];
    return [];
  });
}
