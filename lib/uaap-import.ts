/**
 * Deterministic parsing for the admin bulk-import flow.
 *
 * Historical UAAP tables are transcribed from scans in many different layouts,
 * so nothing here tries to be clever about meaning. The text is split into a
 * plain grid and the admin confirms what each column is; the guesses below only
 * pre-select a mapping that can be corrected before anything is committed.
 */

import { matchSchoolCode } from "@/lib/uaap-schools";
import {
  COLUMN_PRESETS,
  normalizeDivision,
  toNumberOrNull,
  type UAAPColumn,
  type UAAPColumnPreset,
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

export interface ExtractedAwards {
  mvp: { player: string; school: string } | null;
  rookie_of_the_year: { player: string; school: string } | null;
}

export interface ReportExtract {
  paste: string;
  delimiterLabel: string;
  awards: ExtractedAwards;
  tableCount: number;
  usedDivisionSlice: boolean;
}

const RECORD_PATTERN = /^(\d{1,3})\s*[-–—/]\s*(\d{1,3})$/;

function stripMarkup(value: string): string {
  return value
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/<\/?[^>]+>/g, "")
    .replace(/\*\*/g, "")
    .replace(/[_*]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function splitLine(line: string, delimiter: "tab" | "comma" | "space"): string[] {
  if (delimiter === "tab") return line.split("\t").map((c) => stripMarkup(c));
  if (delimiter === "comma") return splitCsvLine(line).map((c) => stripMarkup(c));
  return line
    .trim()
    .split(/\s{2,}|\s+/)
    .map((c) => stripMarkup(c));
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
    /^(rank|no\.?|pos|team|school|teams?|university|w|l|win|wins|loss|losses|pct|win%|pts|points|gp|record|notes?|result|details|gold|silver|bronze|total points)$/i.test(
      c
    )
  );
}

function isMarkdownSeparator(line: string): boolean {
  return /^\s*\|?\s*:?-{2,}.*\|\s*$/.test(line);
}

function isMarkdownRow(line: string): boolean {
  const trimmed = line.trim();
  return trimmed.startsWith("|") && trimmed.includes("|");
}

function splitMarkdownRow(line: string): string[] {
  let trimmed = line.trim();
  if (trimmed.startsWith("|")) trimmed = trimmed.slice(1);
  if (trimmed.endsWith("|")) trimmed = trimmed.slice(0, -1);
  return trimmed.split("|").map((c) => stripMarkup(c));
}

function padGrid(rows: string[][]): string[][] {
  if (rows.length === 0) return rows;
  const width = Math.max(...rows.map((c) => c.length));
  return rows.map((cells) => {
    const copy = [...cells];
    while (copy.length < width) copy.push("");
    return copy;
  });
}

export function parseMarkdownTables(text: string): ParsedGrid[] {
  const lines = text.split(/\r?\n/);
  const tables: ParsedGrid[] = [];
  let current: string[][] = [];

  const flush = () => {
    const rows = current.filter((cells) => cells.some((c) => c !== ""));
    current = [];
    if (rows.length === 0) return;
    const padded = padGrid(rows);
    if (padded.length > 1 && looksLikeHeader(padded[0])) {
      tables.push({
        headers: padded[0],
        rows: padded.slice(1),
        delimiterLabel: "markdown table (annual report)",
      });
    } else {
      tables.push({
        headers: null,
        rows: padded,
        delimiterLabel: "markdown table (annual report)",
      });
    }
  };

  for (const line of lines) {
    if (isMarkdownSeparator(line)) continue;
    if (isMarkdownRow(line)) {
      current.push(splitMarkdownRow(line));
    } else if (current.length > 0) {
      flush();
    }
  }
  if (current.length > 0) flush();
  return tables;
}

const PLACEMENT_RULES: Array<{ pattern: RegExp; rank: number; label: string }> = [
  { pattern: /^(co-?)?champions?$/, rank: 1, label: "Champion" },
  { pattern: /^runner-?ups?$/, rank: 2, label: "Runner-up" },
  { pattern: /^(second|2nd)(\s+p[a-z]*)?$/, rank: 2, label: "Runner-up" },
  { pattern: /^(third|3rd)(\s+p[a-z]*)?$/, rank: 3, label: "Third place" },
  { pattern: /^(fourth|4th)(\s+p[a-z]*)?$/, rank: 4, label: "Fourth place" },
  { pattern: /^(fifth|5th)(\s+p[a-z]*)?$/, rank: 5, label: "Fifth place" },
  { pattern: /^(sixth|6th)(\s+p[a-z]*)?$/, rank: 6, label: "Sixth place" },
  { pattern: /^(seventh|7th)(\s+p[a-z]*)?$/, rank: 7, label: "Seventh place" },
  { pattern: /^(eighth|eight|8th)(\s+p[a-z]*)?$/, rank: 8, label: "Eighth place" },
];

export function parsePlacementLabel(raw: string): { rank: number; label: string } | null {
  const compact = stripMarkup(raw)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
  if (!compact) return null;
  for (const rule of PLACEMENT_RULES) {
    if (rule.pattern.test(compact)) return { rank: rule.rank, label: rule.label };
  }
  return null;
}

export function parsePlacementLines(text: string): ParsedGrid | null {
  const rows: string[][] = [];
  for (const line of text.split(/\r?\n/)) {
    const cleaned = stripMarkup(line);
    if (!cleaned) continue;
    const match = cleaned.match(
      /^(champion|co-?champion|runner-?up|(?:first|second|third|fourth|fifth|sixth|seventh|eighth|1st|2nd|3rd|4th|5th|6th|7th|8th)\s*pl\w*)\s*[:\-–—]\s*(.+)$/i
    );
    if (!match) continue;
    rows.push([match[1], match[2]]);
  }
  if (rows.length < 2) return null;
  return {
    headers: ["Result", "School"],
    rows: padGrid(rows),
    delimiterLabel: "placement list (Champion, Second Place, …)",
  };
}

/**
 * OCR / typed rows often split "University of the Philippines" into one token
 * per word. Merge the longest span that still resolves to a known school.
 */
function coalesceSchoolCells(cells: string[]): string[] {
  if (cells.length < 3) return cells;
  let best: { start: number; end: number } | null = null;
  for (let start = 0; start < cells.length; start += 1) {
    for (let end = start; end < cells.length; end += 1) {
      const span = cells.slice(start, end + 1).join(" ");
      if (!matchSchoolCode(span)) continue;
      const width = end - start;
      if (!best || width > best.end - best.start) best = { start, end };
    }
  }
  if (!best || best.end === best.start) return cells;
  return [
    ...cells.slice(0, best.start),
    cells.slice(best.start, best.end + 1).join(" "),
    ...cells.slice(best.end + 1),
  ];
}

function gridToTsv(grid: ParsedGrid): string {
  const lines: string[] = [];
  if (grid.headers) lines.push(grid.headers.join("\t"));
  for (const row of grid.rows) lines.push(row.join("\t"));
  return lines.join("\n");
}

function isGameResultTable(grid: ParsedGrid): boolean {
  const blob = [...(grid.headers ?? []), ...grid.rows.flat()].join(" ").toUpperCase();
  if (
    blob.includes("DEFEATED") ||
    blob.includes("M/A") ||
    /\bAST\b/.test(blob) ||
    /\bBLK\b/.test(blob) ||
    blob.includes("STRT") ||
    blob.includes("OPENING CEREMONIES") ||
    blob.includes("FINAL FOUR")
  ) {
    return true;
  }
  const headerBlob = (grid.headers ?? []).join(" ").toUpperCase();
  if (
    (/\bNAME\b/.test(headerBlob) && !/\b(TEAM|SCHOOL)\b/.test(headerBlob)) ||
    /\bMIN\b/.test(headerBlob) ||
    /\bREB\b/.test(headerBlob)
  ) {
    return true;
  }
  const dayHits = grid.rows.filter((row) =>
    row.some((cell) => /^(sunday|monday|tuesday|wednesday|thursday|friday|saturday)$/i.test(cell))
  ).length;
  return dayHits >= 2;
}

export function scoreStandingsGrid(grid: ParsedGrid): number {
  if (grid.rows.length === 0) return -100;
  if (isGameResultTable(grid)) return -100;

  let score = grid.rows.length;
  const headerBlob = (grid.headers ?? []).join(" ").toLowerCase();
  if (/(win|wins|loss|losses|\bw\b|\bl\b)/.test(headerBlob)) score += 20;
  if (/(pts|points|total points)/.test(headerBlob)) score += 16;
  if (/(gold|silver|bronze)/.test(headerBlob)) score += 12;

  let schools = 0;
  let placements = 0;
  for (const row of grid.rows) {
    if (row.some((cell) => matchSchoolCode(cell))) schools += 1;
    if (row.some((cell) => parsePlacementLabel(cell))) placements += 1;
  }
  score += schools * 6;
  score += placements * 4;
  if (schools === 0 && placements === 0) score -= 20;
  return score;
}

export function detectColumnPreset(headers: string[] | null): UAAPColumnPreset | null {
  if (!headers || headers.length === 0) return null;
  const headerStrs = headers.map((h) => stripMarkup(h).toLowerCase());
  const hasW = headerStrs.some((h) => /^(w|win|wins)$/i.test(h));
  const hasL = headerStrs.some((h) => /^(l|loss|losses)$/i.test(h));
  const hasPts = headerStrs.some((h) => /^(pts|points|total points)$/i.test(h));
  const hasMedals = headerStrs.some((h) => /^(gold|silver|bronze)$/i.test(h));
  const hasRecord = headerStrs.some((h) => /^(record|w-l|w\/l)$/i.test(h));

  if ((hasW && hasL && hasPts) || (hasRecord && hasPts)) {
    return COLUMN_PRESETS.find((p) => p.id === "win-loss-points") ?? null;
  }
  if ((hasW && hasL) || hasRecord) {
    return COLUMN_PRESETS.find((p) => p.id === "win-loss") ?? null;
  }
  if (hasPts) {
    return COLUMN_PRESETS.find((p) => p.id === "points") ?? null;
  }
  if (hasMedals) {
    return COLUMN_PRESETS.find((p) => p.id === "medals") ?? null;
  }
  return null;
}

function headingish(line: string): boolean {
  const trimmed = line.trim();
  if (trimmed.startsWith("#")) return true;
  const plain = stripMarkup(trimmed);
  if (plain.length === 0 || plain.length > 80) return false;
  return /(division|men|women|junior|college|boys|girls)/i.test(plain);
}

function matchDivisionHeading(line: string): string | null {
  const plain = stripMarkup(line).toLowerCase();
  if (/\b(boys)\b/.test(plain)) return "Boys";
  if (/\b(girls)\b/.test(plain)) return "Girls";
  if (/\b(junior)/.test(plain)) return "Juniors";
  if (/\b(women)/.test(plain)) return "Women's";
  if (/\b(men)/.test(plain) && !/\bwomen/.test(plain)) return "Men's";
  if (/\b(college|collegiate)\b/.test(plain)) return "Collegiate";
  return null;
}

export function sliceReportForDivision(text: string, division: string): { text: string; sliced: boolean } {
  const wanted = normalizeDivision(division);
  const lines = text.split(/\r?\n/);
  const marks: { i: number; div: string }[] = [];

  for (let i = 0; i < lines.length; i += 1) {
    if (!headingish(lines[i])) continue;
    const div = matchDivisionHeading(lines[i]);
    if (div) marks.push({ i, div });
  }

  if (marks.length === 0) return { text, sliced: false };
  const start = marks.find((m) => normalizeDivision(m.div) === wanted);
  if (!start) return { text, sliced: false };
  const next = marks.find(
    (m) => m.i > start.i && normalizeDivision(m.div) !== normalizeDivision(start.div)
  );
  return {
    text: lines.slice(start.i, next ? next.i : lines.length).join("\n"),
    sliced: true,
  };
}

function parsePlayerSchool(raw: string): { player: string; school: string } | null {
  const cleaned = stripMarkup(raw);
  if (!cleaned) return null;

  const dash = cleaned.match(/^(.{2,80}?)\s*[-–—]\s*(.{2,40})$/);
  if (dash) {
    const school = matchSchoolCode(dash[2]) ?? dash[2].trim();
    return { player: dash[1].trim(), school };
  }

  const paren = cleaned.match(/^(.{2,80}?)\s*\(([^)]+)\)$/);
  if (paren) {
    const school = matchSchoolCode(paren[2]) ?? paren[2].trim();
    return { player: paren[1].trim(), school };
  }

  return null;
}

export function extractAwardsFromText(text: string): ExtractedAwards {
  const rawLines = text.split(/\r?\n/);
  const lines = rawLines.map((l) => stripMarkup(l));
  let mvp: ExtractedAwards["mvp"] = null;
  let roy: ExtractedAwards["rookie_of_the_year"] = null;

  const fromMarkdownRow = (line: string): { player: string; school: string } | null => {
    const cells = line
      .split("|")
      .map((c) => stripMarkup(c))
      .filter((c) => c && c !== ":");
    if (cells.length < 2) return null;
    const rest = cells.slice(1).join(" ");
    return parsePlayerSchool(rest) ?? parsePlayerSchool(cells[1] + (cells[2] ? ` (${cells[2]})` : ""));
  };

  const takeFollowing = (from: number): { player: string; school: string } | null => {
    for (let i = from + 1; i < Math.min(from + 6, lines.length); i += 1) {
      const line = lines[i];
      if (!line) continue;
      if (/most valuable|rookie of the year|individual awards|final standing/i.test(line)) {
        return null;
      }
      const parsed = parsePlayerSchool(line) ?? fromMarkdownRow(rawLines[i] ?? "");
      if (parsed) return parsed;
    }
    return null;
  };

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    if (!line) continue;
    const upper = line.toUpperCase();
    const raw = rawLines[i] ?? "";

    if (!mvp && /MOST VALUABLE PLAYER|\bMVP\b/.test(upper)) {
      const inline =
        parsePlayerSchool(line.replace(/.*(?:most valuable player|mvp)\s*[:\-–—]?\s*/i, "")) ??
        fromMarkdownRow(raw);
      mvp = inline ?? takeFollowing(i);
    }

    if (!roy && /ROOKIE OF THE YEAR/.test(upper)) {
      const inline =
        parsePlayerSchool(line.replace(/.*rookie of the year\s*[:\-–—]?\s*/i, "")) ??
        fromMarkdownRow(raw);
      roy = inline ?? takeFollowing(i);
    }
  }

  return { mvp, rookie_of_the_year: roy };
}

function pickBestGrid(text: string): ParsedGrid | null {
  const markdown = parseMarkdownTables(text);
  let best: { grid: ParsedGrid; score: number } | null = null;
  for (const grid of markdown) {
    const score = scoreStandingsGrid(grid);
    if (!best || score > best.score) best = { grid, score };
  }
  if (best && best.score >= 8) return best.grid;

  const placement = parsePlacementLines(text);
  if (placement && scoreStandingsGrid(placement) >= 8) return placement;
  return best && best.score > 0 ? best.grid : null;
}

export function extractStandingsFromReport(
  text: string,
  division?: string
): ReportExtract {
  const sliced = division ? sliceReportForDivision(text, division) : { text, sliced: false };
  const source = sliced.text;
  const grid = pickBestGrid(source);
  const awards = extractAwardsFromText(source);

  if (!grid) {
    return {
      paste: source.trim(),
      delimiterLabel: "raw report text (parse after trimming)",
      awards,
      tableCount: parseMarkdownTables(source).length,
      usedDivisionSlice: sliced.sliced,
    };
  }

  return {
    paste: gridToTsv(grid),
    delimiterLabel: grid.delimiterLabel,
    awards,
    tableCount: parseMarkdownTables(source).length,
    usedDivisionSlice: sliced.sliced,
  };
}

export function unmatchedSchoolLabels(rows: UAAPRow[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const row of rows) {
    const label = (row.team || "").trim();
    if (!label || matchSchoolCode(label) || seen.has(label)) continue;
    seen.add(label);
    out.push(label);
  }
  return out;
}

export function parsePastedTable(text: string): ParsedGrid {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l !== "");

  if (lines.length === 0) {
    return { headers: null, rows: [], delimiterLabel: "no content" };
  }

  const structured = pickBestGrid(text);
  if (structured) return structured;

  const { delimiter, label } = detectDelimiter(lines);
  const grid = lines
    .filter((line) => !isMarkdownSeparator(line))
    .map((line) => {
      const cells = isMarkdownRow(line)
        ? splitMarkdownRow(line)
        : splitLine(line, delimiter);
      return delimiter === "space" ? coalesceSchoolCells(cells) : cells;
    })
    .filter((cells) => cells.length > 0 && cells.some((c) => c !== ""));

  const normalized = grid.map((cells) =>
    cells.map((cell, idx) => (idx === 0 ? cell.replace(/^(\d{1,2})[.)]$/, "$1") : cell))
  );

  const padded = padGrid(normalized);

  if (padded.length > 1 && looksLikeHeader(padded[0])) {
    return { headers: padded[0], rows: padded.slice(1), delimiterLabel: label };
  }

  return { headers: null, rows: padded, delimiterLabel: label };
}

const HEADER_ALIASES: Array<[RegExp, ImportTargetKind | "wins" | "losses" | "points" | "gold" | "silver" | "bronze"]> = [
  [/^(rank|no\.?|pos|place|placing|final rank)$/i, "rank"],
  [/^(team|school|teams?|university|name)$/i, "team"],
  [/^(record|w-l|w\/l)$/i, "record"],
  [/^(notes?|result|details|remarks?|finish)$/i, "details"],
  [/^(gp|games|g|played)$/i, "ignore"],
  [/^(w|win|wins)$/i, "wins"],
  [/^(l|loss|losses)$/i, "losses"],
  [/^(pts|points|total points|mp)$/i, "points"],
  [/^(gold)$/i, "gold"],
  [/^(silver)$/i, "silver"],
  [/^(bronze)$/i, "bronze"],
];

/**
 * Pre-selects a mapping for each parsed column. Header names win when present;
 * otherwise the shape of the sample values is used.
 */
export function guessTargets(grid: ParsedGrid, columns: UAAPColumn[]): ImportTarget[] {
  const width = grid.headers?.length ?? (grid.rows[0]?.length || 0);
  const enterable = columns.filter((c) => !c.derived);
  const targets: ImportTarget[] = new Array(width).fill(null).map(() => ({ kind: "ignore" }));
  const usedColumnKeys = new Set<string>();
  let teamAssigned = false;
  let rankAssigned = false;

  const columnValues = (idx: number) => grid.rows.map((r) => r[idx] ?? "").filter((v) => v !== "");

  const assignColumn = (i: number, key: string) => {
    const matched = enterable.find((c) => !usedColumnKeys.has(c.key) && c.key === key);
    if (!matched) return false;
    usedColumnKeys.add(matched.key);
    targets[i] = { kind: "column", columnKey: matched.key };
    return true;
  };

  for (let i = 0; i < width; i += 1) {
    const header = grid.headers?.[i]?.trim() ?? "";
    const values = columnValues(i);

    if (values.length > 0 && values.every((v) => v === ":" || v === "-" || v === "–")) {
      targets[i] = { kind: "ignore" };
      continue;
    }

    if (header) {
      const alias = HEADER_ALIASES.find(([pattern]) => pattern.test(header));
      if (alias) {
        const kind = alias[1];
        if (kind === "team" && !teamAssigned) {
          teamAssigned = true;
          targets[i] = { kind: "team" };
          continue;
        }
        if (kind === "rank" && !rankAssigned) {
          rankAssigned = true;
          targets[i] = { kind: "rank" };
          continue;
        }
        if (kind === "record" || kind === "details" || kind === "ignore") {
          targets[i] = { kind };
          continue;
        }
        if (kind === "wins" || kind === "losses" || kind === "points" || kind === "gold" || kind === "silver" || kind === "bronze") {
          if (assignColumn(i, kind)) continue;
        }
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

    if (values.every((v) => parsePlacementLabel(v))) {
      targets[i] = { kind: "details" };
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
        case "details": {
          const placement = parsePlacementLabel(raw);
          details = placement?.label ?? raw;
          if (rank === null && placement) rank = placement.rank;
          break;
        }
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
