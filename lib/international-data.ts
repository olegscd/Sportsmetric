import { ValidationError } from "@/lib/admin-validation";
import {
  EMPTY_INTERNATIONAL, athleteFromRow, athleteToRow, competitionFromRow, competitionToRow, resultFromRow, resultToRow,
  type IntlAthlete, type IntlCompetition, type IntlResult, type InternationalData,
} from "@/lib/international";
import { supabase } from "@/lib/supabase";
import { getServiceSupabase } from "@/lib/supabase-admin";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Reads use the anon client, so RLS only ever returns published athletes and
 * published results of published athletes. The explicit `published` filters
 * repeat that rule for defense in depth. Admin reads/writes use service role.
 */

type DbError = { code?: string; message: string } | null;

/** Tables not migrated yet: render an empty section instead of failing the page. */
function isMissingTable(error: DbError) {
  return error?.code === "42P01" || error?.code === "PGRST205" || /does not exist|schema cache/i.test(error?.message ?? "");
}

class MissingTables extends Error {}

function check<T>(result: { data: T | null; error: DbError }, context: string): T {
  if (result.error) {
    if (isMissingTable(result.error)) throw new MissingTables(context);
    throw new Error(`[International] ${context}: ${result.error.message}`);
  }
  return (result.data ?? []) as T;
}

async function loadCompetitions(db: SupabaseClient, ids: string[]): Promise<IntlCompetition[]> {
  if (!ids.length) return [];
  const rows = check(await db.from("intl_competitions").select("*").in("id", [...new Set(ids)]), "competitions");
  return (rows as Record<string, unknown>[]).map(competitionFromRow);
}

export async function getPublicInternationalData(): Promise<InternationalData> {
  if (!supabase) return EMPTY_INTERNATIONAL;
  try {
    const athletes = (check(await supabase.from("intl_athletes").select("*").eq("published", true).order("name"), "athletes") as Record<string, unknown>[])
      .map(athleteFromRow).filter(a => a.published);
    const ids = new Set(athletes.map(a => a.id));
    const results = (check(await supabase.from("intl_results").select("*").eq("published", true), "results") as Record<string, unknown>[])
      .map(resultFromRow).filter(r => r.published && ids.has(r.athleteId));
    const competitions = await loadCompetitions(supabase, results.map(r => r.competitionId));
    return { athletes, competitions, results, available: true };
  } catch (err) {
    if (err instanceof MissingTables) return EMPTY_INTERNATIONAL;
    throw err;
  }
}

export interface AthleteProfileData {
  athlete: IntlAthlete;
  results: IntlResult[];
  competitions: IntlCompetition[];
  /** A season-level player id for the same person in a Philippine league, if linked. */
  leaguePlayerId: string | null;
}

export async function getPublicAthleteProfile(id: string): Promise<AthleteProfileData | null> {
  if (!supabase) return null;
  try {
    const row = check(await supabase.from("intl_athletes").select("*").eq("id", id).eq("published", true).maybeSingle(), "athlete") as Record<string, unknown> | null;
    if (!row || Array.isArray(row)) return null;
    const athlete = athleteFromRow(row);
    if (!athlete.published) return null;
    const results = (check(await supabase.from("intl_results").select("*").eq("athlete_id", id).eq("published", true), "athlete results") as Record<string, unknown>[])
      .map(resultFromRow).filter(r => r.published && r.athleteId === id);
    const competitions = await loadCompetitions(supabase, results.map(r => r.competitionId));
    let leaguePlayerId: string | null = null;
    if (athlete.personId) {
      const { data } = await supabase.from("players").select("id").eq("person_id", athlete.personId).limit(1);
      leaguePlayerId = (data as { id: string }[] | null)?.[0]?.id ?? null;
    }
    return { athlete, results, competitions, leaguePlayerId };
  } catch (err) {
    if (err instanceof MissingTables) return null;
    throw err;
  }
}

/** Lightweight list for the sitemap. */
export async function fetchPublicAthleteIds(): Promise<string[]> {
  if (!supabase) return [];
  const { data, error } = await supabase.from("intl_athletes").select("id").eq("published", true);
  if (error) {
    if (isMissingTable(error)) return [];
    throw new Error(`[International] sitemap athletes: ${error.message}`);
  }
  return ((data ?? []) as { id: string }[]).map(row => row.id);
}

// ---------------------------------------------------------------------------
// Admin (service role)

export async function getAdminInternationalData(): Promise<InternationalData> {
  const db = getServiceSupabase();
  if (!db) throw new Error("SUPABASE_SERVICE_ROLE_KEY is not configured.");
  try {
    const [athletes, competitions, results] = await Promise.all([
      db.from("intl_athletes").select("*").order("name"),
      db.from("intl_competitions").select("*").order("start_date", { ascending: false, nullsFirst: false }),
      db.from("intl_results").select("*").order("result_date", { ascending: false, nullsFirst: false }),
    ]);
    return {
      athletes: (check(athletes, "athletes") as Record<string, unknown>[]).map(athleteFromRow),
      competitions: (check(competitions, "competitions") as Record<string, unknown>[]).map(competitionFromRow),
      results: (check(results, "results") as Record<string, unknown>[]).map(resultFromRow),
      available: true,
    };
  } catch (err) {
    if (err instanceof MissingTables) return EMPTY_INTERNATIONAL;
    throw err;
  }
}

async function write(context: string, run: (db: SupabaseClient) => PromiseLike<{ error: DbError }>): Promise<boolean> {
  const db = getServiceSupabase();
  if (!db) return false;
  try {
    const { error } = await run(db);
    if (!error) return true;
    if (error.code === "23503") {
      throw new ValidationError(context.startsWith("delete competition")
        ? "This competition still has results. Delete or move those results first."
        : "The selected athlete or competition no longer exists. Reload and try again.");
    }
    if (error.code === "23514" || error.code === "23505") throw new ValidationError(`Rejected by the database: ${error.message}`);
    if (isMissingTable(error)) throw new ValidationError("International tables are missing. Apply migration 20261020000000_international.sql first.");
    console.error(`[International] ${context}:`, error.message);
    return false;
  } catch (err) {
    if (err instanceof ValidationError) throw err;
    console.error(`[International] Unexpected error during ${context}:`, err);
    return false;
  }
}

/**
 * Keep athlete saves working before the photo-credit migration is applied.
 * A missing column is only tolerated when no attribution is being written;
 * setting a photo credit without the schema gets a readable error instead.
 */
export const upsertIntlAthlete = (a: IntlAthlete) => write("upsert athlete", async db => {
  const full = await db.from("intl_athletes").upsert([athleteToRow(a)]);
  const missingPhotoColumns = full.error?.code === "PGRST204"
    && /photo_(credit|license|source_url)/.test(full.error.message);
  if (!missingPhotoColumns) return full;
  if (a.photoCredit || a.photoLicense || a.photoSourceUrl) {
    throw new ValidationError("Photo attribution columns are missing. Apply migration 20261020010300_intl_photo_credits.sql first.");
  }
  const legacy = athleteToRow(a);
  delete legacy.photo_credit;
  delete legacy.photo_license;
  delete legacy.photo_source_url;
  return db.from("intl_athletes").upsert([legacy]);
});
export const deleteIntlAthlete = (id: string) => write("delete athlete", db => db.from("intl_athletes").delete().eq("id", id));
export const upsertIntlCompetition = (c: IntlCompetition) => write("upsert competition", db => db.from("intl_competitions").upsert([competitionToRow(c)]));
export const deleteIntlCompetition = (id: string) => write("delete competition", db => db.from("intl_competitions").delete().eq("id", id));
export const upsertIntlResult = (r: IntlResult) => write("upsert result", db => db.from("intl_results").upsert([resultToRow(r)]));
export const deleteIntlResult = (id: string) => write("delete result", db => db.from("intl_results").delete().eq("id", id));
