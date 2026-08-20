"use client";

import { SeasonPicker } from "@/components/ui/SeasonPicker";
import { useSportsData } from "@/context/SportsDataContext";
import { getEffectiveGameStatus, isLifetimeSeason } from "@/lib/derivations";
import { cn, formatFullDayHeader, formatGameDate } from "@/lib/utils";
import type { Game, League } from "@/types/sports";
import { useMemo, useState } from "react";





import { GameCard } from "./GameCard";

type GameStatusTab = "LIVE" | "UPCOMING" | "FINAL";

const STATUS_TABS: { value: GameStatusTab; label: string }[] = [
  { value: "LIVE", label: "Live" },
  { value: "UPCOMING", label: "Upcoming" },
  { value: "FINAL", label: "Final" },
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

function getSmartStatusTab(
  gamesList: Game[],
  targetSeasonId: string,
  targetLeague: League | "ALL",
  isOld: boolean
): GameStatusTab {
  if (isOld) return "FINAL";

  const relevant = gamesList.filter(
    (g) =>
      g.seasonId === targetSeasonId &&
      (targetLeague === "ALL" || g.league === targetLeague)
  );

  const hasLive = relevant.some((g) => getEffectiveGameStatus(g) === "LIVE");
  if (hasLive) return "LIVE";

  const hasUpcoming = relevant.some((g) => getEffectiveGameStatus(g) === "UPCOMING");
  if (hasUpcoming) return "UPCOMING";

  return "FINAL";
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

  const selectedSeason = seasons.find((s) => s.id === seasonId);
  const isOldSeason = selectedSeason ? !selectedSeason.isCurrent : seasonId !== currentSeasonId;

  // Initial smart default status based on active league & season games
  const [status, setStatus] = useState<GameStatusTab>(() =>
    getSmartStatusTab(games, activeCurrent, "UAAP", false)
  );
  const [teamId, setTeamId] = useState<string>("ALL");

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
      seasonGames.filter((game) => {
        const effectiveStatus = getEffectiveGameStatus(game);
        return (
          effectiveStatus === activeStatus &&
          (league === "ALL" || game.league === league) &&
          (teamId === "ALL" || game.homeTeam.id === teamId || game.awayTeam.id === teamId)
        );
      }),
    [seasonGames, activeStatus, league, teamId]
  );

  // Group and sort upcoming games chronologically by date
  const upcomingGrouped = useMemo(() => {
    if (activeStatus !== "UPCOMING") return null;

    const sorted = [...filteredGames].sort(
      (a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime()
    );

    const groups: { dateKey: string; dateLabel: string; games: Game[] }[] = [];
    const groupMap = new Map<string, { dateKey: string; dateLabel: string; games: Game[] }>();

    for (const game of sorted) {
      const dateKey = formatGameDate(game.startTime, true);
      const dateLabel = formatFullDayHeader(game.startTime) || dateKey;

      let group = groupMap.get(dateKey);
      if (!group) {
        group = { dateKey, dateLabel, games: [] };
        groupMap.set(dateKey, group);
        groups.push(group);
      }
      group.games.push(game);
    }

    return groups;
  }, [filteredGames, activeStatus]);

  function handleSeasonChange(newSeasonId: string) {

    setUserSelectedSeasonId(newSeasonId);
    setTeamId("ALL");
    const targetSeason = seasons.find((s) => s.id === newSeasonId);
    const isOld = targetSeason ? !targetSeason.isCurrent : false;
    const nextStatus = getSmartStatusTab(games, newSeasonId, league, isOld);
    setStatus(nextStatus);
  }

  function handleLeagueChange(newLeague: League | "ALL") {
    setLeague(newLeague);
    setTeamId("ALL");
    setUserSelectedSeasonId(null);

    const effLeague: League = newLeague === "ALL" ? "UAAP" : newLeague;
    const effSeasons = seasons.filter((s) => getSeasonLeague(s.id, s.league) === effLeague);
    const targetCurrent = effSeasons.find((s) => s.isCurrent)?.id ?? effSeasons[0]?.id ?? currentSeasonId;
    const targetSeason = seasons.find((s) => s.id === targetCurrent);
    const isOld = targetSeason ? !targetSeason.isCurrent : false;

    const nextStatus = getSmartStatusTab(games, targetCurrent, newLeague, isOld);
    setStatus(nextStatus);
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

      {/* PVL Live Coming Soon Banner */}
      {(league === "PVL" || activeLeague === "PVL") && activeStatus === "LIVE" ? (
        <div className="flex flex-col items-center justify-center rounded-3xl border border-border/80 bg-surface/70 backdrop-blur-sm p-8 text-center shadow-lg my-2">
          <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary border border-primary/20">
            <span className="text-3xl">🏐</span>
          </div>
          <h3 className="text-base font-bold text-foreground">
            PVL Live Scoring Coming Soon
          </h3>
          <p className="mt-2 max-w-md text-xs leading-relaxed text-muted">
            Official Premier Volleyball League match sheets and verified 14-player box scores are published upon match conclusion. Check the <strong className="text-foreground">Upcoming</strong> tab for scheduled fixtures or <strong className="text-foreground">Final</strong> for match reports.
          </p>
        </div>
      ) : filteredGames.length === 0 ? (
        <p className="py-12 text-center text-sm text-muted">
          No games match these filters.
        </p>
      ) : activeStatus === "UPCOMING" && upcomingGrouped ? (
        <div className="flex flex-col gap-6">
          {upcomingGrouped.map((group) => (
            <div key={group.dateKey} className="flex flex-col gap-2.5">
              {/* Date Header Badge */}
              <div className="flex items-center justify-between px-1">
                <div className="flex items-center gap-2">
                  <span className="flex h-2 w-2 rounded-full bg-primary" />
                  <h3 className="text-xs font-bold uppercase tracking-wider text-foreground">
                    {group.dateLabel}
                  </h3>
                </div>
                <span className="rounded-full bg-surface px-2.5 py-0.5 text-[10px] font-bold text-muted border border-border/50">
                  {group.games.length} {group.games.length === 1 ? "Match" : "Matches"}
                </span>
              </div>

              {/* Bunched Same-Day Match Cards */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {group.games.map((game) => (
                  <GameCard key={game.id} game={game} />
                ))}
              </div>
            </div>
          ))}
        </div>
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


