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

/**
 * Total elimination (regular season) games per PVL season/conference.
 */
export const PVL_ELIMINATION_GAME_COUNTS: Array<{
  keys: string[];
  count: number;
}> = [
  // 2026
  { keys: ["2026 pvl on tour", "pvl-2026-on-tour", "pvl-2026-tour"], count: 30 },
  { keys: ["2026 all-filipino", "pvl-2026-afc", "pvl-2026-all-filipino"], count: 66 },

  // 2025
  { keys: ["2025 reinforced", "pvl-2025-reinforced"], count: 48 },
  { keys: ["2025 invitational", "pvl-2025-invitational"], count: 12 },
  { keys: ["2025 pvl on tour", "pvl-2025-on-tour", "pvl-2025-tour"], count: 30 },

  // 2024–2025
  {
    keys: [
      "2024–2025 all-filipino",
      "2024-2025 all-filipino",
      "2025-2026 all-filipino",
      "pvl-2024-2025-afc",
      "pvl-2025-2026-afc",
      "pvl-2025-2026-all-filipino",
      "pvl-2024-2025-all-filipino",
    ],
    count: 66,
  },

  // 2024
  { keys: ["2024 invitational", "pvl-2024-invitational"], count: 10 },
  { keys: ["2024 reinforced", "pvl-2024-reinforced"], count: 48 },
  { keys: ["2024 all-filipino", "pvl-2024-afc", "pvl-2024-all-filipino"], count: 66 },

  // 2023
  {
    keys: [
      "2023 all-filipino conference on tour",
      "2nd afc",
      "pvl-2023-2nd-afc",
      "pvl-2023-afc-on-tour",
      "pvl-2023-afc-tour",
    ],
    count: 66,
  },
  { keys: ["2023 invitational", "pvl-2023-invitational"], count: 25 },
  {
    keys: [
      "2023 all-filipino conference (1st afc)",
      "1st afc",
      "pvl-2023-1st-afc",
      "pvl-2023-afc",
      "pvl-2023-all-filipino",
    ],
    count: 36,
  },

  // 2022
  { keys: ["2022 reinforced", "pvl-2022-reinforced"], count: 36 },
  { keys: ["2022 invitational", "pvl-2022-invitational"], count: 21 },
  { keys: ["2022 open", "pvl-2022-open"], count: 16 },

  // 2021
  { keys: ["2021 open", "pvl-2021-open", "pvl-2021"], count: 45 },
];

export function getPvlEliminationGameCount(seasonIdOrName?: string): number {
  if (!seasonIdOrName) return 45;
  const s = seasonIdOrName.toLowerCase().trim();

  for (const entry of PVL_ELIMINATION_GAME_COUNTS) {
    if (entry.keys.some((k) => s.includes(k) || k.includes(s))) {
      return entry.count;
    }
  }

  if (s.includes("2026") && s.includes("tour")) return 30;
  if (s.includes("2026")) return 66;
  if (s.includes("2025") && s.includes("tour")) return 30;
  if (s.includes("2025") && s.includes("invitational")) return 12;
  if (s.includes("2025") && s.includes("reinforced")) return 48;
  if (s.includes("2025")) return 66;
  if (s.includes("2024") && s.includes("invitational")) return 10;
  if (s.includes("2024") && s.includes("reinforced")) return 48;
  if (s.includes("2024")) return 66;
  if (s.includes("2023") && (s.includes("tour") || s.includes("2nd"))) return 66;
  if (s.includes("2023") && s.includes("invitational")) return 25;
  if (s.includes("2023")) return 36;
  if (s.includes("2022") && s.includes("reinforced")) return 36;
  if (s.includes("2022") && s.includes("invitational")) return 21;
  if (s.includes("2022")) return 16;
  if (s.includes("2021")) return 45;

  return 45;
}
