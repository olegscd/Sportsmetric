import fs from "fs/promises";
import baseStandingsData from "@/data/uaap_standings.json";
import baseExtrasData from "@/data/uaap_archive_extras.json";
import { supabase } from "@/lib/supabase";
import { getServiceSupabase } from "@/lib/supabase-admin";
import {
  DEFAULT_STAGE,
  MANUAL_SOURCE,
  legacyRecordsToTable,
  legacyRecordsToTables,
  makeDivisionKey,
  makeExtrasKey,
  normalizeDivision,
  toNumberOrNull,
  type LegacyStandingRecord,
  type MergedUAAPData,
  type UAAPArchiveExtras,
  type UAAPColumn,
  type UAAPRow,
  type UAAPTable,
} from "@/lib/uaap-schema";

export type {
  LegacyStandingRecord,
  MergedUAAPData,
  UAAPArchiveExtras,
  UAAPColumn,
  UAAPRow,
  UAAPTable,
} from "@/lib/uaap-schema";

export interface UAAPSavePayload {
  expectedVersion: number;
  table: UAAPTable;
  awards?: {
    mvp?: { player: string; school: string } | null;
    rookie_of_the_year?: { player: string; school: string } | null;
    mythical_five?: Array<{ player: string; school: string; position?: string }> | null;
  } | null;
  chess_medalists?: Record<
    string,
    Array<{ medal: "gold" | "silver" | "bronze"; player: string; school: string }>
  > | null;
}

export interface UAAPAdminOverrides {
  divisionVersions?: Record<string, number>;
  updated_at: string;
  /** Current format: one fully described table per division key. */
  tables_overrides: Record<string, UAAPTable>;
  /** Pre-flexible-column format, still read so older saves are not lost. */
  standings_overrides: Record<string, LegacyStandingRecord[]>;
  deleted_divisions: string[];
  extras_overrides: {
    awards: Record<string, Record<string, unknown>>;
    chess_medalists: Record<string, Record<string, unknown>>;
  };
}

/** Row id in the dedicated `uaap_overrides` table. */
const OVERRIDES_ROW_ID = "default";

/**
 * Overrides used to live in a fake `teams` row. That table gets wiped by the
 * seed script, so they now have their own table; this id is still read once so
 * existing deployments do not lose data before the migration is applied.
 */
const LEGACY_OVERRIDES_TEAM_ROW_ID = "__uaap_archive_overrides__";

/**
 * Read-only legacy fallback. All new writes use versioned division rows.
 * A literal relative path keeps the bundler from tracing the project root.
 */
const OVERRIDES_PATH = "data/uaap_admin_overrides.json";

function emptyOverrides(): UAAPAdminOverrides {
  return {
    updated_at: new Date().toISOString(),
    tables_overrides: {},
    standings_overrides: {},
    deleted_divisions: [],
    extras_overrides: { awards: {}, chess_medalists: {} },
  };
}

function coerceOverrides(raw: unknown): UAAPAdminOverrides {
  const r = (raw ?? {}) as Partial<UAAPAdminOverrides>;
  return {
    updated_at: r.updated_at || new Date().toISOString(),
    tables_overrides: r.tables_overrides || {},
    standings_overrides: r.standings_overrides || {},
    deleted_divisions: r.deleted_divisions || [],
    extras_overrides: {
      awards: r.extras_overrides?.awards ?? {},
      chess_medalists: r.extras_overrides?.chess_medalists ?? {},
    },
  };
}

async function readLegacyAdminOverrides(): Promise<UAAPAdminOverrides> {
  if (supabase) {
    try {
      const { data, error } = await supabase
        .from("uaap_overrides")
        .select("payload")
        .eq("id", OVERRIDES_ROW_ID)
        .maybeSingle();

      if (!error && data?.payload) {
        return coerceOverrides(data.payload);
      }
      if (error) {
        console.warn("[UAAP Data] Override read failed:", error.message);
      }
    } catch (err) {
      console.warn("[UAAP Data] Override read threw:", err);
    }

    // Fall back to the pre-migration sentinel row.
    try {
      const { data } = await supabase
        .from("teams")
        .select("record")
        .eq("id", LEGACY_OVERRIDES_TEAM_ROW_ID)
        .maybeSingle();

      if (data?.record) return coerceOverrides(data.record);
    } catch {
      // Ignore: the legacy row is optional.
    }
  }

  try {
    return coerceOverrides(JSON.parse(await fs.readFile(OVERRIDES_PATH, "utf-8")));
  } catch {
    return emptyOverrides();
  }
}

export async function readAdminOverrides(): Promise<UAAPAdminOverrides> {
  const overrides = await readLegacyAdminOverrides();
  overrides.divisionVersions = {};
  if (!supabase) return overrides;
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase.from("uaap_division_overrides")
      .select("season,sport,division,payload,version")
      .order("season").order("sport").order("division").range(from, from + 999);
    if (error?.code === "42P01" || error?.code === "PGRST205") return overrides;
    if (error) throw new Error(`Could not load division overrides: ${error.message}`);
    for (const row of data ?? []) {
      const key = makeDivisionKey(row.season, row.sport, row.division);
      const extrasKey = makeExtrasKey(row.sport, row.season);
      const payload = row.payload as { table?: UAAPTable; standings?: LegacyStandingRecord[];
        deleted?: boolean; awards?: unknown; chess_medalists?: unknown };
      overrides.divisionVersions[key] = row.version;
      delete overrides.tables_overrides[key];
      delete overrides.standings_overrides[key];
      overrides.deleted_divisions = overrides.deleted_divisions.filter(k => k !== key);
      if (payload.deleted) overrides.deleted_divisions.push(key);
      else if (payload.table) overrides.tables_overrides[key] = payload.table;
      else if (payload.standings) overrides.standings_overrides[key] = payload.standings;
      for (const kind of ["awards", "chess_medalists"] as const) {
        if (Object.hasOwn(payload, kind)) {
          overrides.extras_overrides[kind][extrasKey] ||= {};
          overrides.extras_overrides[kind][extrasKey][row.division] = payload[kind];
        }
      }
    }
    if (!data || data.length < 1000) break;
  }
  return overrides;
}

async function persistDivision(season: string, sport: string, division: string,
  changes: Record<string, unknown>, expectedVersion: number): Promise<void> {
  if (!Number.isInteger(expectedVersion) || expectedVersion < 0) {
    throw new Error("Reload the archive before saving (missing division version).");
  }
  const db = getServiceSupabase();
  if (!db) throw new Error("Supabase service role is required for archive saves.");
  const { error } = await db.rpc("save_uaap_division", {
    target_season: season, target_sport: sport, target_division: normalizeDivision(division),
    changes, expected_version: expectedVersion,
  });
  if (error) throw new Error(error.message);
}

export async function readBaseStandings(): Promise<LegacyStandingRecord[]> {
  return baseStandingsData as unknown as LegacyStandingRecord[];
}

export async function readBaseExtras(): Promise<UAAPArchiveExtras> {
  return baseExtrasData as unknown as UAAPArchiveExtras;
}

/**
 * Builds the archive by layering admin overrides on top of the digitised base
 * dataset. Precedence, lowest to highest: base records, legacy overrides,
 * table overrides. Deleted divisions win over everything.
 */
export function mergeUAAPData(
  baseStandings: LegacyStandingRecord[],
  baseExtras: UAAPArchiveExtras,
  overrides: UAAPAdminOverrides
): MergedUAAPData {
  const byKey = new Map<string, UAAPTable>();

  for (const table of legacyRecordsToTables(baseStandings)) {
    byKey.set(makeDivisionKey(table.season, table.sport, table.division), table);
  }

  for (const [key, records] of Object.entries(overrides.standings_overrides || {})) {
    if (!Array.isArray(records) || records.length === 0) continue;
    byKey.set(key, legacyRecordsToTable(records));
  }

  for (const [key, table] of Object.entries(overrides.tables_overrides || {})) {
    if (!table) continue;
    byKey.set(key, {
      ...table,
      division: normalizeDivision(table.division),
      columns: table.columns || [],
      rows: table.rows || [],
    });
  }

  for (const key of overrides.deleted_divisions || []) {
    byKey.delete(key);
  }

  const tables = Array.from(byKey.values()).sort(
    (a, b) =>
      b.season.localeCompare(a.season) ||
      a.sport.localeCompare(b.sport) ||
      a.division.localeCompare(b.division)
  );

  const mergedExtras: UAAPArchiveExtras = {
    ...baseExtras,
    awards: { ...(baseExtras.awards || {}) },
    chess_medalists: { ...(baseExtras.chess_medalists || {}) },
  };

  for (const [extrasKey, divMap] of Object.entries(overrides.extras_overrides?.awards || {})) {
    mergedExtras.awards![extrasKey] = { ...(mergedExtras.awards![extrasKey] || {}), ...divMap };
  }

  for (const [extrasKey, divMap] of Object.entries(
    overrides.extras_overrides?.chess_medalists || {}
  )) {
    mergedExtras.chess_medalists![extrasKey] = {
      ...(mergedExtras.chess_medalists![extrasKey] || {}),
      ...divMap,
    };
  }

  const seasons = Array.from(new Set(tables.map((t) => t.season).filter(Boolean)))
    .sort()
    .reverse();

  return { tables, extras: mergedExtras, seasons, divisionVersions: overrides.divisionVersions ?? {} };
}

export async function getMergedUAAPData(): Promise<MergedUAAPData> {
  const [baseStandings, baseExtras, overrides] = await Promise.all([
    readBaseStandings(),
    readBaseExtras(),
    readAdminOverrides(),
  ]);
  return mergeUAAPData(baseStandings, baseExtras, overrides);
}

function sanitizeTable(input: UAAPTable): UAAPTable {
  const columns: UAAPColumn[] = (input.columns || []).map((col) => ({
    key: col.key,
    label: col.label,
    type: col.type,
    ...(col.derived ? { derived: col.derived } : {}),
  }));

  const entered = columns.filter((c) => !c.derived);

  const rows: UAAPRow[] = (input.rows || [])
    .filter((row) => (row?.team || "").trim() !== "")
    .map((row, idx) => {
      const values: Record<string, string | number | null> = {};
      for (const col of entered) {
        const raw = row.values?.[col.key];
        values[col.key] = col.type === "text" ? (raw ?? null) : toNumberOrNull(raw);
      }
      const details = (row.details || "").trim();
      return {
        rank: row.rank || idx + 1,
        team: row.team.trim(),
        values,
        details: details || null,
      };
    });

  return {
    season: input.season.trim(),
    sport: input.sport.trim(),
    division: normalizeDivision(input.division),
    stage: (input.stage || DEFAULT_STAGE).trim() || DEFAULT_STAGE,
    columns,
    rows,
    note: (input.note || "").trim() || null,
    source_page: (input.source_page || "").trim() || MANUAL_SOURCE,
  };
}

export async function saveUAAPAdminOverride(payload: UAAPSavePayload): Promise<{
  success: boolean; error?: string; count?: number; data?: MergedUAAPData;
}> {
  try {
    if (!payload.table?.season?.trim() || !payload.table?.sport?.trim() || !payload.table?.division?.trim()) {
      throw new Error("Season, sport, and division are all required.");
    }
    const clean = sanitizeTable(payload.table);
    const changes: Record<string, unknown> = { table: clean, standings: null, deleted: false };
    if (payload.awards !== undefined) changes.awards = payload.awards;
    if (payload.chess_medalists !== undefined) changes.chess_medalists = payload.chess_medalists;
    await persistDivision(clean.season, clean.sport, clean.division, changes, payload.expectedVersion);
    return { success: true, count: clean.rows.length, data: await getMergedUAAPData() };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Archive save failed." };
  }
}

export async function deleteUAAPAdminDivision(
  season: string, sport: string, division: string, expectedVersion: number
): Promise<{ success: boolean; error?: string; data?: MergedUAAPData }> {
  try {
    await persistDivision(season.trim(), sport.trim(), division,
      { deleted: true, table: null, standings: null }, expectedVersion);
    return { success: true, data: await getMergedUAAPData() };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Archive deletion failed." };
  }
}
