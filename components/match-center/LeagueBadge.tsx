import { leagueLabel } from "@/lib/utils";
import type { League } from "@/types/sports";

const LEAGUE_COLOR_VAR: Record<League, string> = {
  UAAP: "var(--color-league-uaap)",
  PBA: "var(--color-league-pba)",
  PVL: "var(--color-league-pvl)",
};

export function LeagueBadge({ league }: { league: League }) {
  return (
    <span
      className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-bg"
      style={{ backgroundColor: LEAGUE_COLOR_VAR[league] }}
    >
      {leagueLabel(league)}
    </span>
  );
}
