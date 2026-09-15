import fs from "fs/promises";
import path from "path";
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

function getDataPaths() {
  return {
    standingsPath: path.join(process.cwd(), "data", "uaap_standings.json"),
    extrasPath: path.join(process.cwd(), "data", "uaap_archive_extras.json"),
    overridesPath: path.join(process.cwd(), "data", "uaap_admin_overrides.json"),
  };
}

/**
 * Vercel serves the deployment bundle from a read-only /var/task, so disk
 * writes are a local-development convenience only. Supabase is the source of
 * truth; a failed write here must never fail the save.
 */
async function safeWriteFile(filePath: string, content: string): Promise<void> {
  try {
    await fs.writeFile(filePath, content, "utf-8");
  } catch (err) {
    const code = (err as NodeJS.ErrnoException)?.code;
    const message = err instanceof Error ? err.message : String(err);
    if (code === "EROFS" || code === "EACCES" || message.includes("read-only")) {
      return;
    }
    console.warn(`[UAAP Data] File write skipped (${filePath}):`, message);
  }
}

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
    extras_overrides: r.extras_overrides || { awards: {}, chess_medalists: {} },
  };
}

export async function readAdminOverrides(): Promise<UAAPAdminOverrides> {
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

  const { overridesPath } = getDataPaths();
  try {
    return coerceOverrides(JSON.parse(await fs.readFile(overridesPath, "utf-8")));
  } catch {
    return emptyOverrides();
  }
}

async function persistOverrides(overrides: UAAPAdminOverrides): Promise<string | null> {
  let supabaseError: string | null = null;

  // Overrides are admin-authored content, so they need the service-role client
  // to get past row-level security. Never fall back to the anon key — those
  // writes look successful then vanish under RLS.
  const db = getServiceSupabase();

  if (db) {
    try {
      const { error } = await db.from("uaap_overrides").upsert({
        id: OVERRIDES_ROW_ID,
        payload: overrides,
        updated_at: new Date().toISOString(),
      });

      if (error) {
        supabaseError = error.message;
        console.error("[UAAP Data] Override persist failed:", error.message);
      }
    } catch (err) {
      supabaseError = err instanceof Error ? err.message : "Unknown Supabase error";
      console.error("[UAAP Data] Override persist threw:", err);
    }
  } else {
    supabaseError =
      "Supabase service role is not configured (missing SUPABASE_SERVICE_ROLE_KEY). Archive saves will not persist in production.";
  }

  const { overridesPath } = getDataPaths();
  await safeWriteFile(overridesPath, JSON.stringify(overrides, null, 2));

  return supabaseError;
}

export async function readBaseStandings(): Promise<LegacyStandingRecord[]> {
  const { standingsPath } = getDataPaths();
  try {
    const parsed = JSON.parse(await fs.readFile(standingsPath, "utf-8"));
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export async function readBaseExtras(): Promise<UAAPArchiveExtras> {
  const { extrasPath } = getDataPaths();
  try {
    return JSON.parse(await fs.readFile(extrasPath, "utf-8"));
  } catch {
    return { awards: {}, games: {}, chess_medalists: {}, leaderboards: {} };
  }
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

  return { tables, extras: mergedExtras, seasons };
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
  success: boolean;
  error?: string;
  warning?: string;
  count?: number;
  data?: MergedUAAPData;
}> {
  const { table, awards, chess_medalists } = payload;

  if (!table?.season?.trim() || !table?.sport?.trim() || !table?.division?.trim()) {
    return { success: false, error: "Season, sport, and division are all required." };
  }

  try {
    const clean = sanitizeTable(table);
    const divisionKey = makeDivisionKey(clean.season, clean.sport, clean.division);
    const overrides = await readAdminOverrides();

    overrides.updated_at = new Date().toISOString();
    overrides.tables_overrides[divisionKey] = clean;
    // The table override supersedes any pre-flexible-column entry for this key.
    delete overrides.standings_overrides[divisionKey];
    overrides.deleted_divisions = overrides.deleted_divisions.filter(
      (k) => k.toLowerCase() !== divisionKey.toLowerCase()
    );

    const extrasKey = makeExtrasKey(clean.sport, clean.season);
    if (awards !== undefined) {
      overrides.extras_overrides.awards ||= {};
      overrides.extras_overrides.awards[extrasKey] ||= {};
      if (awards === null) {
        delete overrides.extras_overrides.awards[extrasKey][clean.division];
      } else {
        overrides.extras_overrides.awards[extrasKey][clean.division] = awards;
      }
    }
    if (chess_medalists !== undefined) {
      overrides.extras_overrides.chess_medalists ||= {};
      overrides.extras_overrides.chess_medalists[extrasKey] ||= {};
      if (chess_medalists === null || Object.keys(chess_medalists).length === 0) {
        delete overrides.extras_overrides.chess_medalists[extrasKey][clean.division];
      } else {
        overrides.extras_overrides.chess_medalists[extrasKey][clean.division] = chess_medalists;
      }
    }

    const supabaseError = await persistOverrides(overrides);
    const data = await getMergedUAAPData();

    return {
      success: true,
      count: clean.rows.length,
      data,
      ...(supabaseError
        ? { warning: `Saved locally but the database rejected the write: ${supabaseError}` }
        : {}),
    };
  } catch (err: any) {
    console.error("[saveUAAPAdminOverride] error:", err);
    return { success: false, error: err?.message || "Failed to save archive data." };
  }
}

export async function deleteUAAPAdminDivision(
  season: string,
  sport: string,
  division: string
): Promise<{ success: boolean; error?: string; warning?: string; data?: MergedUAAPData }> {
  try {
    const divisionKey = makeDivisionKey(season, sport, division);
    const overrides = await readAdminOverrides();

    overrides.updated_at = new Date().toISOString();
    delete overrides.tables_overrides[divisionKey];
    delete overrides.standings_overrides[divisionKey];

    if (!overrides.deleted_divisions.some((k) => k.toLowerCase() === divisionKey.toLowerCase())) {
      overrides.deleted_divisions.push(divisionKey);
    }

    const supabaseError = await persistOverrides(overrides);
    const data = await getMergedUAAPData();

    return {
      success: true,
      data,
      ...(supabaseError
        ? { warning: `Deleted locally but the database rejected the write: ${supabaseError}` }
        : {}),
    };
  } catch (err: any) {
    console.error("[deleteUAAPAdminDivision] error:", err);
    return { success: false, error: err?.message || "Failed to delete division." };
  }
}
