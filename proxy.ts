import { NextResponse, type NextRequest } from "next/server";
import { ADMIN_COOKIE_NAME } from "@/lib/admin-token";
import { verifyAdminSession } from "@/lib/admin-session";
import { buildContentSecurityPolicy } from "@/lib/content-security-policy";

export async function proxy(request: NextRequest) {
  if (request.nextUrl.pathname.startsWith("/api/admin/")) {
    if (!(await verifyAdminSession(request.cookies.get(ADMIN_COOKIE_NAME)?.value))) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }
  }
  const nonce = Buffer.from(crypto.randomUUID()).toString("base64");
  const policy = buildContentSecurityPolicy(nonce, process.env.NODE_ENV !== "production");
  const headers = new Headers(request.headers);
  headers.set("x-nonce", nonce);
  headers.set("x-sports-path", request.nextUrl.pathname);
  headers.set("Content-Security-Policy", policy);
  const response = NextResponse.next({ request: { headers } });
  response.headers.set("Content-Security-Policy", policy);
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
