"use client";

import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorNotice } from "@/components/ui/ErrorNotice";
import { FilterChip, SegmentedControl } from "@/components/ui/FilterChip";
import { SeasonPicker } from "@/components/ui/SeasonPicker";
import { SkeletonCardGrid } from "@/components/ui/Skeleton";
import { useSportsData } from "@/context/SportsDataContext";
import { getEffectiveGameStatus, isLifetimeSeason } from "@/lib/derivations";
import { inferLeague } from "@/lib/league-utils";
import { formatFullDayHeader, formatGameDate } from "@/lib/utils";
import type { Game, League } from "@/types/sports";
import { Radio } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
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
  const { games, teams, seasons, currentSeasonId, loading, error, refreshData } = useSportsData();
  const [league, setLeague] = useState<League | "ALL">("UAAP");
  const [userSelectedSeasonId, setUserSelectedSeasonId] = useState<string | null>(null);
  const activeLeague: League = league === "ALL" ? "UAAP" : league;

  const targetSeasons = seasons.filter((s) => inferLeague(s) === activeLeague);
  const activeCurrent = targetSeasons.find((s) => s.isCurrent)?.id ?? targetSeasons[0]?.id ?? currentSeasonId;
  const seasonId = userSelectedSeasonId && targetSeasons.some((s) => s.id === userSelectedSeasonId)
    ? userSelectedSeasonId
    : activeCurrent;

  const selectedSeason = seasons.find((s) => s.id === seasonId);
  const isOldSeason = selectedSeason ? !selectedSeason.isCurrent : seasonId !== currentSeasonId;

  const [status, setStatus] = useState<GameStatusTab>("FINAL");
  const [teamId, setTeamId] = useState<string>("ALL");
  const statusTouched = useRef(false);

  const activeStatus = isOldSeason ? "FINAL" : status;

  useEffect(() => {
    if (statusTouched.current) return;
    setStatus(getSmartStatusTab(games, seasonId, league, isOldSeason));
  }, [games, seasonId, league, isOldSeason]);

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
    statusTouched.current = false;
    setStatus(getSmartStatusTab(games, newSeasonId, league, isOld));
  }

  function handleLeagueChange(newLeague: League | "ALL") {
    setLeague(newLeague);
    setTeamId("ALL");
    setUserSelectedSeasonId(null);

    const effLeague: League = newLeague === "ALL" ? "UAAP" : newLeague;
    const effSeasons = seasons.filter((s) => inferLeague(s) === effLeague);
    const targetCurrent = effSeasons.find((s) => s.isCurrent)?.id ?? effSeasons[0]?.id ?? currentSeasonId;
    const targetSeason = seasons.find((s) => s.id === targetCurrent);
    const isOld = targetSeason ? !targetSeason.isCurrent : false;
    statusTouched.current = false;
    setStatus(getSmartStatusTab(games, targetCurrent, newLeague, isOld));
  }

  const showPvlLivePlaceholder =
    (league === "PVL" || (league === "ALL" && activeLeague === "PVL")) &&
    activeStatus === "LIVE" &&
    filteredGames.length === 0;

  function renderBody() {
    if (error && games.length === 0) {
      return <ErrorNotice message={error} onRetry={() => void refreshData()} />;
    }
    if (loading && games.length === 0) {
      return <SkeletonCardGrid count={6} />;
    }
    if (showPvlLivePlaceholder) {
      return (
        <EmptyState
          icon={<Radio size={22} aria-hidden="true" />}
          title="PVL live scoring coming soon"
          description="Official Premier Volleyball League box scores are published after the match. Check Upcoming for fixtures or Final for completed reports."
        />
      );
    }
    if (filteredGames.length === 0) {
      return (
        <EmptyState
          icon={<Radio size={22} aria-hidden="true" />}
          title="No games match these filters"
          description="Try another status, league, team, or season."
        />
      );
    }
    if (activeStatus === "UPCOMING" && upcomingGrouped) {
      return (
        <div className="flex flex-col gap-6">
          {upcomingGrouped.map((group) => (
            <div key={group.dateKey} className="flex flex-col gap-2.5">
              <div className="flex items-center justify-between px-1">
                <div className="flex items-center gap-2">
                  <span className="flex h-2 w-2 rounded-full bg-primary" />
                  <h3 className="text-xs font-bold uppercase tracking-wider text-foreground">
                    {group.dateLabel}
                  </h3>
                </div>
                <span className="rounded-full border border-border/50 bg-surface px-2.5 py-0.5 text-[10px] font-bold text-muted">
                  {group.games.length} {group.games.length === 1 ? "Match" : "Matches"}
                </span>
              </div>
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
                {group.games.map((game) => (
                  <GameCard key={game.id} game={game} />
                ))}
              </div>
            </div>
          ))}
        </div>
      );
    }
    return (
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
        {filteredGames.map((game) => (
          <GameCard key={game.id} game={game} />
        ))}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 px-4 py-4">
      <div className="flex items-end justify-between gap-3">
        <div className="hidden md:block">
          <h1 className="text-lg font-extrabold tracking-tight text-foreground">Match Center</h1>
          <p className="text-xs text-muted">Live scores and upcoming fixtures</p>
        </div>
        <SeasonPicker
          value={seasonId}
          onChange={handleSeasonChange}
          league={activeLeague}
          includeLifetime={false}
        />
      </div>

      {isOldSeason ? (
        <SegmentedControl
          options={[{ value: "FINAL", label: "Final" }]}
          value="FINAL"
          onChange={() => undefined}
        />
      ) : (
        <SegmentedControl
          options={STATUS_TABS}
          value={activeStatus}
          onChange={(value) => {
            statusTouched.current = true;
            setStatus(value);
          }}
        />
      )}

      <div className="flex gap-2 overflow-x-auto pb-0.5">
        {LEAGUE_CHIPS.map((chip) => (
          <FilterChip
            key={chip.value}
            selected={league === chip.value}
            onClick={() => handleLeagueChange(chip.value)}
          >
            {chip.label}
          </FilterChip>
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
          className="flex-1 rounded-xl border border-border bg-surface px-3 py-1.5 text-xs font-semibold text-foreground focus:outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
        >
          <option value="ALL">All Teams</option>
          {availableTeams.map((team) => (
            <option key={team.id} value={team.id}>
              {team.name} ({team.shortName})
            </option>
          ))}
        </select>
      </div>

      {renderBody()}
    </div>
  );
}
