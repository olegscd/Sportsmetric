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
        aria-label="Season"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="min-h-11 max-w-[min(70vw,22rem)] appearance-none rounded-control border border-border bg-elevated py-2.5 pl-3 pr-8 text-xs font-semibold text-foreground transition-colors duration-150 ease-standard hover:border-border-strong focus:border-primary/70 focus:outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
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
        aria-hidden="true"
        className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-muted"
      />
    </label>
  );
}
