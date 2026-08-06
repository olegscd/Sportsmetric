"use client";

import { useSportsData } from "@/context/SportsDataContext";
import { LIFETIME_SEASON_ID } from "@/lib/derivations";
import type { League } from "@/types/sports";
import { ChevronDown } from "lucide-react";
import { useMemo } from "react";

function getSeasonLeague(sId: string, sLeague?: League): League {
  if (sLeague) return sLeague;
  if (sId.startsWith("pba")) return "PBA";
  if (sId.startsWith("pvl")) return "PVL";
  return "UAAP";
}

export function SeasonPicker({
  value,
  onChange,
  league = "UAAP",
  includeLifetime = true,
}: {
  value: string;
  onChange: (seasonId: string) => void;
  league?: League;
  includeLifetime?: boolean;
}) {
  const { seasons } = useSportsData();

  const filteredSeasons = useMemo(() => {
    return seasons.filter((s) => getSeasonLeague(s.id, s.league) === league);
  }, [seasons, league]);

  return (
    <label className="relative shrink-0">
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="appearance-none rounded-full border border-border bg-surface py-1.5 pl-3 pr-7 text-xs font-semibold text-foreground focus:border-primary focus:outline-none"
      >
        {includeLifetime && <option value={LIFETIME_SEASON_ID}>Lifetime</option>}
        {filteredSeasons.map((season) => (
          <option key={season.id} value={season.id}>
            {season.label}
          </option>
        ))}
      </select>
      <ChevronDown
        size={12}
        className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-muted"
      />
    </label>
  );
}
