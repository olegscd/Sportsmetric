import fs from "fs/promises";
import path from "path";
import { supabase } from "@/lib/supabase";

export interface UAAPStandingRecord {
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

export interface UAAPStandingInput {
  rank: number;
  team: string;
  wins?: number | null;
  losses?: number | null;
  pct?: number | null;
  points?: number | null;
  details?: string | null;
}

export type UAAPStandingEntry = UAAPStandingInput;

export interface UAAPSavePayload {
  season: string;
  sport: string;
  division: string;
  standings: UAAPStandingInput[];
  awards?: {
    mvp?: { player: string; school: string } | null;
    rookie_of_the_year?: { player: string; school: string } | null;
    mythical_five?: Array<{ player: string; school: string; position?: string }> | null;
  } | null;
  chess_medalists?: Record<string, Array<{ medal: "gold" | "silver" | "bronze"; player: string; school: string }>> | null;
}

export interface UAAPAdminOverridesFile {
  updated_at: string;
  standings_overrides: Record<string, UAAPStandingRecord[]>;
  deleted_divisions: string[];
  extras_overrides: {
    awards: Record<string, Record<string, any>>;
    chess_medalists: Record<string, Record<string, any>>;
  };
}

export interface MergedUAAPData {
  standings: UAAPStandingRecord[];
  extras: UAAPArchiveExtras;
  seasons: string[];
}

const OVERRIDES_STORAGE_ROW_ID = "__uaap_archive_overrides__";

function getDataPaths() {
  return {
    standingsPath: path.join(process.cwd(), "data", "uaap_standings.json"),
    extrasPath: path.join(process.cwd(), "data", "uaap_archive_extras.json"),
    overridesPath: path.join(process.cwd(), "data", "uaap_admin_overrides.json"),
  };
}

function makeDivisionKey(season: string, sport: string, division: string): string {
  return `${season.trim()}|${sport.trim()}|${division.trim()}`;
}

async function safeWriteFile(filePath: string, content: string): Promise<void> {
  try {
    await fs.writeFile(filePath, content, "utf-8");
  } catch (err: any) {
    // Silently ignore in read-only serverless environment (e.g. Vercel AWS Lambda /var/task)
    if (err.code === "EROFS" || err.message?.includes("read-only")) {
      return;
    }
    console.warn(`[UAAP Data] File write warning (${filePath}):`, err.message);
  }
}

export async function readAdminOverrides(): Promise<UAAPAdminOverridesFile> {
  // 1. Try reading from Supabase first (persistent across serverless instances and redeployments)
  if (supabase) {
    try {
      const { data, error } = await supabase
        .from("teams")
        .select("record")
        .eq("id", OVERRIDES_STORAGE_ROW_ID)
        .maybeSingle();

      if (!error && data?.record?.standings_overrides) {
        return {
          updated_at: data.record.updated_at || new Date().toISOString(),
          standings_overrides: data.record.standings_overrides || {},
          deleted_divisions: data.record.deleted_divisions || [],
          extras_overrides: data.record.extras_overrides || { awards: {}, chess_medalists: {} },
        };
      }
    } catch (err) {
      console.warn("[UAAP Data] Supabase read warning:", err);
    }
  }

  // 2. Fallback to local file system
  const { overridesPath } = getDataPaths();
  try {
    const raw = await fs.readFile(overridesPath, "utf-8");
    const parsed = JSON.parse(raw);
    return {
      updated_at: parsed.updated_at || new Date().toISOString(),
      standings_overrides: parsed.standings_overrides || {},
      deleted_divisions: parsed.deleted_divisions || [],
      extras_overrides: parsed.extras_overrides || { awards: {}, chess_medalists: {} },
    };
  } catch {
    return {
      updated_at: new Date().toISOString(),
      standings_overrides: {},
      deleted_divisions: [],
      extras_overrides: { awards: {}, chess_medalists: {} },
    };
  }
}

export async function readBaseStandings(): Promise<UAAPStandingRecord[]> {
  const { standingsPath } = getDataPaths();
  try {
    const raw = await fs.readFile(standingsPath, "utf-8");
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

export async function readBaseExtras(): Promise<UAAPArchiveExtras> {
  const { extrasPath } = getDataPaths();
  try {
    const raw = await fs.readFile(extrasPath, "utf-8");
    return JSON.parse(raw);
  } catch {
    return { awards: {}, games: {}, chess_medalists: {}, leaderboards: {} };
  }
}

/**
 * Returns merged UAAP Archive dataset where Admin Panel overrides have STRICT TOP PRIORITY.
 */
export async function getMergedUAAPData(): Promise<MergedUAAPData> {
  const [baseStandings, baseExtras, overrides] = await Promise.all([
    readBaseStandings(),
    readBaseExtras(),
    readAdminOverrides(),
  ]);

  const deletedSet = new Set(
    overrides.deleted_divisions.map((k) => k.toLowerCase())
  );

  // 1. Filter out deleted divisions from base
  let mergedStandings = baseStandings.filter((item) => {
    const key = makeDivisionKey(item.season, item.sport, item.division).toLowerCase();
    return !deletedSet.has(key);
  });

  // 2. Apply admin overrides (Admin entries completely replace or create new divisions)
  const overrideEntries = Object.entries(overrides.standings_overrides);
  for (const [key, records] of overrideEntries) {
    if (deletedSet.has(key.toLowerCase())) continue;
    const parts = key.split("|");
    if (parts.length !== 3) continue;
    const [season, sport, division] = parts;

    // Remove any base records matching this season, sport, division
    mergedStandings = mergedStandings.filter(
      (item) =>
        !(
          item.season.toLowerCase() === season.toLowerCase() &&
          item.sport.toLowerCase() === sport.toLowerCase() &&
          item.division.toLowerCase() === division.toLowerCase()
        )
    );

    // Append prioritized admin records
    mergedStandings.push(...records);
  }

  // 3. Merge extras with admin overrides taking top priority
  const mergedExtras: UAAPArchiveExtras = {
    ...baseExtras,
    awards: { ...(baseExtras.awards || {}) },
    chess_medalists: { ...(baseExtras.chess_medalists || {}) },
  };

  if (overrides.extras_overrides?.awards) {
    for (const [sportSeason, divMap] of Object.entries(overrides.extras_overrides.awards)) {
      if (!mergedExtras.awards![sportSeason]) {
        mergedExtras.awards![sportSeason] = {};
      }
      mergedExtras.awards![sportSeason] = {
        ...mergedExtras.awards![sportSeason],
        ...divMap,
      };
    }
  }

  if (overrides.extras_overrides?.chess_medalists) {
    for (const [sportSeason, divMap] of Object.entries(overrides.extras_overrides.chess_medalists)) {
      if (!mergedExtras.chess_medalists![sportSeason]) {
        mergedExtras.chess_medalists![sportSeason] = {};
      }
      mergedExtras.chess_medalists![sportSeason] = {
        ...mergedExtras.chess_medalists![sportSeason],
        ...divMap,
      };
    }
  }

  // 4. Derive distinct sorted seasons
  const seasonSet = new Set<string>();
  for (const item of mergedStandings) {
    if (item.season) seasonSet.add(item.season);
  }
  const defaultSeasons = ["2003-2004", "2000-2001", "1999-2000", "1998-1999", "1989-1990", "1988-1989", "1987-1988"];
  for (const s of defaultSeasons) {
    seasonSet.add(s);
  }
  const seasons = Array.from(seasonSet).sort().reverse();

  return {
    standings: mergedStandings,
    extras: mergedExtras,
    seasons,
  };
}

/**
 * Saves changes made on the Admin Panel.
 * Admin changes take STRICT TOP PRIORITY in overrides and are persisted to Supabase
 * (and safely synced to local disk if writable).
 */
export async function saveUAAPAdminOverride(payload: UAAPSavePayload): Promise<{
  success: boolean;
  error?: string;
  count?: number;
  data?: MergedUAAPData;
}> {
  const { season, sport, division, standings, awards, chess_medalists } = payload;
  if (!season || !sport || !division) {
    return { success: false, error: "Missing required fields (season, sport, or division)." };
  }

  const { standingsPath, extrasPath, overridesPath } = getDataPaths();

  try {
    const divisionKey = makeDivisionKey(season, sport, division);
    const overrides = await readAdminOverrides();

    // Map and sanitize records
    const newRecords: UAAPStandingRecord[] = standings.map((item, idx) => {
      const w = item.wins !== undefined && item.wins !== null && (item.wins as any) !== "" ? Number(item.wins) : null;
      const l = item.losses !== undefined && item.losses !== null && (item.losses as any) !== "" ? Number(item.losses) : null;
      const pts = item.points !== undefined && item.points !== null && (item.points as any) !== "" ? Number(item.points) : null;

      let pct = item.pct ?? null;
      if (w !== null && l !== null && w + l > 0) {
        pct = Number((w / (w + l)).toFixed(3));
      }

      const team = (item.team || "").trim().toUpperCase();
      const details = (item.details || "").trim() || (pts !== null ? `${pts} pts` : null);

      return {
        season: season.trim(),
        sport: sport.trim(),
        division: division.trim(),
        stage: "Final Standings",
        rank: item.rank || idx + 1,
        team,
        wins: w,
        losses: l,
        pct,
        points: pts,
        details,
        source_page: "Manual Entry / Curated (Admin)",
      };
    });

    // 1. Update overrides object
    overrides.updated_at = new Date().toISOString();
    overrides.standings_overrides[divisionKey] = newRecords;
    overrides.deleted_divisions = overrides.deleted_divisions.filter(
      (k) => k.toLowerCase() !== divisionKey.toLowerCase()
    );

    const extrasKey = `${sport}|${season}`;
    if (awards) {
      if (!overrides.extras_overrides.awards) overrides.extras_overrides.awards = {};
      if (!overrides.extras_overrides.awards[extrasKey]) overrides.extras_overrides.awards[extrasKey] = {};
      overrides.extras_overrides.awards[extrasKey][division] = awards;
    }

    if (chess_medalists) {
      if (!overrides.extras_overrides.chess_medalists) overrides.extras_overrides.chess_medalists = {};
      if (!overrides.extras_overrides.chess_medalists[extrasKey]) overrides.extras_overrides.chess_medalists[extrasKey] = {};
      overrides.extras_overrides.chess_medalists[extrasKey][division] = chess_medalists;
    }

    // 2. Persist to Supabase (persistent database across all environments)
    if (supabase) {
      try {
        const seasonRes = await supabase.from("seasons").select("id").limit(1);
        const validSeasonId = seasonRes.data?.[0]?.id || "pvl-2026-on-tour";
        await supabase.from("teams").upsert({
          id: OVERRIDES_STORAGE_ROW_ID,
          name: "__UAAP_ARCHIVE_STORAGE__",
          short_name: "UAAP_ARCHIVE",
          logo: null,
          league: "UAAP",
          accent_color: "#000000",
          season_id: validSeasonId,
          record: overrides,
        });
      } catch (dbErr: any) {
        console.error("[UAAP Data] Supabase persist error:", dbErr);
      }
    }

    // 3. Persist overrides file if local disk is writable (silently bypasses EROFS on Vercel)
    await safeWriteFile(overridesPath, JSON.stringify(overrides, null, 2));

    // 4. Compute full merged dataset
    const mergedData = await getMergedUAAPData();

    // 5. Keep base standings and extras synchronized if disk is writable
    await safeWriteFile(standingsPath, JSON.stringify(mergedData.standings, null, 2));
    await safeWriteFile(extrasPath, JSON.stringify(mergedData.extras, null, 2));

    return {
      success: true,
      count: newRecords.length,
      data: mergedData,
    };
  } catch (err: any) {
    console.error("[saveUAAPAdminOverride] error:", err);
    return { success: false, error: err.message || "Failed to save admin overrides." };
  }
}

/**
 * Deletes a division from the UAAP Archive and updates overrides.
 */
export async function deleteUAAPAdminDivision(
  season: string,
  sport: string,
  division: string
): Promise<{ success: boolean; error?: string; data?: MergedUAAPData }> {
  const { standingsPath, overridesPath } = getDataPaths();

  try {
    const divisionKey = makeDivisionKey(season, sport, division);
    const overrides = await readAdminOverrides();

    overrides.updated_at = new Date().toISOString();
    delete overrides.standings_overrides[divisionKey];

    if (!overrides.deleted_divisions.some((k) => k.toLowerCase() === divisionKey.toLowerCase())) {
      overrides.deleted_divisions.push(divisionKey);
    }

    if (supabase) {
      try {
        const seasonRes = await supabase.from("seasons").select("id").limit(1);
        const validSeasonId = seasonRes.data?.[0]?.id || "pvl-2026-on-tour";
        await supabase.from("teams").upsert({
          id: OVERRIDES_STORAGE_ROW_ID,
          name: "__UAAP_ARCHIVE_STORAGE__",
          short_name: "UAAP_ARCHIVE",
          logo: null,
          league: "UAAP",
          accent_color: "#000000",
          season_id: validSeasonId,
          record: overrides,
        });
      } catch (dbErr: any) {
        console.error("[UAAP Data] Supabase delete error:", dbErr);
      }
    }

    await safeWriteFile(overridesPath, JSON.stringify(overrides, null, 2));

    const mergedData = await getMergedUAAPData();
    await safeWriteFile(standingsPath, JSON.stringify(mergedData.standings, null, 2));

    return { success: true, data: mergedData };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}
