"use client";

import { useSportsData } from "@/context/SportsDataContext";
import { LIFETIME_SEASON_ID } from "@/lib/derivations";
import { inferLeague } from "@/lib/league-utils";
import type { League } from "@/types/sports";
import { ChevronDown } from "lucide-react";
import { useMemo } from "react";

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
    return seasons.filter((s) => inferLeague(s) === league);
  }, [seasons, league]);

  return (
    <label className="relative shrink-0">
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="appearance-none rounded-full border border-border bg-surface py-1.5 pl-3 pr-7 text-xs font-semibold text-foreground transition-colors hover:border-primary/50 focus:border-primary focus:outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
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
