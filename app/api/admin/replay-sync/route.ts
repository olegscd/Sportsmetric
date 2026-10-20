import { isAdminAuthenticated } from "@/lib/admin-auth";
import { getServiceSupabase } from "@/lib/supabase-admin";
import { requireReplayData, runReplaySync } from "@/lib/replay-sync/run";
import type { League } from "@/types/sports";

export const runtime = "nodejs";
export const maxDuration = 60;
const headers = { "Cache-Control": "no-store" };
const leagues = ["UAAP", "PBA", "PVL"];

export async function GET(request: Request) {
  if (!(await isAdminAuthenticated())) return Response.json({ error: "Unauthorized." }, { status: 401, headers });
  const db = getServiceSupabase();
  if (!db) return Response.json({ error: "Server database access is unavailable." }, { status: 503, headers });
  const seasonId = new URL(request.url).searchParams.get("season");
  let suggestions = db.from("replay_suggestions").select("*,games!inner(id,league,season_id,start_time,home_team_id,away_team_id)")
    .eq("status", "pending").order("score", { ascending: false }).order("created_at").limit(100);
  if (seasonId) suggestions = suggestions.eq("games.season_id", seasonId);
  const results = await Promise.all([
    db.from("replay_sync_settings").select("enabled,schedule_configured,auto_approve,backfill_enabled,backfill_finished_at,last_started_at,lease_until,last_dead_check_at").eq("id", true).single(),
    db.from("replay_channels").select("*").order("league").order("label"), suggestions,
    db.from("replay_sync_runs").select("*").order("started_at", { ascending: false }).limit(10),
    db.from("replay_issues").select("*").eq("resolved", false).order("last_seen_at", { ascending: false }).limit(100),
    db.from("replay_sync_quota").select("day,units_used").order("day", { ascending: false }).limit(1),
  ]);
  const error = results.find(r => r.error)?.error;
  if (error) return Response.json({ error: "Replay setup is incomplete. Apply the replay-suggestions migration first." }, { status: 503, headers });
  const [settings, channels, pending, runs, issues, quota] = results.map(r => r.data);
  return Response.json({ settings, channels, pending, runs, issues, quota, apiKeyConfigured: !!process.env.YOUTUBE_API_KEY }, { headers });
}

export async function POST(request: Request) {
  if (!(await isAdminAuthenticated())) return Response.json({ error: "Unauthorized." }, { status: 401, headers });
  const db = getServiceSupabase();
  if (!db) return Response.json({ error: "Server database access is unavailable." }, { status: 503, headers });
  try {
    const body = await request.json();
    if (typeof body !== "object" || !body || Array.isArray(body)) throw new Error("Invalid replay action.");
    if (body.action === "autoApprove" && typeof body.enabled === "boolean") {
      requireReplayData(await db.from("replay_sync_settings").update({ auto_approve: body.enabled }).eq("id", true));
      return Response.json({ success: true }, { headers });
    }
    if (body.action === "backfillAll") {
      const settings = requireReplayData(await db.from("replay_sync_settings").select("backfill_enabled").eq("id", true).single());
      if (!settings?.backfill_enabled) {
        requireReplayData(await db.from("replay_scan_cursors").update({ completed_at: null, next_page_token: null }).eq("scope", "history:all"));
        requireReplayData(await db.from("replay_sync_settings").update({ backfill_enabled: true, backfill_finished_at: null }).eq("id", true));
      }
      return Response.json(await runReplaySync({ db, manual: true }), { headers });
    }
    if (body.action === "scan" || body.action === "backfill") {
      if (body.league !== undefined && !leagues.includes(body.league)) throw new Error("Choose UAAP, PBA or PVL.");
      if (body.action === "backfill") {
        if (typeof body.seasonId !== "string" || !body.seasonId.trim()) throw new Error("Choose a season to backfill.");
        const season = requireReplayData(await db.from("seasons").select("id,league").eq("id", body.seasonId).single());
        if (!season || body.league && body.league !== season.league) throw new Error("The season does not match the chosen league.");
      }
      return Response.json(await runReplaySync({ db, manual: true,
        ...(body.action === "backfill" ? { seasonId: body.seasonId } : {}), league: body.league as League | undefined }), { headers });
    }
    if (body.action === "toggle" && typeof body.enabled === "boolean") {
      if (body.enabled) {
        const settings = requireReplayData(await db.from("replay_sync_settings").select("schedule_configured").eq("id", true).single());
        if (!settings?.schedule_configured) throw new Error("Install the daily schedule first by running enable_replay_sync.sql in Supabase SQL Editor.");
      }
      requireReplayData(await db.from("replay_sync_settings").update({ enabled: body.enabled }).eq("id", true));
    } else if (body.action === "channel") {
      if (!leagues.includes(body.league) || typeof body.channelId !== "string" || !/^UC[A-Za-z0-9_-]{22}$/.test(body.channelId)) throw new Error("Use a valid channel ID starting with UC (24 characters).");
      if (typeof body.label !== "string" || !body.label.trim() || body.label.trim().length > 60) throw new Error("Enter a channel label of 1–60 characters.");
      if (typeof body.enabled !== "boolean" || typeof body.leagueSpecific !== "boolean") throw new Error("Invalid channel settings.");
      requireReplayData(await db.from("replay_channels").upsert({ league: body.league, channel_id: body.channelId,
        label: body.label.trim(), enabled: body.enabled, league_specific: body.leagueSpecific }));
    } else if (body.action === "review") {
      if (typeof body.id !== "string" || !/^[0-9a-f-]{36}$/i.test(body.id) || typeof body.approve !== "boolean") throw new Error("Choose a suggestion to review.");
      requireReplayData(await db.rpc("review_replay_suggestion", { suggestion_id: body.id, approve: body.approve }));
    } else if (body.action === "resolve" && typeof body.id === "string") {
      requireReplayData(await db.from("replay_issues").update({ resolved: true }).eq("id", body.id));
    } else return Response.json({ error: "Invalid replay action." }, { status: 400, headers });
    return Response.json({ success: true }, { headers });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Replay action failed." }, { status: 400, headers });
  }
}
