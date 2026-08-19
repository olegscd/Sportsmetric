"use client";

import { SeasonPicker } from "@/components/ui/SeasonPicker";
import { useSportsData } from "@/context/SportsDataContext";
import { isLifetimeSeason } from "@/lib/derivations";
import { cn } from "@/lib/utils";
import type { League } from "@/types/sports";
import { useState } from "react";

import { PlayerCard } from "./PlayerCard";

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

export function PlayerDirectory() {
  const { players, teams, seasons, currentSeasonId } = useSportsData();
  const [league, setLeague] = useState<League | "ALL">("UAAP");
  const [userSelectedSeasonId, setUserSelectedSeasonId] = useState<string | null>(null);
  const activeLeague: League = league === "ALL" ? "UAAP" : league;

  const targetSeasons = seasons.filter((s) => getSeasonLeague(s.id, s.league) === activeLeague);
  const activeCurrent = targetSeasons.find((s) => s.isCurrent)?.id ?? targetSeasons[0]?.id ?? currentSeasonId;
  const seasonId = userSelectedSeasonId && targetSeasons.some((s) => s.id === userSelectedSeasonId)
    ? userSelectedSeasonId
    : activeCurrent;

  function handleLeagueChange(newLeague: League | "ALL") {
    setLeague(newLeague);
    setUserSelectedSeasonId(null);
  }

  const teamsById = new Map(teams.map((t) => [t.id, t]));

  const filteredPlayers = players.filter((player) => {
    const team = teamsById.get(player.teamId);
    if (!team) return false;
    const matchesLeague = league === "ALL" || team.league === league;
    const matchesSeason = isLifetimeSeason(seasonId) || player.seasonId === seasonId;
    return matchesLeague && matchesSeason;
  });

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
          onChange={setUserSelectedSeasonId}
          league={activeLeague}
        />
      </div>


      {filteredPlayers.length === 0 ? (
        <p className="py-12 text-center text-sm text-muted">
          No players yet for this season. Add some from the Admin Dashboard.
        </p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {filteredPlayers.map((player) => {
            const team = teamsById.get(player.teamId);
            if (!team) return null;
            return (
              <PlayerCard
                key={player.id}
                player={player}
                team={team}
                variant="compact"
                showRankBadge={false}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}
