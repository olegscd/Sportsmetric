import { isAdminAuthenticated } from "@/lib/admin-auth";
import { getServiceSupabase } from "@/lib/supabase-admin";
import { GAME_FIELDS, runGameSync } from "@/lib/game-sync/run";

export const runtime = "nodejs";
export const maxDuration = 60;
const headers = { "Cache-Control": "no-store" };

export async function GET() {
  if (!(await isAdminAuthenticated())) return Response.json({ error: "Unauthorized." }, { status: 401 });
  const db = getServiceSupabase();
  if (!db) return Response.json({ error: "Server database access is unavailable." }, { status: 503 });
  const results = await Promise.all([
    db.from("game_sync_settings").select("enabled,last_started_at,lease_until").eq("id", true).single(),
    db.from("game_sync_sources").select("*").order("league"),
    db.from("game_sync_runs").select("*").order("started_at", { ascending: false }).limit(12),
    db.from("game_sync_issues").select("*").eq("resolved", false).order("last_seen_at", { ascending: false }).limit(100),
    db.from("game_sync_links").select("game_id,paused").eq("paused", true).limit(200),
  ]);
  const error = results.find(r => r.error)?.error;
  if (error) return Response.json({ error: "Updater setup is incomplete. Apply the game-sync migration and scheduler setup.", details: error.message }, { status: 503, headers });
  const [settings, sources, runs, issues, paused] = results.map(r => r.data);
  return Response.json({ settings, sources, runs, issues, paused }, { headers });
}

export async function POST(request: Request) {
  if (!(await isAdminAuthenticated())) return Response.json({ error: "Unauthorized." }, { status: 401 });
  const db = getServiceSupabase();
  if (!db) return Response.json({ error: "Server database access is unavailable." }, { status: 503 });
  try {
    const body = await request.json();
    if (body.action === "run" || body.action === "preview") return Response.json(await runGameSync({ preview: body.action === "preview", db }), { headers });
    if (body.action === "toggle" && typeof body.enabled === "boolean") {
      const { error } = await db.from("game_sync_settings").update({ enabled: body.enabled }).eq("id", true);
      if (error) throw new Error(error.message);
    } else if (body.action === "source" && typeof body.id === "string" && typeof body.enabled === "boolean") {
      const { error } = await db.from("game_sync_sources").update({ enabled: body.enabled }).eq("id", body.id);
      if (error) throw new Error(error.message);
    } else if (body.action === "game" && typeof body.id === "string" && typeof body.paused === "boolean") {
      // Resuming explicitly accepts the current manual values as the baseline.
      const game = await db.from("games").select(GAME_FIELDS).eq("id", body.id).single();
      if (game.error) throw new Error(game.error.message);
      const { data, error } = await db.from("game_sync_links").update({ paused: body.paused, ...(!body.paused ? { snapshot: game.data } : {}) }).eq("game_id", body.id).select("game_id");
      if (error) throw new Error(error.message);
      if (!data.length) {
        if (!body.paused) throw new Error("This game has not been linked to an official source yet.");
        const issues = await db.from("game_sync_issues").select("source_id,source_key").eq("game_id", body.id);
        if (issues.error) throw new Error(issues.error.message);
        if (!issues.data.length) throw new Error("No official source match is associated with this game.");
        const linked = await db.from("game_sync_links").upsert(issues.data.map(i => ({ ...i, source_key: i.source_key.startsWith("overdue:") ? "manual:" + body.id : i.source_key, game_id: body.id, paused: true, snapshot: game.data })));
        if (linked.error) throw new Error(linked.error.message);
      }
      if (body.paused) {
        const resolved = await db.from("game_sync_issues").update({ resolved: true }).eq("game_id", body.id);
        if (resolved.error) throw new Error(resolved.error.message);
      }
    } else return Response.json({ error: "Invalid updater action." }, { status: 400 });
    return Response.json({ success: true }, { headers });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Update failed." }, { status: 500, headers });
  }
}
