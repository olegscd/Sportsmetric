import type { NextConfig } from "next";

/**
 * Only the small markdown/JSON archive files are needed at runtime. Without
 * these rules Turbopack traces the whole dynamic `data/seasons` tree (photos,
 * PDFs, generated books), which is gigabytes on a local checkout.
 */
const nextConfig: NextConfig = {
  allowedDevOrigins: ["127.0.0.1"],

  outputFileTracingIncludes: {
    "/admin": ["./data/seasons/**/*.md"],
    "/uaap": ["./data/*.json"],
    "/api/uaap/data": ["./data/*.json", "./data/seasons/**/*.md"],
  },
  outputFileTracingExcludes: {
    "/**": [
      "./data/seasons/**/raw_photos/**",
      "./data/seasons/**/*.pdf",
      "./data/seasons/**/*.html",
      "./data/compiled/**",
      "./scratch/**",
      "./PVL stats/**",
    ],
  },

  async headers() {
    const isDev = process.env.NODE_ENV !== "production";
    const connectSources = [
      "'self'",
      // Supabase REST + Realtime, and the admin-entered photo hosts that
      // StatCardExport fetches before rasterizing the share card.
      "https:",
      "data:",
      "blob:",
      "wss://*.supabase.co",
      ...(isDev ? ["ws://localhost:*", "ws://127.0.0.1:*"] : []),
    ].join(" ");

    const contentSecurityPolicy = [
      "default-src 'self'",
      `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""}`,
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob: https:",
      "font-src 'self' data:",
      `connect-src ${connectSources}`,
      "frame-ancestors 'none'",
      "base-uri 'self'",
      "form-action 'self'",
      "object-src 'none'",
    ].join("; ");

    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
          { key: "Content-Security-Policy", value: contentSecurityPolicy },
        ],
      },
    ];
  },
};

export default nextConfig;
