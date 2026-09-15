import crypto from "crypto";

/**
 * Pure token/secret helpers with no Next.js request-scope dependencies, so
 * both `proxy.ts` and server components can share them.
 */

export const ADMIN_COOKIE_NAME = "sportsmetric_admin";
export const ADMIN_COOKIE_MAX_AGE = 60 * 60 * 24 * 7; // 7 days, in seconds

export function getAdminSecret(): string {
  const secret = process.env.ADMIN_PASSWORD;
  if (!secret) {
    console.error("[Admin Auth] ADMIN_PASSWORD is not defined in environment variables.");
  }
  return secret || "";
}

export function generateAuthToken(secret: string): string {
  const timestamp = Date.now().toString();
  const hmac = crypto.createHmac("sha256", secret).update(`admin:${timestamp}`).digest("hex");
  return `${timestamp}.${hmac}`;
}

export function verifyAuthToken(token: string | undefined, secret: string): boolean {
  if (!token || !secret) return false;
  const parts = token.split(".");
  if (parts.length !== 2) return false;

  const [timestampStr, providedHmac] = parts;
  const timestamp = parseInt(timestampStr, 10);
  if (Number.isNaN(timestamp)) return false;

  const ageMs = Date.now() - timestamp;
  if (ageMs < 0 || ageMs > ADMIN_COOKIE_MAX_AGE * 1000) return false;

  const expectedHmac = crypto
    .createHmac("sha256", secret)
    .update(`admin:${timestampStr}`)
    .digest("hex");

  try {
    const bufProvided = Buffer.from(providedHmac, "hex");
    const bufExpected = Buffer.from(expectedHmac, "hex");
    if (bufProvided.length !== bufExpected.length) return false;
    return crypto.timingSafeEqual(bufProvided, bufExpected);
  } catch {
    return false;
  }
}

/** Constant-time password comparison so response timing can't leak the secret. */
export function passwordMatches(candidate: string, secret: string): boolean {
  const a = crypto.createHash("sha256").update(candidate).digest();
  const b = crypto.createHash("sha256").update(secret).digest();
  return crypto.timingSafeEqual(a, b);
}
