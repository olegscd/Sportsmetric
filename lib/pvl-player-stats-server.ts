import { readFile } from "node:fs/promises";
import path from "node:path";
import { supabase } from "@/lib/supabase";
import { isNetworkUnreachable, isSupabaseNetworkDown } from "@/lib/supabase-data";
import {
  pvlSlugCandidates, recordFromRows, rowsFromLegacyRecord,
  type PvlConferenceStatRow, type PvlOfficialPlayerRecord,
} from "@/lib/pvl-player-stats";

/**
 * Server-side lookup of a player's official PVL statistics. Rows come from
 * Supabase (`pvl_player_conference_stats`, kept current by
 * `npm run pvl:stats`). The August 2026 snapshot under scripts/generated is
 * read from disk only when the database is unreachable or has no rows for the
 * player, so it never ships in client JavaScript.
 */
export async function getOfficialPvlPlayerRecord(personId: string, playerId: string, name?: string): Promise<PvlOfficialPlayerRecord | null> {
  const candidates = pvlSlugCandidates(personId, playerId, name);
  if (!candidates.length) return null;
  const rows = await readStoredRows(candidates);
  const slug = rows && candidates.find(c => rows.some(r => r.player_slug === c));
  if (slug) return recordFromRows(rows.filter(r => r.player_slug === slug));
  return legacyRecord(candidates);
}

const COLUMNS = "player_slug,conference_id,conference_name,player_name,team,position,jersey,height,school,stats";

async function readStoredRows(candidates: string[]): Promise<PvlConferenceStatRow[] | null> {
  if (!supabase || isSupabaseNetworkDown()) return null;
  try {
    const { data, error } = await supabase.from("pvl_player_conference_stats").select(COLUMNS).in("player_slug", candidates).limit(500);
    if (error) { console.error("[Sportsmetric DB] PVL player stats:", error.message); return null; }
    return (data ?? []) as unknown as PvlConferenceStatRow[];
  } catch (err) {
    if (!isNetworkUnreachable(err)) console.error("[Sportsmetric DB] PVL player stats:", err);
    return null;
  }
}

let legacy: Promise<Record<string, PvlOfficialPlayerRecord>> | null = null;

async function legacyRecord(candidates: string[]): Promise<PvlOfficialPlayerRecord | null> {
  legacy ??= readFile(path.join(process.cwd(), "scripts", "generated", "pvl-official-player-stats.json"), "utf8")
    .then(text => JSON.parse(text) as Record<string, PvlOfficialPlayerRecord>)
    .catch(() => ({}));
  const data = await legacy;
  const slug = candidates.find(c => data[c]);
  return slug ? recordFromRows(rowsFromLegacyRecord(data[slug])) : null;
}
