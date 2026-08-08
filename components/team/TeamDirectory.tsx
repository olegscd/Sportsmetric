"use client";

import { SeasonPicker } from "@/components/ui/SeasonPicker";
import { TeamBadge } from "@/components/ui/TeamBadge";
import { useSportsData } from "@/context/SportsDataContext";
import type { DerivedTeamStandings } from "@/lib/derivations";
import { cn, formatRecord } from "@/lib/utils";
import type { League } from "@/types/sports";
import Link from "next/link";
import { useEffect, useState } from "react";

const LEAGUE_CHIPS: { value: League | "ALL"; label: string }[] = [
  { value: "UAAP", label: "UAAP" },
  { value: "PBA", label: "PBA" },
  { value: "PVL", label: "PVL" },
  { value: "ALL", label: "All Leagues" },
];

function getSeasonLeague(sId: string, sLeague?: League): League {
  if (sLeague) return sLeague;
  if (sId.startsWith("pba")) return "PBA";
  if (sId.startsWith("pvl")) return "PVL";
  return "UAAP";
}

export function TeamDirectory() {
  const { currentSeasonId, seasons, getStandings } = useSportsData();
  const [league, setLeague] = useState<League | "ALL">("UAAP");
  const activeLeague: League = league === "ALL" ? "UAAP" : league;

  const [seasonId, setSeasonId] = useState<string>(() => {
    const targetSeasons = seasons.filter((s) => getSeasonLeague(s.id, s.league) === "UAAP");
    return targetSeasons.find((s) => s.isCurrent)?.id ?? targetSeasons[0]?.id ?? currentSeasonId;
  });

  useEffect(() => {
    const targetSeasons = seasons.filter((s) => getSeasonLeague(s.id, s.league) === activeLeague);
    const activeCurrent = targetSeasons.find((s) => s.isCurrent)?.id ?? targetSeasons[0]?.id;
    if (activeCurrent) {
      setSeasonId(activeCurrent);
    }
  }, [activeLeague, seasons]);

  function handleLeagueChange(newLeague: League | "ALL") {
    setLeague(newLeague);
  }

  const leagues: League[] = league === "ALL" ? ["UAAP", "PBA", "PVL"] : [league];
  const standings: DerivedTeamStandings[] = leagues.flatMap((l) => getStandings(l, seasonId));

  return (
    <div className="flex flex-col gap-4 px-4 py-4">
      <div className="flex items-center justify-between gap-2">
        <div className="flex gap-2 overflow-x-auto">
          {LEAGUE_CHIPS.map((chip) => (
            <button
              key={chip.value}
              type="button"
              onClick={() => handleLeagueChange(chip.value)}
              className={cn(
                "shrink-0 rounded-full border px-3 py-1 text-xs font-semibold transition-colors",
                league === chip.value ? "border-primary text-primary" : "border-border text-muted"
              )}
            >
              {chip.label}
            </button>
          ))}
        </div>
        <SeasonPicker
          value={seasonId}
          onChange={setSeasonId}
          league={activeLeague}
        />
      </div>

      {standings.length === 0 ? (
        <p className="py-12 text-center text-sm text-muted">
          No teams yet for this season. Add some from the Admin Dashboard.
        </p>
      ) : (
        <div className="flex flex-col gap-2.5">
          {standings.map((item, index) => {
            const team = item.team;
            const record = { wins: item.wins, losses: item.losses };
            const pctStr = item.winPct.toFixed(3).replace(/^0/, "");
            return (
              <Link
                key={team.id}
                href={`/teams/${team.id}`}
                className="flex items-center gap-3 rounded-2xl border border-stone-300/60 bg-[#F4EBD9] p-3 shadow-sm active:scale-[0.99] transition-transform"
              >
                <span className="w-4 shrink-0 text-center text-xs font-extrabold text-zinc-600">
                  {index + 1}
                </span>
                <TeamBadge team={team} size="md" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-bold text-zinc-900">{team.name}</p>
                  <p className="truncate text-xs font-semibold text-zinc-600">
                    {team.league} &middot; {formatRecord(record)}
                  </p>
                </div>
                <span className="shrink-0 text-xs font-bold tabular-nums text-zinc-800">
                  {pctStr}
                </span>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
