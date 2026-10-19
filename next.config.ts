import type { NextConfig } from "next";
import { getImageHosts } from "./lib/image-policy";

/**
 * Only the small markdown/JSON archive files are needed at runtime. Without
 * these rules Turbopack traces the whole dynamic `data/seasons` tree (photos,
 * PDFs, generated books), which is gigabytes on a local checkout.
 */
const nextConfig: NextConfig = {
  allowedDevOrigins: ["127.0.0.1"],
  images: {
    remotePatterns: getImageHosts().map(hostname => ({ protocol: "https" as const, hostname, port: "", pathname: "/**" })),
    maximumRedirects: 0,
    dangerouslyAllowLocalIP: false,
  },

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
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
        ],
      },
    ];
  },
};

export default nextConfig;
