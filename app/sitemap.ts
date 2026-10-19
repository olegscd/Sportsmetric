import type { MetadataRoute } from "next";
import { absoluteUrl } from "@/lib/seo";
import { LEAGUE_PAGES } from "@/lib/leagues";
import { getPublishedNews } from "@/lib/news";
import { fetchPublicProfileIndex } from "@/lib/supabase-data";
import { getPublicUAAPData } from "@/lib/uaap-data";
import { indexableArchivePaths } from "@/lib/uaap-seo";

// Generate from current public data; don't freeze the URL inventory at build time.
export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [profiles, archive] = await Promise.all([fetchPublicProfileIndex(), getPublicUAAPData()]);
  const paths = ["/", "/news", "/standings", "/players", "/teams", "/uaap", "/about",
    ...LEAGUE_PAGES.map(league => `/leagues/${league.slug}`),
    ...profiles.teams.map(team => `/teams/${encodeURIComponent(team.id)}`),
    ...profiles.players.map(player => `/players/${encodeURIComponent(player.id)}`),
    ...indexableArchivePaths(archive)];
  return [...new Set(paths)].map(path => ({ url: absoluteUrl(path) })).concat(
    getPublishedNews().map(article => ({ url: absoluteUrl(`/news/${article.slug}`), lastModified: new Date(article.publishedAt) })),
  );
}
