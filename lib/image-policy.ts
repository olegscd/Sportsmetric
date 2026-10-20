/** Exact hosts shared by validation, avatars, CSP, and Next's image cache. */
export function getImageHosts(): string[] {
  const hosts = ["pba-api01.actech2.com", "pba.ph", "www.pba.ph", "uaap.livestats.ph", "i.ytimg.com",
    ...(process.env.NEXT_PUBLIC_IMAGE_HOSTS ?? "").split(",").map(host => host.trim().toLowerCase()).filter(Boolean)];
  try {
    if (process.env.NEXT_PUBLIC_SUPABASE_URL) hosts.push(new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).hostname);
  } catch { /* Invalid configuration is handled by the Supabase client. */ }
  return [...new Set(hosts)];
}

export function safeImageSource(raw: string | null | undefined): string | null {
  const value = raw?.trim();
  if (!value) return null;
  if (value.startsWith("/") && !value.startsWith("//") && !value.includes("\\")) return value;
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" || url.username || url.password || url.port) return null;
    return getImageHosts().includes(url.hostname) ? url.toString() : null;
  } catch { return null; }
}
