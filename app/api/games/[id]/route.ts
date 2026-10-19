import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!supabase) return NextResponse.json({ error: "Data unavailable." }, { status: 503 });
  const { data, error } = await supabase.from("games").select("play_by_play").eq("id", id).maybeSingle();
  if (error) return NextResponse.json({ error: "Could not load game details." }, { status: 500 });
  if (!data) return NextResponse.json({ error: "Game not found." }, { status: 404 });
  return NextResponse.json(data, { headers: { "Cache-Control": "no-store" } });
}
