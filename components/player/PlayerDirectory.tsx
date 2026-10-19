"use client";

import { PAGE_FRAME } from "@/components/layout/page-shell";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorNotice } from "@/components/ui/ErrorNotice";
import { FilterChip } from "@/components/ui/FilterChip";
import { PageHeading } from "@/components/ui/PageHeading";
import { SearchInput } from "@/components/ui/SearchInput";
import { SeasonPicker } from "@/components/ui/SeasonPicker";
import { SkeletonCardGrid } from "@/components/ui/Skeleton";
import { useSportsData, useSportsScope } from "@/context/SportsDataContext";
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

  const { isPending: isSeasonPending } = useSportsScope(
    league === "ALL" ? "league=ALL" : `league=${league}&season=${encodeURIComponent(seasonId)}`
  );

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
        const matchesSeason = league === "ALL"
          ? seasons.some(season => season.id === player.seasonId && season.isCurrent)
          : isLifetimeSeason(seasonId) || player.seasonId === seasonId;
        return matchesLeague && matchesSeason;
      }),
    [players, teamsById, league, seasonId, seasons]
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

  const pageKey = `${league}|${seasonId}|${normalizedQuery}`;
  const [page, setPage] = useState({ key: pageKey, limit: 36 });
  const limit = page.key === pageKey ? page.limit : 36;

  function renderBody() {
    if (error && players.length === 0) {
      return <ErrorNotice message={error} onRetry={() => void refreshData()} />;
    }
    if (isSeasonPending || (loading && players.length === 0)) {
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
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
        {filteredPlayers.slice(0, limit).map((player) => {
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
    <div className={PAGE_FRAME}>
      <PageHeading title="The players behind the numbers." description="Explore rosters, compare season statistics, and follow every athlete’s career." />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="h-scroll flex gap-2 overflow-x-auto">
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
        {league === "ALL" ? <span className="text-xs text-muted">Current season in each league</span> : <SeasonPicker
          value={seasonId}
          onChange={setUserSelectedSeasonId}
          league={activeLeague}
        />}
      </div>

      <SearchInput
        value={query}
        onChange={setQuery}
        label="Search players"
        placeholder="Search players, teams, or jersey numbers"
      />

      {error && players.length > 0 ? (
        <ErrorNotice message={error} onRetry={() => void refreshData()} />
      ) : null}

      {!isSeasonPending && !loading && seasonPlayers.length > 0 ? (
        <p className="text-2xs font-medium text-muted" aria-live="polite">
          {filteredPlayers.length} of {seasonPlayers.length} players
        </p>
      ) : null}

      {renderBody()}
      {filteredPlayers.length > limit && (
        <Button
          type="button"
          variant="outline"
          className="w-full"
          onClick={() => setPage({ key: pageKey, limit: limit + 36 })}
        >
          Show more players
        </Button>
      )}
    </div>
  );
}
