import { cookies } from "next/headers";

import { ADMIN_COOKIE_NAME, getAdminSecret, verifyAuthToken } from "@/lib/admin-token";

export {
  ADMIN_COOKIE_MAX_AGE,
  ADMIN_COOKIE_NAME,
  generateAuthToken,
  getAdminSecret,
  passwordMatches,
  verifyAuthToken,
} from "@/lib/admin-token";

export async function isAdminAuthenticated(): Promise<boolean> {
  const secret = getAdminSecret();
  if (!secret) return false;
  const cookieStore = await cookies();
  return verifyAuthToken(cookieStore.get(ADMIN_COOKIE_NAME)?.value, secret);
}

// ---------------------------------------------------------------------------
// Login throttling
// ---------------------------------------------------------------------------

/**
 * In-process throttle for password attempts. A serverless deployment may run
 * several instances, each with its own counter, so this slows a brute-force
 * attempt rather than stopping it outright -- it is a backstop, not the only
 * defence.
 */
const MAX_ATTEMPTS = 5;
const WINDOW_MS = 15 * 60 * 1000;
const LOCKOUT_MS = 15 * 60 * 1000;

type AttemptRecord = { count: number; firstAttemptAt: number; lockedUntil: number };

const attempts = new Map<string, AttemptRecord>();

function pruneExpired(now: number): void {
  for (const [key, record] of attempts) {
    if (record.lockedUntil < now && now - record.firstAttemptAt > WINDOW_MS) {
      attempts.delete(key);
    }
  }
}

export function checkLoginThrottle(key: string): { allowed: boolean; retryAfterSeconds: number } {
  const now = Date.now();
  pruneExpired(now);

  const record = attempts.get(key);
  if (record && record.lockedUntil > now) {
    return { allowed: false, retryAfterSeconds: Math.ceil((record.lockedUntil - now) / 1000) };
  }
  return { allowed: true, retryAfterSeconds: 0 };
}

export function recordFailedLogin(key: string): void {
  const now = Date.now();
  const record = attempts.get(key);

  if (!record || now - record.firstAttemptAt > WINDOW_MS) {
    attempts.set(key, { count: 1, firstAttemptAt: now, lockedUntil: 0 });
    return;
  }

  record.count += 1;
  if (record.count >= MAX_ATTEMPTS) {
    record.lockedUntil = now + LOCKOUT_MS;
    record.count = 0;
    record.firstAttemptAt = now;
  }
}

export function clearLoginAttempts(key: string): void {
  attempts.delete(key);
}
