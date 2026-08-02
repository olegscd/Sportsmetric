import type { League, Season } from "@/types/sports";

/**
 * Infers the league for a season from its explicit `league` field,
 * falling back to an ID-prefix heuristic.
 *
 * This is the SINGLE SOURCE OF TRUTH for league inference —
 * do NOT duplicate the startsWith logic elsewhere.
 */
export function inferLeague(season: Pick<Season, "id" | "league">): League;
export function inferLeague(seasonId: string, league?: League): League;
export function inferLeague(
  seasonOrId: string | Pick<Season, "id" | "league">,
  league?: League
): League {
  if (typeof seasonOrId === "object") {
    if (seasonOrId.league) return seasonOrId.league;
    return inferLeagueFromId(seasonOrId.id);
  }
  if (league) return league;
  return inferLeagueFromId(seasonOrId);
}

function inferLeagueFromId(id: string): League {
  if (id.startsWith("pba")) return "PBA";
  if (id.startsWith("pvl")) return "PVL";
  return "UAAP";
}
