import { isAdminAuthenticated } from "@/app/admin/actions";
import { getMergedUAAPData, saveUAAPAdminOverride, type UAAPSavePayload } from "@/lib/uaap-data";
import { revalidatePath } from "next/cache";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  try {
    const data = await getMergedUAAPData();
    return NextResponse.json(data, {
      headers: {
        "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
      },
    });
  } catch (err: any) {
    console.error("[/api/uaap/data GET] error:", err);
    return NextResponse.json(
      { error: err.message || "Failed to fetch UAAP data" },
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
  } catch (err: any) {
    console.error("[/api/uaap/data POST] error:", err);
    return NextResponse.json(
      { error: err.message || "Failed to save UAAP archive data" },
      { status: 500 }
    );
  }
}
