import fs from "fs/promises";
import path from "path";
import { supabase } from "@/lib/supabase";
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
    awards: Record<string, Record<string, any>>;
    chess_medalists: Record<string, Record<string, any>>;
  };
}

const OVERRIDES_STORAGE_ROW_ID = "__uaap_archive_overrides__";

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
  } catch (err: any) {
    if (err?.code === "EROFS" || err?.code === "EACCES" || err?.message?.includes("read-only")) {
      return;
    }
    console.warn(`[UAAP Data] File write skipped (${filePath}):`, err?.message);
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

function coerceOverrides(raw: any): UAAPAdminOverrides {
  return {
    updated_at: raw?.updated_at || new Date().toISOString(),
    tables_overrides: raw?.tables_overrides || {},
    standings_overrides: raw?.standings_overrides || {},
    deleted_divisions: raw?.deleted_divisions || [],
    extras_overrides: raw?.extras_overrides || { awards: {}, chess_medalists: {} },
  };
}

export async function readAdminOverrides(): Promise<UAAPAdminOverrides> {
  if (supabase) {
    try {
      const { data, error } = await supabase
        .from("teams")
        .select("record")
        .eq("id", OVERRIDES_STORAGE_ROW_ID)
        .maybeSingle();

      if (!error && data?.record) {
        return coerceOverrides(data.record);
      }
      if (error) {
        console.warn("[UAAP Data] Supabase override read failed:", error.message);
      }
    } catch (err) {
      console.warn("[UAAP Data] Supabase override read threw:", err);
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

  if (supabase) {
    try {
      const seasonRes = await supabase.from("seasons").select("id").limit(1);
      const validSeasonId = seasonRes.data?.[0]?.id || "pvl-2026-on-tour";

      const { error } = await supabase.from("teams").upsert({
        id: OVERRIDES_STORAGE_ROW_ID,
        name: "__UAAP_ARCHIVE_STORAGE__",
        short_name: "UAAP_ARCHIVE",
        logo: null,
        league: "UAAP",
        accent_color: "#000000",
        season_id: validSeasonId,
        record: overrides,
      });

      if (error) {
        supabaseError = error.message;
        console.error("[UAAP Data] Supabase persist failed:", error.message);
      }
    } catch (err: any) {
      supabaseError = err?.message || "Unknown Supabase error";
      console.error("[UAAP Data] Supabase persist threw:", err);
    }
  } else {
    supabaseError = "Supabase is not configured (missing NEXT_PUBLIC_SUPABASE_* env vars).";
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
    if (awards) {
      overrides.extras_overrides.awards ||= {};
      overrides.extras_overrides.awards[extrasKey] ||= {};
      overrides.extras_overrides.awards[extrasKey][clean.division] = awards;
    }
    if (chess_medalists) {
      overrides.extras_overrides.chess_medalists ||= {};
      overrides.extras_overrides.chess_medalists[extrasKey] ||= {};
      overrides.extras_overrides.chess_medalists[extrasKey][clean.division] = chess_medalists;
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
