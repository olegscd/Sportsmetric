/**
 * Shared UAAP archive types and helpers.
 *
 * This module is imported by both server code (lib/uaap-data.ts) and client
 * components, so it must stay free of `fs`, `path`, and Supabase imports.
 *
 * Historical UAAP records are wildly inconsistent between seasons: some years
 * report win-loss records, some report cumulative points, some only report
 * placements, and some report medal tallies. Rather than force every era into
 * one fixed set of columns, a table carries its own column definitions.
 */

export type UAAPColumnType = "number" | "decimal" | "text";

export interface UAAPColumn {
  /** Stable identifier used as the key in `UAAPRow.values`. */
  key: string;
  label: string;
  type: UAAPColumnType;
  /**
   * Marks a column as calculated rather than entered. Derived columns are
   * read-only in the admin editor and recomputed on every render.
   */
  derived?: { kind: "winPct"; wins: string; losses: string };
}

export interface UAAPRow {
  rank: number;
  team: string;
  values: Record<string, string | number | null>;
  details: string | null;
}

export interface UAAPTable {
  season: string;
  sport: string;
  division: string;
  stage: string;
  columns: UAAPColumn[];
  rows: UAAPRow[];
  note: string | null;
  source_page: string;
}

/** Flat record shape used by the original data/uaap_standings.json dataset. */
export interface LegacyStandingRecord {
  season: string;
  sport: string;
  division: string;
  stage: string;
  rank: number;
  team: string;
  wins: number | null;
  losses: number | null;
  pct: number | null;
  points?: number | null;
  details: string | null;
  source_page: string;
}

export interface UAAPArchiveExtras {
  awards?: Record<string, Record<string, any>>;
  chess_medalists?: Record<string, Record<string, any>>;
  games?: Record<string, any>;
  leaderboards?: Record<string, any>;
}

export interface MergedUAAPData {
  tables: UAAPTable[];
  extras: UAAPArchiveExtras;
  seasons: string[];
}

export const DEFAULT_STAGE = "Final Standings";
export const MANUAL_SOURCE = "Manual Entry / Curated (Admin)";

// ---------------------------------------------------------------------------
// Column presets
// ---------------------------------------------------------------------------

export const WIN_PCT_COLUMN: UAAPColumn = {
  key: "pct",
  label: "PCT",
  type: "decimal",
  derived: { kind: "winPct", wins: "wins", losses: "losses" },
};

export interface UAAPColumnPreset {
  id: string;
  label: string;
  description: string;
  columns: UAAPColumn[];
}

export const COLUMN_PRESETS: UAAPColumnPreset[] = [
  {
    id: "win-loss",
    label: "Win – Loss",
    description: "Wins, losses, and an auto-calculated win percentage.",
    columns: [
      { key: "wins", label: "W", type: "number" },
      { key: "losses", label: "L", type: "number" },
      WIN_PCT_COLUMN,
    ],
  },
  {
    id: "points",
    label: "Points Total",
    description: "A single cumulative points column, as used by the General Championship.",
    columns: [{ key: "points", label: "PTS", type: "number" }],
  },
  {
    id: "win-loss-points",
    label: "Win – Loss + Points",
    description: "Win-loss record alongside a separate points tally.",
    columns: [
      { key: "wins", label: "W", type: "number" },
      { key: "losses", label: "L", type: "number" },
      WIN_PCT_COLUMN,
      { key: "points", label: "PTS", type: "number" },
    ],
  },
  {
    id: "medals",
    label: "Medal Tally",
    description: "Gold, silver, and bronze counts for individual-event sports.",
    columns: [
      { key: "gold", label: "Gold", type: "number" },
      { key: "silver", label: "Silver", type: "number" },
      { key: "bronze", label: "Bronze", type: "number" },
    ],
  },
  {
    id: "placement",
    label: "Placement Only",
    description: "Just rank, school, and a result note. For years with no numeric records.",
    columns: [],
  },
];

// ---------------------------------------------------------------------------
// Keys and normalisation
// ---------------------------------------------------------------------------

/** Older exports use "Junior" where newer ones use "Juniors". */
const DIVISION_ALIASES: Record<string, string> = {
  junior: "Juniors",
  juniors: "Juniors",
  men: "Men's",
  "men's": "Men's",
  mens: "Men's",
  women: "Women's",
  "women's": "Women's",
  womens: "Women's",
};

export function normalizeDivision(division: string): string {
  const trimmed = (division || "").trim();
  return DIVISION_ALIASES[trimmed.toLowerCase()] ?? trimmed;
}

export function makeDivisionKey(season: string, sport: string, division: string): string {
  return `${season.trim()}|${sport.trim()}|${normalizeDivision(division)}`;
}

export function makeExtrasKey(sport: string, season: string): string {
  return `${sport.trim()}|${season.trim()}`;
}

/** Turns a column label into a safe, unique `values` key. */
export function slugifyColumnKey(label: string, taken: string[] = []): string {
  const base =
    label
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "") || "column";

  if (!taken.includes(base)) return base;

  let n = 2;
  while (taken.includes(`${base}_${n}`)) n += 1;
  return `${base}_${n}`;
}

// ---------------------------------------------------------------------------
// Values
// ---------------------------------------------------------------------------

export function toNumberOrNull(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const n = typeof value === "number" ? value : Number(String(value).trim());
  return Number.isFinite(n) ? n : null;
}

/**
 * Resolves a cell, computing derived columns on the fly so that stored rows
 * never hold stale calculated values.
 */
export function resolveCellValue(
  row: UAAPRow,
  column: UAAPColumn
): string | number | null {
  if (column.derived?.kind === "winPct") {
    const w = toNumberOrNull(row.values[column.derived.wins]);
    const l = toNumberOrNull(row.values[column.derived.losses]);
    if (w === null || l === null || w + l === 0) return null;
    return Number((w / (w + l)).toFixed(3));
  }
  const raw = row.values[column.key];
  if (raw === undefined) return null;
  return raw;
}

export function formatCellValue(
  row: UAAPRow,
  column: UAAPColumn
): string {
  const value = resolveCellValue(row, column);
  if (value === null || value === "") return "—";
  if (column.type === "decimal" && typeof value === "number") {
    return value.toFixed(3);
  }
  return String(value);
}

export function createEmptyRow(rank: number, team = ""): UAAPRow {
  return { rank, team, values: {}, details: null };
}

export function createEmptyTable(
  season: string,
  sport: string,
  division: string,
  columns: UAAPColumn[] = []
): UAAPTable {
  return {
    season,
    sport,
    division: normalizeDivision(division),
    stage: DEFAULT_STAGE,
    columns: columns.map((c) => ({ ...c })),
    rows: [],
    note: null,
    source_page: MANUAL_SOURCE,
  };
}

// ---------------------------------------------------------------------------
// Legacy conversion
// ---------------------------------------------------------------------------

/**
 * Infers a column set from a group of flat legacy records, keeping only the
 * columns that era actually populated.
 */
export function legacyRecordsToTable(records: LegacyStandingRecord[]): UAAPTable {
  const first = records[0];
  const hasWinLoss = records.some((r) => r.wins !== null || r.losses !== null);
  const hasPoints = records.some((r) => r.points !== null && r.points !== undefined);

  const columns: UAAPColumn[] = [];
  if (hasWinLoss) {
    columns.push({ key: "wins", label: "W", type: "number" });
    columns.push({ key: "losses", label: "L", type: "number" });
    columns.push(WIN_PCT_COLUMN);
  }
  if (hasPoints) {
    columns.push({ key: "points", label: "PTS", type: "number" });
  }

  const rows: UAAPRow[] = records
    .slice()
    .sort((a, b) => (a.rank || 0) - (b.rank || 0))
    .map((r, idx) => {
      const values: Record<string, string | number | null> = {};
      if (hasWinLoss) {
        values.wins = r.wins;
        values.losses = r.losses;
      }
      if (hasPoints) {
        values.points = r.points ?? null;
      }
      return {
        rank: r.rank || idx + 1,
        team: r.team,
        values,
        details: r.details,
      };
    });

  return {
    season: first.season,
    sport: first.sport,
    division: normalizeDivision(first.division),
    stage: first.stage || DEFAULT_STAGE,
    columns,
    rows,
    note: null,
    source_page: first.source_page || "UAAP Annual Report",
  };
}

/** Groups the flat legacy dataset into one table per season/sport/division. */
export function legacyRecordsToTables(records: LegacyStandingRecord[]): UAAPTable[] {
  const groups = new Map<string, LegacyStandingRecord[]>();

  for (const record of records) {
    if (!record?.season || !record?.sport || !record?.division) continue;
    const key = makeDivisionKey(record.season, record.sport, record.division);
    const bucket = groups.get(key);
    if (bucket) {
      bucket.push(record);
    } else {
      groups.set(key, [record]);
    }
  }

  return Array.from(groups.values()).map(legacyRecordsToTable);
}

// ---------------------------------------------------------------------------
// Chess medalists normalisation
// ---------------------------------------------------------------------------

export interface ChessMedalist {
  medal: "gold" | "silver" | "bronze" | null;
  player: string;
  school: string;
}

/**
 * The base dataset stores chess medalists as a flat list per division while the
 * admin panel writes a board-keyed map. Normalises both into board -> medalists
 * so the display never renders "Board 0" from an array index.
 */
export function normalizeChessMedalists(
  raw: unknown
): Record<string, ChessMedalist[]> | null {
  if (!raw || typeof raw !== "object") return null;

  if (Array.isArray(raw)) {
    const list = raw
      .filter((m): m is Record<string, any> => !!m && typeof m === "object")
      .map((m, idx) => ({
        medal: (m.medal as ChessMedalist["medal"]) ?? null,
        player: String(m.player ?? m.name ?? ""),
        school: String(m.school ?? ""),
        board: m.board ? String(m.board) : String(idx + 1),
      }));

    const grouped: Record<string, ChessMedalist[]> = {};
    for (const entry of list) {
      const { board, ...medalist } = entry;
      (grouped[board] ||= []).push(medalist);
    }
    return Object.keys(grouped).length > 0 ? grouped : null;
  }

  const result: Record<string, ChessMedalist[]> = {};
  for (const [board, value] of Object.entries(raw as Record<string, unknown>)) {
    if (!Array.isArray(value)) continue;
    result[board] = value
      .filter((m): m is Record<string, any> => !!m && typeof m === "object")
      .map((m) => ({
        medal: (m.medal as ChessMedalist["medal"]) ?? null,
        player: String(m.player ?? m.name ?? ""),
        school: String(m.school ?? ""),
      }));
  }
  return Object.keys(result).length > 0 ? result : null;
}
