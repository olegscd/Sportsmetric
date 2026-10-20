import type { League, Season } from "@/types/sports";

/**
 * A season is "in progress" when it is the league's current (default) season
 * or an editor has marked it active, e.g. UAAP U16 running alongside Men's.
 * Everything else is archived: read-only results, Final tab only.
 */
export function isSeasonInProgress(season: Pick<Season, "isCurrent" | "isActive"> | undefined | null): boolean {
  return Boolean(season && (season.isCurrent || season.isActive));
}

/** In-progress seasons of a league, current first, then admin order. */
export function inProgressSeasons(seasons: Season[], league: League): Season[] {
  return seasons.filter(s => s.league === league && isSeasonInProgress(s))
    .sort((a, b) => Number(b.isCurrent) - Number(a.isCurrent));
}
