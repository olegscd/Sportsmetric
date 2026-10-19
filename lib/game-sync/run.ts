import type { SupabaseClient } from "@supabase/supabase-js";
import { getServiceSupabase } from "@/lib/supabase-admin";
import { philippineDay, planObservation } from "./plan";
import { collectObservations } from "./sources";
import type { StoredGame, SyncIssue, SyncLink, SyncSource, SyncTeam } from "./types";

export const GAME_FIELDS = "id,league,season_id,home_team_id,away_team_id,home_score,away_score,status,start_time,venue,stage,is_playoff";
const errorText = (error: unknown) => error instanceof Error ? error.message : String(error);

function requireData<T>(result: { data: T; error: { message: string } | null }): T {
  if (result.error) throw new Error(result.error.message);
  return result.data;
}

async function readAll<T>(db: SupabaseClient, table: string, columns: string, seasonIds?: string[]): Promise<T[]> {
  const rows: T[] = [];
  for (let from = 0; ; from += 500) {
    let query = db.from(table).select(columns).order(table === "game_sync_links" ? "source_id" : "id");
    if (table === "game_sync_links") query = query.order("source_key");
    if (seasonIds) query = query.in("season_id", seasonIds);
    const page = requireData(await query.range(from, from + 499)) as T[];
    rows.push(...page);
    if (page.length < 500) return rows;
    if (from >= 10000) throw new Error("Updater dataset exceeds its safe page limit.");
  }
}

export async function runGameSync({ preview = false, db = getServiceSupabase(), now = new Date() }: { preview?: boolean; db?: SupabaseClient | null; now?: Date } = {}) {
  if (!db) throw new Error("Server database access is unavailable.");
  let runId: string | null = null;
  if (!preview) {
    runId = requireData(await db.rpc("begin_game_sync")) as string | null;
    if (!runId) return { skipped: true, reason: "Updater is paused or another run is active." };
  }
  const summary = { preview, error: null as string | null, checked: 0, updated: 0, unchanged: 0, held: 0, skipped: 0, sources: [] as { id: string; checked: number; error: string | null }[], issues: [] as SyncIssue[] };
  let status = "failed";
  try {
    const configured = requireData(await db.from("game_sync_sources").select("*").eq("enabled", true)) as SyncSource[];
    const seasons = requireData(await db.from("seasons").select("id,league").eq("is_current", true)) as { id: string; league: string }[];
    const sources = configured.filter(s => seasons.some(season => season.id === s.season_id && season.league === s.league));
    if (!sources.length) throw new Error("No current competitions are configured for automatic updates.");
    const ids = sources.map(s => s.season_id);
    const [teams, games, links] = await Promise.all([
      readAll<SyncTeam>(db, "teams", "id,name,short_name,league,season_id", ids),
      readAll<StoredGame>(db, "games", GAME_FIELDS, ids),
      readAll<SyncLink>(db, "game_sync_links", "*"),
    ]);
    const recordIssue = async (issue: SyncIssue) => {
      summary.held++;
      summary.issues.push(issue);
      if (!preview) requireData(await db!.from("game_sync_issues").upsert({ ...issue, resolved: false, last_seen_at: now.toISOString() }));
    };
    // Independent league fetches share a deadline; one unavailable source does
    // not stop the other leagues or extend a serverless request indefinitely.
    const deadline = AbortSignal.timeout(35000);
    const results = await Promise.allSettled(sources.map(source => collectObservations(source, links, now, deadline)));
    for (let index = 0; index < sources.length; index++) {
      const source = sources[index];
      const result = results[index];
      let sourceError: string | null = null;
      let checked = 0;
      if (result.status === "rejected") {
        sourceError = errorText(result.reason);
        await recordIssue({ source_id: source.id, source_key: "source", message: sourceError });
      } else {
        sourceError = result.value.warnings.length ? result.value.warnings.join("; ") : null;
        for (const item of result.value.items) {
          // The automatic updater is deliberately not a historical backfill.
          if (item.status === "FINAL" && Date.parse(item.day) < now.getTime() - 7 * 86400000) continue;
          checked++; summary.checked++;
          const decision = planObservation(source, item, teams, games, links, result.value.items);
          if (decision.kind === "skip") { summary.skipped++; continue; }
          if (decision.kind === "review") {
            await recordIssue({ source_id: source.id, source_key: item.key, ...(decision.gameId ? { game_id: decision.gameId } : {}), message: decision.reason });
            continue;
          }
          if (preview) {
            if (decision.previous && JSON.stringify(decision.game) === JSON.stringify(decision.previous)) summary.unchanged++;
            else summary.updated++;
          } else {
            const saved = await db.rpc("apply_game_sync", { run_id: runId, source: source.id, match_key: item.key, proposed: decision.game, expected: decision.previous });
            if (saved.error) {
              await recordIssue({ source_id: source.id, source_key: item.key, ...(decision.previous ? { game_id: decision.game.id } : {}), message: saved.error.message });
              continue;
            }
            if (saved.data === "paused") { summary.skipped++; continue; }
            if (saved.data === "updated") summary.updated++; else summary.unchanged++;
          }
          // Later observations in this same batch must see earlier updates.
          const existing = games.findIndex(g => g.id === decision.game.id);
          if (existing >= 0) games[existing] = decision.game; else games.push(decision.game);
          const linked = links.find(l => l.source_id === source.id && l.source_key === item.key);
          if (linked) { linked.snapshot = decision.game; linked.last_checked_at = now.toISOString(); }
          else links.push({ source_id: source.id, source_key: item.key, game_id: decision.game.id, snapshot: decision.game, paused: false, last_checked_at: now.toISOString() });
        }
        if (sourceError) await recordIssue({ source_id: source.id, source_key: "source", message: sourceError });
        else if (!preview) requireData(await db.from("game_sync_issues").update({ resolved: true }).eq("source_id", source.id).eq("source_key", "source"));
      }
      summary.sources.push({ id: source.id, checked, error: sourceError });
      if (!preview) requireData(await db.from("game_sync_sources").update({ last_checked_at: now.toISOString(), last_error: sourceError, ...(!sourceError ? { last_success_at: now.toISOString() } : {}) }).eq("id", source.id));
    }
    // Flag overdue unfinished fixtures independently of scraper success.
    for (const game of games) {
      const source = sources.find(s => s.season_id === game.season_id && s.league === game.league);
      if (!source || game.status === "FINAL" || Date.parse(game.start_time) > now.getTime() - 8 * 3600000 || Date.parse(game.start_time) < now.getTime() - 7 * 86400000) continue;
      await recordIssue({ source_id: source.id, source_key: "overdue:" + game.id, game_id: game.id, message: "This fixture is overdue without a confirmed final result. Check the official source or a postponement." });
    }
    if (!preview) {
      const finalIds = games.filter(g => g.status === "FINAL").map(g => "overdue:" + g.id);
      if (finalIds.length) requireData(await db.from("game_sync_issues").update({ resolved: true }).in("source_key", finalIds));
    }
    status = summary.sources.every(s => s.error) ? "failed" : summary.held ? "partial" : "success";
    return { ...summary, status, runId, checkedOn: philippineDay(now.toISOString()) };
  } catch (error) {
    summary.error = errorText(error);
    throw error;
  } finally {
    if (runId) {
      const finished = await db.rpc("finish_game_sync", { run_id: runId, result_status: status, result_summary: summary });
      if (finished.error) console.error("[Game sync] Could not close run:", finished.error.message);
    }
  }
}
