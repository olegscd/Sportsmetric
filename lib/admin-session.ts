import crypto from "node:crypto";
import { ADMIN_COOKIE_MAX_AGE, hashSessionToken } from "@/lib/admin-token";
import { getServiceSupabase } from "@/lib/supabase-admin";

export async function createAdminSession(): Promise<string> {
  const db = getServiceSupabase();
  if (!db) throw new Error("Admin session storage is not configured.");
  const token = crypto.randomBytes(32).toString("hex");
  const { error } = await db.from("admin_sessions").insert({
    id: hashSessionToken(token),
    expires_at: new Date(Date.now() + ADMIN_COOKIE_MAX_AGE * 1000).toISOString(),
  });
  if (error) throw new Error("Could not create an admin session. Apply the session migration.");
  return token;
}

export async function verifyAdminSession(token: string | undefined): Promise<boolean> {
  if (!token || !/^[a-f0-9]{64}$/.test(token)) return false;
  const db = getServiceSupabase();
  if (!db) return false;
  try {
    const { data, error } = await db.from("admin_sessions")
      .select("id").eq("id", hashSessionToken(token))
      .gt("expires_at", new Date().toISOString()).maybeSingle();
    return !error && Boolean(data);
  } catch {
    return false;
  }
}

export async function revokeAdminSession(token: string | undefined): Promise<void> {
  if (!token || !/^[a-f0-9]{64}$/.test(token)) return;
  const db = getServiceSupabase();
  if (!db) throw new Error("Admin session storage is not configured.");
  const { error } = await db.from("admin_sessions").delete().eq("id", hashSessionToken(token));
  if (error) throw new Error("Could not revoke the session. Please try logging out again.");
}
