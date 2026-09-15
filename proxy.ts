import { NextResponse, type NextRequest } from "next/server";

import { ADMIN_COOKIE_NAME, getAdminSecret, verifyAuthToken } from "@/lib/admin-token";

/**
 * Rejects unauthenticated calls to the admin API before they reach a route
 * handler. Each handler still checks auth itself -- this is the outer layer so
 * a new route under /api/admin is never accidentally left open.
 *
 * The /admin page is deliberately not gated here: it renders its own login
 * form when the cookie is missing.
 */
export function proxy(request: NextRequest) {
  const secret = getAdminSecret();
  const token = request.cookies.get(ADMIN_COOKIE_NAME)?.value;

  if (!verifyAuthToken(token, secret)) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  return NextResponse.next();
}

export const config = {
  matcher: "/api/admin/:path*",
};
