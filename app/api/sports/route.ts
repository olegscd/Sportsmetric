import { NextRequest, NextResponse } from "next/server";
import { isAdminAuthenticated } from "@/lib/admin-auth";
import { fetchSportsData } from "@/lib/supabase-data";
import type { League } from "@/types/sports";

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const admin = params.get("admin") === "1";
  if (admin && !(await isAdminAuthenticated())) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }
  const league = params.get("league") ?? "UAAP";
  if (!["UAAP", "PBA", "PVL", "ALL"].includes(league)) {
    return NextResponse.json({ error: "Invalid league." }, { status: 400 });
  }
  try {
    const data = await fetchSportsData({
      league: league as League | "ALL", admin,
      metadata: params.get("metadata") === "1",
      seasonId: params.get("season") ?? undefined,
      playerId: params.get("player") ?? undefined,
      teamId: params.get("team") ?? undefined,
    });
    return NextResponse.json(data, { headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    console.error("[Sports data]", err);
    return NextResponse.json({ error: "Could not load sports data." }, { status: 500 });
  }
}
