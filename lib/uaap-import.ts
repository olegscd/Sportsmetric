/**
 * Deterministic parsing for the admin bulk-import flow.
 *
 * Historical UAAP tables are transcribed from scans in many different layouts,
 * so nothing here tries to be clever about meaning. The text is split into a
 * plain grid and the admin confirms what each column is; the guesses below only
 * pre-select a mapping that can be corrected before anything is committed.
 */

import {
  matchSchoolCode,
} from "@/lib/uaap-schools";
import {
  toNumberOrNull,
  type UAAPColumn,
  type UAAPRow,
} from "@/lib/uaap-schema";

export type ImportTargetKind = "ignore" | "rank" | "team" | "details" | "record" | "column";

export interface ImportTarget {
  kind: ImportTargetKind;
  /** Set when kind is "column". */
  columnKey?: string;
}

export interface ParsedGrid {
  headers: string[] | null;
  rows: string[][];
  /** Human-readable description of how the text was split, shown in the UI. */
  delimiterLabel: string;
}

const RECORD_PATTERN = /^(\d{1,3})\s*[-–—/]\s*(\d{1,3})$/;

function splitLine(line: string, delimiter: "tab" | "comma" | "space"): string[] {
  if (delimiter === "tab") return line.split("\t").map((c) => c.trim());
  if (delimiter === "comma") return splitCsvLine(line);
  return line.trim().split(/\s{2,}|\s+/).map((c) => c.trim());
}

/** Minimal CSV splitter that honours double-quoted fields containing commas. */
function splitCsvLine(line: string): string[] {
  const out: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === "," && !inQuotes) {
      out.push(current.trim());
      current = "";
    } else {
      current += char;
    }
  }
  out.push(current.trim());
  return out;
}

function detectDelimiter(lines: string[]): { delimiter: "tab" | "comma" | "space"; label: string } {
  const sample = lines.slice(0, 5);
  if (sample.some((l) => l.includes("\t"))) {
    return { delimiter: "tab", label: "tab-separated (pasted from a spreadsheet)" };
  }
  if (sample.some((l) => l.includes(","))) {
    return { delimiter: "comma", label: "comma-separated (CSV)" };
  }
  return { delimiter: "space", label: "whitespace-separated" };
}

function looksLikeHeader(cells: string[]): boolean {
  const numericCells = cells.filter((c) => c !== "" && toNumberOrNull(c) !== null).length;
  if (numericCells > 0) return false;
  return cells.some((c) =>
    /^(rank|no\.?|pos|team|school|w|l|wins|losses|pct|win%|pts|points|record|notes?|result|details|gold|silver|bronze)$/i.test(
      c
    )
  );
}

export function parsePastedTable(text: string): ParsedGrid {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l !== "");

  if (lines.length === 0) {
    return { headers: null, rows: [], delimiterLabel: "no content" };
  }

  const { delimiter, label } = detectDelimiter(lines);
  const grid = lines.map((line) => splitLine(line, delimiter)).filter((cells) => cells.length > 0);

  // Leading "1." or "1)" list markers are punctuation, not a rank column.
  const normalized = grid.map((cells) =>
    cells.map((cell, idx) => (idx === 0 ? cell.replace(/^(\d{1,2})[.)]$/, "$1") : cell))
  );

  const width = Math.max(...normalized.map((c) => c.length));
  const padded = normalized.map((cells) => {
    const copy = [...cells];
    while (copy.length < width) copy.push("");
    return copy;
  });

  if (padded.length > 1 && looksLikeHeader(padded[0])) {
    return { headers: padded[0], rows: padded.slice(1), delimiterLabel: label };
  }

  return { headers: null, rows: padded, delimiterLabel: label };
}

const HEADER_ALIASES: Array<[RegExp, ImportTargetKind | string]> = [
  [/^(rank|no\.?|pos|place|placing)$/i, "rank"],
  [/^(team|school|university)$/i, "team"],
  [/^(record|w-l|w\/l)$/i, "record"],
  [/^(notes?|result|details|remarks?|finish)$/i, "details"],
];

/**
 * Pre-selects a mapping for each parsed column. Header names win when present;
 * otherwise the shape of the sample values is used.
 */
export function guessTargets(
  grid: ParsedGrid,
  columns: UAAPColumn[]
): ImportTarget[] {
  const width = grid.headers?.length ?? (grid.rows[0]?.length || 0);
  const enterable = columns.filter((c) => !c.derived);
  const targets: ImportTarget[] = new Array(width).fill(null).map(() => ({ kind: "ignore" }));
  const usedColumnKeys = new Set<string>();
  let teamAssigned = false;
  let rankAssigned = false;

  const columnValues = (idx: number) => grid.rows.map((r) => r[idx] ?? "").filter((v) => v !== "");

  for (let i = 0; i < width; i += 1) {
    const header = grid.headers?.[i]?.trim() ?? "";

    if (header) {
      const alias = HEADER_ALIASES.find(([pattern]) => pattern.test(header));
      if (alias) {
        const kind = alias[1] as ImportTargetKind;
        if (kind === "team" && teamAssigned) continue;
        if (kind === "rank" && rankAssigned) continue;
        if (kind === "team") teamAssigned = true;
        if (kind === "rank") rankAssigned = true;
        targets[i] = { kind };
        continue;
      }

      const matchedColumn = enterable.find(
        (c) =>
          !usedColumnKeys.has(c.key) &&
          (c.label.toLowerCase() === header.toLowerCase() ||
            c.key.toLowerCase() === header.toLowerCase())
      );
      if (matchedColumn) {
        usedColumnKeys.add(matchedColumn.key);
        targets[i] = { kind: "column", columnKey: matchedColumn.key };
        continue;
      }
    }

    const values = columnValues(i);
    if (values.length === 0) continue;

    if (!teamAssigned && values.some((v) => matchSchoolCode(v) !== null)) {
      teamAssigned = true;
      targets[i] = { kind: "team" };
      continue;
    }

    if (values.every((v) => RECORD_PATTERN.test(v))) {
      targets[i] = { kind: "record" };
      continue;
    }

    const allNumeric = values.every((v) => toNumberOrNull(v) !== null);
    if (allNumeric) {
      if (!rankAssigned && i === 0) {
        rankAssigned = true;
        targets[i] = { kind: "rank" };
        continue;
      }
      const nextColumn = enterable.find((c) => !usedColumnKeys.has(c.key));
      if (nextColumn) {
        usedColumnKeys.add(nextColumn.key);
        targets[i] = { kind: "column", columnKey: nextColumn.key };
        continue;
      }
    }

    if (!targets.some((t) => t.kind === "details")) {
      targets[i] = { kind: "details" };
    }
  }

  return targets;
}

export interface ApplyImportOptions {
  /** Column keys that a "record" cell (e.g. "12-2") should populate. */
  recordKeys?: { wins: string; losses: string };
  /** Replace unrecognised school text with a matched code where possible. */
  normalizeSchools?: boolean;
}

export function applyImport(
  grid: ParsedGrid,
  targets: ImportTarget[],
  columns: UAAPColumn[],
  options: ApplyImportOptions = {}
): UAAPRow[] {
  const { recordKeys = { wins: "wins", losses: "losses" }, normalizeSchools = true } = options;
  const byKey = new Map(columns.filter((c) => !c.derived).map((c) => [c.key, c]));

  const rows: UAAPRow[] = [];

  grid.rows.forEach((cells, rowIdx) => {
    const values: Record<string, string | number | null> = {};
    let team = "";
    let rank: number | null = null;
    let details: string | null = null;

    targets.forEach((target, colIdx) => {
      const raw = (cells[colIdx] ?? "").trim();
      if (raw === "" || target.kind === "ignore") return;

      switch (target.kind) {
        case "rank":
          rank = toNumberOrNull(raw);
          break;
        case "team":
          team = normalizeSchools ? matchSchoolCode(raw) ?? raw : raw;
          break;
        case "details":
          details = raw;
          break;
        case "record": {
          const match = raw.match(RECORD_PATTERN);
          if (match) {
            if (byKey.has(recordKeys.wins)) values[recordKeys.wins] = Number(match[1]);
            if (byKey.has(recordKeys.losses)) values[recordKeys.losses] = Number(match[2]);
          }
          break;
        }
        case "column": {
          if (!target.columnKey) break;
          const column = byKey.get(target.columnKey);
          if (!column) break;
          values[column.key] = column.type === "text" ? raw : toNumberOrNull(raw);
          break;
        }
      }
    });

    if (team === "" && Object.keys(values).length === 0 && !details) return;

    rows.push({
      rank: rank ?? rowIdx + 1,
      team,
      values,
      details,
    });
  });

  return rows;
}
