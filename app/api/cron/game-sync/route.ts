import { timingSafeEqual } from "node:crypto";
import { getServiceSupabase } from "@/lib/supabase-admin";
import { runGameSync } from "@/lib/game-sync/run";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(request: Request) {
  const db = getServiceSupabase();
  if (!db) return Response.json({ error: "Updater unavailable." }, { status: 503 });
  const provided = request.headers.get("authorization")?.replace(/^Bearer /, "") ?? "";
  if (provided.length < 32 || provided.length > 256) return Response.json({ error: "Unauthorized." }, { status: 401 });
  const { data, error } = await db.from("game_sync_settings").select("token").eq("id", true).single();
  if (error) return Response.json({ error: "Updater has not been configured." }, { status: 503 });
  const expected = data?.token as string | undefined;
  const a = Buffer.from(provided), b = Buffer.from(expected ?? "");
  if (!expected || a.length !== b.length || !timingSafeEqual(a, b)) return Response.json({ error: "Unauthorized." }, { status: 401 });
  try {
    const result = await runGameSync({ db });
    return Response.json(result, { status: "status" in result && result.status === "failed" ? 502 : 200, headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("[Game sync]", error instanceof Error ? error.message : error);
    return Response.json({ error: "Update failed. Check the updater status in the admin workspace." }, { status: 500 });
  }
}
