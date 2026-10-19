import crypto from "node:crypto";
import { promisify } from "node:util";

export const ADMIN_COOKIE_NAME = "sportsmetric_admin";
export const ADMIN_COOKIE_MAX_AGE = 60 * 60 * 24 * 7;
const scrypt = promisify(crypto.scrypt);

/** Prefer a salted scrypt hash; ADMIN_PASSWORD remains a migration fallback. */
export function getAdminSecret(): string {
  const hash = process.env.ADMIN_PASSWORD_HASH;
  if (hash) return /^scrypt\$[^$]{1,128}\$[a-f0-9]{128}$/i.test(hash) ? hash : "";
  return process.env.ADMIN_PASSWORD || "";
}

export async function passwordMatches(candidate: string, secret: string): Promise<boolean> {
  if (!secret || candidate.length > 1024) return false;
  if (secret.startsWith("scrypt$")) {
    const [, salt, hash, extra] = secret.split("$");
    if (extra || !salt || !/^[a-f0-9]{128}$/i.test(hash ?? "")) return false;
    const actual = await scrypt(candidate, salt, 64) as Buffer;
    return crypto.timingSafeEqual(actual, Buffer.from(hash, "hex"));
  }
  return crypto.timingSafeEqual(
    crypto.createHash("sha256").update(candidate).digest(),
    crypto.createHash("sha256").update(secret).digest(),
  );
}

export function hashSessionToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}
