"use client";

import { FilterChip } from "@/components/ui/FilterChip";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorNotice } from "@/components/ui/ErrorNotice";
import { SearchInput } from "@/components/ui/SearchInput";
import { SeasonPicker } from "@/components/ui/SeasonPicker";
import { SkeletonCardGrid } from "@/components/ui/Skeleton";
import { useSportsData } from "@/context/SportsDataContext";
import { isLifetimeSeason } from "@/lib/derivations";
import { inferLeague } from "@/lib/league-utils";
import type { League } from "@/types/sports";
import { Users } from "lucide-react";
import { useMemo, useState } from "react";

import { PlayerCard } from "./PlayerCard";

const LEAGUE_CHIPS: { value: League | "ALL"; label: string }[] = [
  { value: "UAAP", label: "UAAP" },
  { value: "PBA", label: "PBA" },
  { value: "PVL", label: "PVL" },
  { value: "ALL", label: "All Leagues" },
];

export function PlayerDirectory() {
  const { players, teams, seasons, currentSeasonId, loading, error, refreshData } = useSportsData();
  const [league, setLeague] = useState<League | "ALL">("UAAP");
  const [query, setQuery] = useState("");
  const [userSelectedSeasonId, setUserSelectedSeasonId] = useState<string | null>(null);
  const activeLeague: League = league === "ALL" ? "UAAP" : league;

  const targetSeasons = seasons.filter((s) => inferLeague(s) === activeLeague);
  const activeCurrent = targetSeasons.find((s) => s.isCurrent)?.id ?? targetSeasons[0]?.id ?? currentSeasonId;
  const seasonId = userSelectedSeasonId && targetSeasons.some((s) => s.id === userSelectedSeasonId)
    ? userSelectedSeasonId
    : activeCurrent;

  function handleLeagueChange(newLeague: League | "ALL") {
    setLeague(newLeague);
    setUserSelectedSeasonId(null);
  }

  const teamsById = useMemo(() => new Map(teams.map((t) => [t.id, t])), [teams]);

  const seasonPlayers = useMemo(
    () =>
      players.filter((player) => {
        const team = teamsById.get(player.teamId);
        if (!team) return false;
        const matchesLeague = league === "ALL" || team.league === league;
        const matchesSeason = isLifetimeSeason(seasonId) || player.seasonId === seasonId;
        return matchesLeague && matchesSeason;
      }),
    [players, teamsById, league, seasonId]
  );

  const normalizedQuery = query.trim().toLowerCase();
  const filteredPlayers = useMemo(() => {
    if (!normalizedQuery) return seasonPlayers;
    return seasonPlayers.filter((player) => {
      const team = teamsById.get(player.teamId);
      return (
        player.name.toLowerCase().includes(normalizedQuery) ||
        team?.name.toLowerCase().includes(normalizedQuery) ||
        team?.shortName.toLowerCase().includes(normalizedQuery) ||
        String(player.jerseyNumber) === normalizedQuery
      );
    });
  }, [seasonPlayers, teamsById, normalizedQuery]);

  function renderBody() {
    if (error && players.length === 0) {
      return <ErrorNotice message={error} onRetry={() => void refreshData()} />;
    }
    if (loading && players.length === 0) {
      return <SkeletonCardGrid count={6} height="h-24" />;
    }
    if (seasonPlayers.length === 0) {
      return (
        <EmptyState
          icon={<Users size={22} aria-hidden="true" />}
          title="No players for this season yet"
          description="Rosters appear here once the season's player data has been published. Try another league or season."
        />
      );
    }
    if (filteredPlayers.length === 0) {
      return (
        <EmptyState
          icon={<Users size={22} aria-hidden="true" />}
          title={`No players match "${query.trim()}"`}
          description="Search by player name, team, or jersey number."
        />
      );
    }
    return (
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
    );
  }

  return (
    <div className="flex flex-col gap-4 px-4 py-4">
      <div className="hidden md:block">
        <h1 className="text-lg font-extrabold tracking-tight text-foreground">Players</h1>
        <p className="text-xs text-muted">Search rosters across UAAP, PBA, and PVL</p>
      </div>

      <div className="flex items-center justify-between gap-2">
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
        <SeasonPicker
          value={seasonId}
          onChange={setUserSelectedSeasonId}
          league={activeLeague}
        />
      </div>

      <SearchInput
        value={query}
        onChange={setQuery}
        label="Search players"
        placeholder="Search players, teams, or jersey numbers"
      />

      {!loading && seasonPlayers.length > 0 ? (
        <p className="text-[11px] font-semibold uppercase tracking-wide text-muted">
          {filteredPlayers.length} of {seasonPlayers.length} players
        </p>
      ) : null}

      {renderBody()}
    </div>
  );
}
