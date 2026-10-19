import { findSportMeta } from "@/components/uaap/sports-meta";
import { divisionExtra, normalizeDivision, sortDivisions, type MergedUAAPData } from "@/lib/uaap-schema";

type Search = Record<string, string | string[] | undefined>;
const scalar = (value: string | string[] | undefined) => Array.isArray(value) ? value[0] : value;

export function archivePath(sport: string, season?: string, division?: string, tab = "standings") {
  const query = new URLSearchParams({ sport });
  if (season) query.set("season", season);
  if (division) query.set("division", division);
  if (season && division) query.set("tab", tab);
  return `/uaap?${query}`;
}

/** Resolve the same selection as the archive UI, dropping tracking and invalid parameters. */
export function archiveSeo(data: MergedUAAPData, search: Search) {
  const base = { title: "UAAP Historical Standings, Awards & Statistics", description: "Explore historical UAAP standings, champions, awards and published statistical leaders by sport, season and division, with source-review status and coverage notes.", path: "/uaap", index: true };
  const sport = findSportMeta(scalar(search.sport) ?? null)?.name;
  if (!sport) return base;
  const scopes = data.tables.map(({ season, sport, division }) => ({ season, sport, division }));
  for (const kind of ["awards", "chess_medalists", "leaderboards"] as const) {
    for (const [key, divisions] of Object.entries(data.extras[kind] ?? {})) {
      const [sport, season] = key.split("|");
      for (const division of Object.keys(divisions)) scopes.push({ sport, season, division: normalizeDivision(division) });
    }
  }
  const sportScopes = scopes.filter(scope => scope.sport === sport);
  const summary = { ...base, title: `UAAP ${sport} Historical Results & Statistics`, path: archivePath(sport), index: sportScopes.length > 0 };
  const season = sportScopes.find(scope => scope.season === scalar(search.season))?.season;
  if (!season) return summary;
  const divisions = sortDivisions(sportScopes.filter(scope => scope.season === season).map(scope => scope.division));
  const division = divisions.find(division => normalizeDivision(division) === normalizeDivision(scalar(search.division) ?? "")) ?? divisions[0];
  if (!division) return summary;
  const table = data.tables.find(table => table.sport === sport && table.season === season && table.division === division);
  const key = `${sport}|${season}`;
  const awards = divisionExtra(data.extras.awards?.[key], division) || divisionExtra(data.extras.chess_medalists?.[key], division);
  const leaders = divisionExtra(data.extras.leaderboards?.[key], division);
  const tabs = [...(table ? ["standings"] : []), ...(awards ? ["awards"] : []), ...(leaders ? ["leaders"] : [])];
  const requestedTab = scalar(search.tab) ?? "standings";
  const tab = tabs.includes(requestedTab) ? requestedTab : tabs[0] ?? "standings";
  const verified = tab === "standings" ? table?.review?.status === "verified" && table.rows.length > 0 : Boolean(tab === "awards" ? awards : leaders);
  return {
    title: `${season} UAAP ${sport} ${division} ${tab === "standings" ? "Standings" : tab === "awards" ? "Awards" : "Statistical Leaders"}`,
    description: `${season} UAAP ${sport}, ${division}: ${tab}, original-source references and coverage notes. ${verified ? "Source-checked records" : "Source review is pending; this record is not certified"} on Sportsmetric.`,
    path: archivePath(sport, season, division, tab), index: Boolean(verified),
  };
}

export function indexableArchivePaths(data: MergedUAAPData): string[] {
  const paths = new Set<string>();
  for (const table of data.tables) {
    if (table.review?.status === "verified" && table.rows.length) paths.add(archivePath(table.sport, table.season, table.division));
  }
  for (const kind of ["awards", "chess_medalists", "leaderboards"] as const) {
    for (const [key, divisions] of Object.entries(data.extras[kind] ?? {})) {
      const [sport, season] = key.split("|");
      for (const division of Object.keys(divisions)) paths.add(archivePath(sport, season, normalizeDivision(division), kind === "leaderboards" ? "leaders" : "awards"));
    }
  }
  return [...paths];
}
