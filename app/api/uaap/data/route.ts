import { isAdminAuthenticated } from "@/lib/admin-auth";
import { getMergedUAAPData, getPublicUAAPData, saveUAAPAdminOverride, type UAAPSavePayload } from "@/lib/uaap-data";
import { revalidatePath } from "next/cache";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(req: NextRequest) {
  try {
    const admin = req.nextUrl.searchParams.get("admin") === "1";
    if (admin && !(await isAdminAuthenticated())) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const data = await (admin ? getMergedUAAPData() : getPublicUAAPData());
    return NextResponse.json(data, {
      headers: {
        "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
      },
    });
  } catch (err: unknown) {
    console.error("[/api/uaap/data GET] error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to fetch UAAP data" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  const isAuth = await isAdminAuthenticated();
  if (!isAuth) {
    return NextResponse.json({ error: "Unauthorized. Please log in as admin." }, { status: 401 });
  }

  try {
    const body: UAAPSavePayload = await req.json();
    const result = await saveUAAPAdminOverride(body);

    if (result.success) {
      revalidatePath("/uaap");
      revalidatePath("/admin");
      return NextResponse.json(result, {
        headers: {
          "Cache-Control": "no-store, no-cache, must-revalidate",
        },
      });
    }

    return NextResponse.json(result, { status: 400 });
  } catch (err: unknown) {
    console.error("[/api/uaap/data POST] error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to save UAAP archive data" },
      { status: 500 }
    );
  }
}
