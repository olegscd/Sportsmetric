"use client";

import { SeasonPicker } from "@/components/ui/SeasonPicker";
import { useSportsData } from "@/context/SportsDataContext";
import { isLifetimeSeason } from "@/lib/derivations";
import { cn } from "@/lib/utils";
import type { GameStatus, League } from "@/types/sports";
import { useMemo, useState } from "react";

import { GameCard } from "./GameCard";

const STATUS_TABS: { value: GameStatus | "ALL"; label: string }[] = [
  { value: "LIVE", label: "Live" },
  { value: "UPCOMING", label: "Upcoming" },
  { value: "FINAL", label: "Final" },
  { value: "ALL", label: "All" },
];

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

export function FilterTabs() {
  const { games, teams, seasons, currentSeasonId } = useSportsData();
  const [league, setLeague] = useState<League | "ALL">("UAAP");
  const [userSelectedSeasonId, setUserSelectedSeasonId] = useState<string | null>(null);
  const activeLeague: League = league === "ALL" ? "UAAP" : league;

  const targetSeasons = seasons.filter((s) => getSeasonLeague(s.id, s.league) === activeLeague);
  const activeCurrent = targetSeasons.find((s) => s.isCurrent)?.id ?? targetSeasons[0]?.id ?? currentSeasonId;
  const seasonId = userSelectedSeasonId && targetSeasons.some((s) => s.id === userSelectedSeasonId)
    ? userSelectedSeasonId
    : activeCurrent;

  const [status, setStatus] = useState<GameStatus | "ALL">("LIVE");
  const [teamId, setTeamId] = useState<string>("ALL");



  const selectedSeason = seasons.find((s) => s.id === seasonId);
  const isOldSeason = selectedSeason ? !selectedSeason.isCurrent : seasonId !== currentSeasonId;
  const activeStatus = isOldSeason ? "FINAL" : status;

  const seasonGames = useMemo(() => {
    if (!seasonId || isLifetimeSeason(seasonId)) return games;
    return games.filter((g) => g.seasonId === seasonId);
  }, [games, seasonId]);

  const availableTeams = useMemo(() => {
    const teamsInSeason = isLifetimeSeason(seasonId)
      ? teams
      : teams.filter((t) => t.seasonId === seasonId);
    if (league === "ALL") return teamsInSeason;
    return teamsInSeason.filter((t) => t.league === league);
  }, [teams, seasonId, league]);

  const filteredGames = useMemo(
    () =>
      seasonGames.filter(
        (game) =>
          (activeStatus === "ALL" || game.status === activeStatus) &&
          (league === "ALL" || game.league === league) &&
          (teamId === "ALL" || game.homeTeam.id === teamId || game.awayTeam.id === teamId)
      ),
    [seasonGames, activeStatus, league, teamId]
  );

  function handleSeasonChange(newSeasonId: string) {
    setUserSelectedSeasonId(newSeasonId);
    setTeamId("ALL");
    const targetSeason = seasons.find((s) => s.id === newSeasonId);
    if (targetSeason && !targetSeason.isCurrent) {
      setStatus("FINAL");
    } else if (status === "FINAL") {
      setStatus("LIVE");
    }
  }

  function handleLeagueChange(newLeague: League | "ALL") {
    setLeague(newLeague);
    setTeamId("ALL");
    setUserSelectedSeasonId(null);
  }


  return (
    <div className="flex flex-col gap-4 px-4 py-4">
      <div className="flex items-center justify-end">
        <SeasonPicker
          value={seasonId}
          onChange={handleSeasonChange}
          league={activeLeague}
          includeLifetime={false}
        />
      </div>

      {isOldSeason ? (
        <div className="flex items-center rounded-full bg-surface p-1">
          <button
            type="button"
            className="flex-1 rounded-full bg-primary py-1.5 text-xs font-semibold text-primary-foreground transition-colors"
          >
            Final
          </button>
        </div>
      ) : (
        <div className="flex items-center gap-1 rounded-full bg-surface p-1">
          {STATUS_TABS.map((tab) => (
            <button
              key={tab.value}
              type="button"
              onClick={() => setStatus(tab.value)}
              className={cn(
                "flex-1 rounded-full py-1.5 text-xs font-semibold transition-colors",
                activeStatus === tab.value
                  ? "bg-primary text-primary-foreground"
                  : "text-muted"
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>
      )}

      <div className="flex gap-2 overflow-x-auto">
        {LEAGUE_CHIPS.map((chip) => (
          <button
            key={chip.value}
            type="button"
            onClick={() => handleLeagueChange(chip.value)}
            className={cn(
              "shrink-0 rounded-full border px-3 py-1 text-xs font-semibold transition-colors",
              league === chip.value
                ? "border-primary text-primary"
                : "border-border text-muted"
            )}
          >
            {chip.label}
          </button>
        ))}
      </div>

      <div className="flex items-center gap-2">
        <label htmlFor="team-filter" className="text-xs font-medium text-muted">
          Team:
        </label>
        <select
          id="team-filter"
          value={teamId}
          onChange={(e) => setTeamId(e.target.value)}
          className="flex-1 rounded-xl border border-border bg-surface px-3 py-1.5 text-xs font-semibold text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
        >
          <option value="ALL">All Teams</option>
          {availableTeams.map((team) => (
            <option key={team.id} value={team.id}>
              {team.name} ({team.shortName})
            </option>
          ))}
        </select>
      </div>

      {filteredGames.length === 0 ? (
        <p className="py-12 text-center text-sm text-muted">
          No games match these filters.
        </p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {filteredGames.map((game) => (
            <GameCard key={game.id} game={game} />
          ))}
        </div>
      )}
    </div>
  );
}
