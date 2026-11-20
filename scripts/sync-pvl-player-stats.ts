/**
 * Refreshes official PVL player statistics in Supabase.
 *
 *   npm run pvl:stats                      # conference selected on pvl.ph/leaders
 *   npm run pvl:stats -- --conference 21   # a specific conference
 *   npm run pvl:stats -- --snapshot        # load the Aug 2026 JSON snapshot (never overwrites newer rows)
 *   npm run pvl:stats -- --dry-run         # fetch and report without writing
 *
 * Needs NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (except --dry-run).
 */
import { readFile } from "node:fs/promises";
import { fetchSource } from "@/lib/game-sync/sources";
import { getServiceSupabase } from "@/lib/supabase-admin";
import { rowsFromLegacyRecord, type PvlConferenceStatRow, type PvlOfficialPlayerRecord } from "@/lib/pvl-player-stats";
import { collectPvlConferenceStats } from "@/lib/pvl-player-stats-sync";

const args = process.argv.slice(2);
const flag = (name: string) => args.includes(name);
const conferenceArg = args[args.indexOf("--conference") + 1];
const conferenceId = args.includes("--conference") ? Number(conferenceArg) : undefined;
if (conferenceId !== undefined && !(Number.isInteger(conferenceId) && conferenceId > 0)) throw new Error("--conference needs a numeric pvl.ph conference id.");

async function main() {
  let rows: (PvlConferenceStatRow & { source: string })[];
  if (flag("--snapshot")) {
    const data = JSON.parse(await readFile("scripts/generated/pvl-official-player-stats.json", "utf8")) as Record<string, PvlOfficialPlayerRecord>;
    rows = Object.values(data).flatMap(rowsFromLegacyRecord).map(row => ({ ...row, source: "snapshot-2026-08" }));
    console.log(`Snapshot: ${rows.length} conference lines for ${Object.keys(data).length} players.`);
  } else {
    const form = (fields: Record<string, string>) => new URLSearchParams(fields).toString();
    const result = await collectPvlConferenceStats({
      get: url => fetchSource(url),
      post: (url, fields) => fetchSource(url, { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: form(fields) }),
    }, conferenceId);
    for (const warning of result.warnings) console.warn("  warning:", warning);
    rows = result.rows.map(row => ({ ...row, source: "pvl.ph" }));
    console.log(`${result.conference.name} (#${result.conference.id}): ${rows.length} player lines.`);
  }
  if (flag("--dry-run")) return;
  const db = getServiceSupabase();
  if (!db) throw new Error("Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY to write player stats.");
  const snapshot = flag("--snapshot");
  for (let i = 0; i < rows.length; i += 500) {
    const batch = rows.slice(i, i + 500).map(row => ({ ...row, updated_at: new Date().toISOString() }));
    const { error } = await db.from("pvl_player_conference_stats")
      .upsert(batch, { onConflict: "player_slug,conference_id", ignoreDuplicates: snapshot });
    if (error) throw new Error("Saving PVL player stats failed: " + error.message);
  }
  console.log("Saved.");
}

main().catch(error => { console.error(error instanceof Error ? error.message : error); process.exit(1); });
