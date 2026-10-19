import { isAdminAuthenticated } from "@/lib/admin-auth";
import { getAdminInternationalData } from "@/lib/international-data";
import { NextResponse } from "next/server";

/** Full international dataset, including unpublished drafts, for the admin workspace. */
export async function GET() {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }
  try {
    const data = await getAdminInternationalData();
    return NextResponse.json(data, { headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    console.error("[Admin international] load failed:", err);
    return NextResponse.json({ error: err instanceof Error ? err.message : "Could not load international data." }, { status: 500 });
  }
}
