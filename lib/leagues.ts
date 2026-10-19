import type { League } from "@/types/sports";

export const LEAGUE_PAGES = [
  { slug: "uaap", league: "UAAP" as League, name: "University Athletic Association of the Philippines", sport: "Basketball",
    description: "UAAP basketball scores, schedules, elimination-round standings and player statistics. Follow collegiate teams and explore the multi-sport historical archive." },
  { slug: "pba", league: "PBA" as League, name: "Philippine Basketball Association", sport: "Basketball",
    description: "PBA basketball scores, game results, schedules, standings and player statistics from the seasons available on Sportsmetric." },
  { slug: "pvl", league: "PVL" as League, name: "Premier Volleyball League", sport: "Volleyball",
    description: "PVL volleyball scores, match results, schedules, team standings and player statistics from the conferences available on Sportsmetric." },
];

export function findLeaguePage(slug: string) {
  return LEAGUE_PAGES.find(league => league.slug === slug);
}
