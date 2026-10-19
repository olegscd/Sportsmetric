import type { MetadataRoute } from "next";
import { absoluteUrl } from "@/lib/seo";

export default function robots(): MetadataRoute.Robots {
  return {
    // Admin remains crawlable so its noindex directive can be read; login is protected by authentication.
    rules: { userAgent: "*", allow: "/", disallow: ["/api/"] },
    sitemap: absoluteUrl("/sitemap.xml"),
  };
}
