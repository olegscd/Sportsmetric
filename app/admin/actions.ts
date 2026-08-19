"use server";

import crypto from "crypto";
import { cookies } from "next/headers";

const COOKIE_NAME = "sportsmetric_admin";
const COOKIE_MAX_AGE = 60 * 60 * 24 * 7; // 7 days (in seconds)

function getAdminSecret(): string {
  const secret = process.env.ADMIN_PASSWORD;
  if (!secret) {
    console.error("[Admin Auth] ADMIN_PASSWORD is not defined in environment variables.");
  }
  return secret || "";
}

function generateAuthToken(secret: string): string {
  const timestamp = Date.now().toString();
  const hmac = crypto.createHmac("sha256", secret).update(`admin:${timestamp}`).digest("hex");
  return `${timestamp}.${hmac}`;
}

function verifyAuthToken(token: string | undefined, secret: string): boolean {
  if (!token || !secret) return false;
  const parts = token.split(".");
  if (parts.length !== 2) return false;
  const [timestampStr, providedHmac] = parts;
  const timestamp = parseInt(timestampStr, 10);
  if (Number.isNaN(timestamp)) return false;

  // Check token age (must be within COOKIE_MAX_AGE)
  const ageMs = Date.now() - timestamp;
  if (ageMs < 0 || ageMs > COOKIE_MAX_AGE * 1000) {
    return false;
  }

  const expectedHmac = crypto.createHmac("sha256", secret).update(`admin:${timestampStr}`).digest("hex");
  try {
    const bufProvided = Buffer.from(providedHmac, "hex");
    const bufExpected = Buffer.from(expectedHmac, "hex");
    if (bufProvided.length !== bufExpected.length) return false;
    return crypto.timingSafeEqual(bufProvided, bufExpected);
  } catch {
    return false;
  }
}

export async function loginAdmin(
  _prevState: { error: string | null },
  formData: FormData
): Promise<{ error: string | null }> {
  const password = formData.get("password");
  const secret = getAdminSecret();

  if (!secret) {
    return { error: "Server authentication is misconfigured (missing ADMIN_PASSWORD)." };
  }

  if (typeof password !== "string" || password !== secret) {
    return { error: "Incorrect password." };
  }

  const token = generateAuthToken(secret);
  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: COOKIE_MAX_AGE,
  });

  return { error: null };
}

export async function logoutAdmin(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(COOKIE_NAME);
}

export async function isAdminAuthenticated(): Promise<boolean> {
  const secret = getAdminSecret();
  if (!secret) return false;
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  return verifyAuthToken(token, secret);
}

