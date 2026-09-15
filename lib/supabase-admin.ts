import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Service-role Supabase client. Bypasses RLS, so it must never be constructed
 * in the browser -- `SUPABASE_SERVICE_ROLE_KEY` is deliberately not prefixed
 * with NEXT_PUBLIC_ so it is stripped from the client bundle.
 */

let cached: SupabaseClient | null | undefined;

export function getServiceSupabase(): SupabaseClient | null {
  if (typeof window !== "undefined") return null;
  if (cached !== undefined) return cached;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRoleKey) {
    if (!serviceRoleKey) {
      console.warn(
        "[Sportsmetric DB] SUPABASE_SERVICE_ROLE_KEY is not set. Admin writes will fall back to the anon key and will be rejected by RLS."
      );
    }
    cached = null;
    return cached;
  }

  cached = createClient(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return cached;
}

export function hasServiceRoleAccess(): boolean {
  return getServiceSupabase() !== null;
}
