import { timingSafeEqual } from "node:crypto";
import { getServiceSupabase } from "@/lib/supabase-admin";
import { runReplaySync } from "@/lib/replay-sync/run";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(request: Request) {
  const provided = request.headers.get("authorization")?.match(/^Bearer ([A-Za-z0-9_-]{32,256})$/)?.[1];
  if (!provided) return Response.json({ error: "Unauthorized." }, { status: 401 });
  const db = getServiceSupabase();
  if (!db) return Response.json({ error: "Replay discovery unavailable." }, { status: 503 });
  const { data, error } = await db.from("replay_sync_settings").select("token").eq("id", true).single();
  if (error) return Response.json({ error: "Replay discovery has not been configured." }, { status: 503 });
  const a = Buffer.from(provided), b = Buffer.from(data?.token ?? "");
  if (!b.length || a.length !== b.length || !timingSafeEqual(a, b)) return Response.json({ error: "Unauthorized." }, { status: 401 });
  try {
    return Response.json(await runReplaySync({ db }), { headers: { "Cache-Control": "no-store" } });
  } catch {
    return Response.json({ error: "Replay discovery failed. Check Replay suggestions in admin." }, { status: 500 });
  }
}
