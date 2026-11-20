import { NextResponse } from "next/server";
import { mockGames } from "@/lib/mock-data";
import { supabase } from "@/lib/supabase";
import { isNetworkUnreachable, isSupabaseNetworkDown } from "@/lib/supabase-data";

function fallbackPlayByPlay(id: string) {
  const game = mockGames.find((g) => g.id === id);
  return NextResponse.json(
    { play_by_play: game?.playByPlay ?? [] },
    { headers: { "Cache-Control": "no-store" } }
  );
}

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!supabase) return NextResponse.json({ error: "Data unavailable." }, { status: 503 });
  if (isSupabaseNetworkDown()) return fallbackPlayByPlay(id);
  try {
    const { data, error } = await supabase.from("games").select("play_by_play").eq("id", id).maybeSingle();
    if (error) {
      if (isNetworkUnreachable(error.message)) {
        return fallbackPlayByPlay(id);
      }
      return NextResponse.json({ error: "Could not load game details." }, { status: 500 });
    }
    if (!data) return NextResponse.json({ error: "Game not found." }, { status: 404 });
    return NextResponse.json(data, { headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    if (isNetworkUnreachable(err)) {
      return fallbackPlayByPlay(id);
    }
    return NextResponse.json({ error: "Could not load game details." }, { status: 500 });
  }
}
