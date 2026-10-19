import { getImageHosts } from "@/lib/image-policy";

export function buildContentSecurityPolicy(nonce: string, development = false): string {
  return [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${development ? " 'unsafe-eval'" : ""}`,
    "style-src 'self' 'unsafe-inline'",
    `img-src 'self' data: blob: ${getImageHosts().map(host => `https://${host}`).join(" ")}`,
    "font-src 'self' data:",
    `connect-src 'self' https: data: blob: wss://*.supabase.co${development ? " ws://localhost:* ws://127.0.0.1:*" : ""}`,
    "frame-ancestors 'none'", "base-uri 'self'", "form-action 'self'", "object-src 'none'",
  ].join("; ");
}
