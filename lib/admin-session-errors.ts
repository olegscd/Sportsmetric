/** Keep upstream database details out of sign-in responses. */
export function adminSessionError(code?: string, status?: number): string {
  if (code === "PGRST205" || code === "42P01") {
    return "Admin sign-in storage is not set up yet. Apply the admin-session database update and try again.";
  }
  if (code === "42501" || status === 401 || status === 403) {
    return "Admin sign-in cannot access its database. Check the deployment's Supabase service key.";
  }
  return "Admin sign-in is temporarily unavailable. Please try again.";
}
