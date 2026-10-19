import { buildSitemap } from "@/lib/sitemap-data";
import { sitemapXml } from "@/lib/sitemap-xml";

export const dynamic = "force-dynamic";

export async function GET() {
  return new Response(sitemapXml(await buildSitemap()), { headers: { "Content-Type": "application/xml; charset=utf-8" } });
}
