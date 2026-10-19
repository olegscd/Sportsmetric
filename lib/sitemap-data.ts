import { absoluteUrl } from "@/lib/seo";
import { LEAGUE_PAGES } from "@/lib/leagues";
import { getPublishedNews } from "@/lib/news";
import { INTERNATIONAL_LAUNCHED, athletePath } from "@/lib/international";
import { fetchPublicAthleteIds } from "@/lib/international-data";
import { fetchPublicProfileIndex } from "@/lib/supabase-data";
import { getPublicUAAPData } from "@/lib/uaap-data";
import { indexableArchivePaths } from "@/lib/uaap-seo";

export async function buildSitemap() {
  const [profiles, archive, athletes] = await Promise.all([fetchPublicProfileIndex(), getPublicUAAPData(),
    INTERNATIONAL_LAUNCHED ? fetchPublicAthleteIds() : Promise.resolve([])]);
  const paths = ["/", "/news", "/standings", "/players", "/teams", "/uaap", "/about",
    ...LEAGUE_PAGES.map(league => `/leagues/${league.slug}`),
    ...profiles.teams.map(team => `/teams/${encodeURIComponent(team.id)}`),
    ...profiles.players.map(player => `/players/${encodeURIComponent(player.id)}`),
    ...indexableArchivePaths(archive),
    ...(INTERNATIONAL_LAUNCHED && athletes.length ? ["/international", ...athletes.map(athletePath)] : [])];
  return [...new Set(paths)].map(path => ({ url: absoluteUrl(path) })).concat(
    getPublishedNews().map(article => ({ url: absoluteUrl(`/news/${article.slug}`), lastModified: new Date(article.publishedAt) })),
  );
}
