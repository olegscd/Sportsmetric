"use client";

import { isSeasonInProgress } from "@/lib/season-status";
import { PAGE_FRAME } from "@/components/layout/page-shell";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorNotice } from "@/components/ui/ErrorNotice";
import { Field, Input, Select } from "@/components/ui/Field";
import { FilterChip, SegmentedControl } from "@/components/ui/FilterChip";
import { SeasonPicker } from "@/components/ui/SeasonPicker";
import { SearchInput } from "@/components/ui/SearchInput";
import { SkeletonCardGrid } from "@/components/ui/Skeleton";
import { useSportsData, useSportsScope } from "@/context/SportsDataContext";
import { getEffectiveGameStatus, isLifetimeSeason } from "@/lib/derivations";
import { inferLeague } from "@/lib/league-utils";
import { formatFullDayHeader, formatGameDate, isoToPhtInput } from "@/lib/utils";
import type { Game, League } from "@/types/sports";
import {
  CalendarDays,
  CheckCheck,
  Radio,
  RefreshCw,
  SlidersHorizontal,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { GameCard } from "./GameCard";

type GameStatusTab = "LIVE" | "UPCOMING" | "FINAL";

const STATUS_TABS: { value: GameStatusTab; label: string }[] = [
  { value: "LIVE", label: "Live" },
  { value: "UPCOMING", label: "Upcoming" },
  { value: "FINAL", label: "Final" },
];

const LEAGUE_CHIPS: { value: League; label: string; dotColor: string }[] = [
  { value: "UAAP", label: "UAAP", dotColor: "var(--color-league-uaap)" },
  { value: "PBA", label: "PBA", dotColor: "var(--color-league-pba)" },
  { value: "PVL", label: "PVL", dotColor: "var(--color-league-pvl)" },
];

const HERO_ACCENT: Record<League, string> = {
  UAAP: "radial-gradient(ellipse 70% 60% at 100% 0%, rgb(204 0 0 / 0.16), transparent 62%)",
  PBA: "radial-gradient(ellipse 70% 60% at 100% 0%, rgb(247 148 29 / 0.16), transparent 62%)",
  PVL: "radial-gradient(ellipse 70% 60% at 100% 0%, rgb(0 102 204 / 0.18), transparent 62%)",
};

function getSmartStatusTab(
  gamesList: Game[],
  targetSeasonId: string,
  targetLeague: League,
  isOld: boolean
): GameStatusTab {
  if (isOld) return "FINAL";

  const relevant = gamesList.filter(
    (g) => g.seasonId === targetSeasonId && g.league === targetLeague
  );

  const hasLive = relevant.some((g) => getEffectiveGameStatus(g) === "LIVE");
  if (hasLive) return "LIVE";

  const hasUpcoming = relevant.some((g) => getEffectiveGameStatus(g) === "UPCOMING");
  if (hasUpcoming) return "UPCOMING";

  return "FINAL";
}

export function FilterTabs() {
  const { games, teams, seasons, currentSeasonId, loading, error, refreshData } = useSportsData();
  const [league, setLeague] = useState<League>("UAAP");
  const [userSelectedSeasonId, setUserSelectedSeasonId] = useState<string | null>(null);

  const targetSeasons = seasons.filter((s) => inferLeague(s) === league);
  const activeCurrent = targetSeasons.find((s) => s.isCurrent)?.id ?? targetSeasons[0]?.id ?? currentSeasonId;
  const seasonId = userSelectedSeasonId && targetSeasons.some((s) => s.id === userSelectedSeasonId)
    ? userSelectedSeasonId
    : activeCurrent;

  const { isPending: isSeasonPending } = useSportsScope(
    `league=${league}&season=${encodeURIComponent(seasonId)}`
  );

  const selectedSeason = seasons.find((s) => s.id === seasonId);

  const [status, setStatus] = useState<GameStatusTab>("FINAL");
  const [teamId, setTeamId] = useState<string>("ALL");
  const [query, setQuery] = useState("");
  const [date, setDate] = useState("");
  const [sort, setSort] = useState<"default" | "oldest" | "newest">("default");
  const statusTouched = useRef(false);

  const seasonGames = useMemo(() => {
    if (!seasonId || isLifetimeSeason(seasonId)) return games;
    return games.filter((g) => g.seasonId === seasonId && g.league === league);
  }, [games, seasonId, league]);

  // Archived = not current and not marked in progress (lib/season-status).
  const isOldSeason = selectedSeason ? !isSeasonInProgress(selectedSeason) : seasonId !== currentSeasonId;

  const activeStatus = isOldSeason ? "FINAL" : status;

  useEffect(() => {
    if (statusTouched.current) return;
    setStatus(getSmartStatusTab(games, seasonId, league, isOldSeason));
  }, [games, seasonId, league, isOldSeason]);

  const counts = { LIVE: 0, UPCOMING: 0, FINAL: 0 };
  for (const game of seasonGames) counts[getEffectiveGameStatus(game)]++;
  const countsPending = isSeasonPending || loading;

  const availableTeams = useMemo(() => {
    const teamsInSeason = isLifetimeSeason(seasonId)
      ? teams
      : teams.filter((t) => t.seasonId === seasonId);
    return teamsInSeason.filter((t) => t.league === league);
  }, [teams, seasonId, league]);

  const filteredGames = useMemo(
    () =>
      seasonGames.filter((game) => {
        const effectiveStatus = getEffectiveGameStatus(game);
        const searchText = `${game.homeTeam.name} ${game.homeTeam.shortName} ${game.awayTeam.name} ${game.awayTeam.shortName} ${game.venue ?? ""}`.toLowerCase();
        return (
          effectiveStatus === activeStatus &&
          game.league === league &&
          (teamId === "ALL" || game.homeTeam.id === teamId || game.awayTeam.id === teamId) &&
          (!date || isoToPhtInput(game.startTime).slice(0, 10) === date) &&
          (!query.trim() || searchText.includes(query.trim().toLowerCase()))
        );
      }).sort((a, b) => {
        const direction = sort === "oldest" || (sort === "default" && activeStatus === "UPCOMING") ? 1 : -1;
        return direction * (new Date(a.startTime).getTime() - new Date(b.startTime).getTime()) || a.id.localeCompare(b.id);
      }),
    [seasonGames, activeStatus, league, teamId, query, date, sort]
  );

  const pageKey = `${league}|${seasonId}|${activeStatus}|${teamId}|${query}|${date}|${sort}`;
  const [page, setPage] = useState({ key: pageKey, limit: 36 });
  const limit = page.key === pageKey ? page.limit : 36;
  const visibleGames = useMemo(() => filteredGames.slice(0, limit), [filteredGames, limit]);

  const upcomingGrouped = useMemo(() => {
    if (activeStatus !== "UPCOMING") return null;

    const groups: { dateKey: string; dateLabel: string; games: Game[] }[] = [];
    const groupMap = new Map<string, { dateKey: string; dateLabel: string; games: Game[] }>();

    for (const game of visibleGames) {
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
  }, [visibleGames, activeStatus]);

  function handleSeasonChange(newSeasonId: string) {
    setUserSelectedSeasonId(newSeasonId);
    setTeamId("ALL");
    setDate("");
    const targetSeason = seasons.find((s) => s.id === newSeasonId);
    const isOld = targetSeason ? !isSeasonInProgress(targetSeason) : false;
    statusTouched.current = false;
    setStatus(getSmartStatusTab(games, newSeasonId, league, isOld));
  }

  function handleLeagueChange(newLeague: League) {
    setLeague(newLeague);
    setTeamId("ALL");
    setDate("");
    setUserSelectedSeasonId(null);

    const effSeasons = seasons.filter((s) => inferLeague(s) === newLeague);
    const targetCurrent = effSeasons.find((s) => s.isCurrent)?.id ?? effSeasons[0]?.id ?? currentSeasonId;
    const targetSeason = seasons.find((s) => s.id === targetCurrent);
    const isOld = targetSeason ? !isSeasonInProgress(targetSeason) : false;
    statusTouched.current = false;
    setStatus(getSmartStatusTab(games, targetCurrent, newLeague, isOld));
  }

  const showPvlLivePlaceholder =
    league === "PVL" && activeStatus === "LIVE" && filteredGames.length === 0;

  const hasFilters = teamId !== "ALL" || !!query || !!date || sort !== "default";
  function resetFilters() {
    setTeamId("ALL");
    setQuery("");
    setDate("");
    setSort("default");
  }

  function renderBody() {
    if (error && games.length === 0) {
      return <ErrorNotice message={error} onRetry={() => void refreshData()} />;
    }
    if (isSeasonPending || (loading && games.length === 0)) {
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
            <div key={group.dateKey} className="flex flex-col gap-3">
              <div className="flex items-center justify-between border-b border-border/60 pb-2 px-1">
                <div className="flex items-center gap-2.5">
                  <span className="h-2 w-2 rounded-full bg-primary shadow-[0_0_8px_rgba(239,68,68,0.85)]" aria-hidden="true" />
                  <h3 className="text-xs font-bold uppercase tracking-wider text-foreground">
                    {group.dateLabel}
                  </h3>
                </div>
                <Badge tone="neutral" size="sm">
                  {group.games.length} {group.games.length === 1 ? "Match" : "Matches"}
                </Badge>
              </div>
              <div className="grid grid-cols-1 gap-3.5 md:grid-cols-2 lg:grid-cols-3">
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
      <div className="grid grid-cols-1 gap-3.5 md:grid-cols-2 lg:grid-cols-3">
        {visibleGames.map((game) => (
          <GameCard key={game.id} game={game} />
        ))}
      </div>
    );
  }

  return (
    <div className={PAGE_FRAME}>
      <section
        className="scoreboard-hero relative overflow-hidden rounded-panel border border-border/90 p-5 md:p-7"
        style={{ backgroundImage: `${HERO_ACCENT[league]}, linear-gradient(160deg, rgb(20 28 42 / 0.95), rgb(13 19 30 / 0.98))` }}
        aria-label="Season overview"
      >
        <div className="flex flex-wrap items-start justify-between gap-5">
          <div className="min-w-0">
            <p className="eyebrow mb-3 flex items-center gap-2 text-primary">
              <span className="h-1.5 w-1.5 rounded-full bg-primary shadow-[0_0_8px_rgba(239,68,68,0.8)]" aria-hidden="true" />
              Philippine sports, in focus
            </p>
            <h1 className="page-heading text-foreground">Philippine sports scores and stats.</h1>
            <p className="mt-2.5 max-w-xl text-sm leading-relaxed text-muted">
              UAAP basketball, PBA and PVL results, schedules and player statistics.
            </p>
          </div>
          <SeasonPicker
            value={seasonId}
            onChange={handleSeasonChange}
            league={league}
            includeLifetime={false}
          />
        </div>
        <div className="mt-6 grid grid-cols-3 gap-2.5 border-t border-border/75 pt-5 sm:gap-3.5">
          {([
            { value: "LIVE", label: "Live now", icon: Radio },
            { value: "UPCOMING", label: "Upcoming", icon: CalendarDays },
            { value: "FINAL", label: "Completed", icon: CheckCheck },
          ] as const).map(({ value, label, icon: Icon }) => {
            const isLive = value === "LIVE" && counts.LIVE > 0;
            return (
              <div
                key={value}
                className={
                  isLive
                    ? "flex min-w-0 flex-col gap-1 rounded-card border border-live/35 bg-live/10 px-3 py-2.5 shadow-[0_0_24px_-12px_rgba(251,113,133,0.6)] md:flex-row md:items-center md:gap-3 md:px-4 md:py-3"
                    : "flex min-w-0 flex-col gap-1 rounded-card border border-border/75 bg-surface-2/75 px-3 py-2.5 md:flex-row md:items-center md:gap-3 md:px-4 md:py-3"
                }
              >
                <div className="flex items-center gap-2">
                  <Icon
                    size={16}
                    aria-hidden="true"
                    className={isLive ? "animate-live-pulse text-live" : "text-muted"}
                  />
                  <span
                    className={`font-display text-2xl font-extrabold tabular-nums leading-none md:text-3xl ${isLive ? "text-live" : "text-foreground"}`}
                  >
                    {countsPending ? "–" : counts[value]}
                  </span>
                </div>
                <span className="truncate text-2xs font-medium text-muted md:text-xs">{label}</span>
              </div>
            );
          })}
        </div>
      </section>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="h-scroll flex gap-2 overflow-x-auto py-0.5">
          {LEAGUE_CHIPS.map((chip) => (
            <FilterChip
              key={chip.value}
              selected={league === chip.value}
              onClick={() => handleLeagueChange(chip.value)}
            >
              <span
                aria-hidden="true"
                className="h-2 w-2 rounded-full"
                style={{ backgroundColor: chip.dotColor }}
              />
              {chip.label}
            </FilterChip>
          ))}
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => void refreshData()}
          disabled={loading}
        >
          <RefreshCw
            size={13}
            aria-hidden="true"
            className={loading ? "animate-spin" : ""}
          />
          {loading ? "Updating…" : "Refresh scores"}
        </Button>
      </div>

      <div className="grid gap-4 rounded-panel border border-border/90 bg-surface/95 p-4 shadow-card sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="w-full min-w-0 sm:w-auto sm:min-w-80">
            <SegmentedControl
              options={
                isOldSeason
                  ? [{ value: "FINAL", label: `Final · ${countsPending ? "–" : counts.FINAL}` }]
                  : STATUS_TABS.map((option) => ({
                      ...option,
                      label: `${option.label} · ${countsPending ? "–" : counts[option.value]}`,
                    }))
              }
              value={activeStatus}
              onChange={(value) => {
                statusTouched.current = true;
                setStatus(value);
              }}
            />
          </div>
          <span className="flex items-center gap-1.5 text-2xs text-muted">
            <SlidersHorizontal size={13} aria-hidden="true" />
            All times Philippine time (UTC+8)
          </span>
        </div>
        <div className="grid grid-cols-1 items-end gap-3 sm:grid-cols-2 lg:grid-cols-[1.6fr_1fr_1fr_1fr]">
          <SearchInput
            value={query}
            onChange={setQuery}
            label="Search matches"
            placeholder="Search teams or venues"
            className="sm:col-span-2 lg:col-span-1"
          />
          <Field label="Team">
            <Select
              id="team-filter"
              value={teamId}
              onChange={(event) => setTeamId(event.target.value)}
            >
              <option value="ALL">All Teams</option>
              {availableTeams.map((team) => (
                <option key={team.id} value={team.id}>
                  {team.name} ({team.shortName})
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Match date (PHT)">
            <Input
              type="date"
              value={date}
              onChange={(event) => setDate(event.target.value)}
            />
          </Field>
          <Field label="Sort by">
            <Select
              value={sort}
              onChange={(event) => setSort(event.target.value as typeof sort)}
            >
              <option value="default">
                {activeStatus === "UPCOMING" ? "Next match first" : "Latest first"}
              </option>
              <option value="newest">Newest first</option>
              <option value="oldest">Oldest first</option>
            </Select>
          </Field>
        </div>
      </div>

      {error && games.length > 0 ? (
        <ErrorNotice message={error} onRetry={() => void refreshData()} />
      ) : null}

      <div className="flex min-h-7 flex-wrap items-center justify-between gap-3">
        <h2 className="text-xs font-semibold text-muted" aria-live="polite">
          {countsPending
            ? "Loading matches…"
            : `${filteredGames.length} ${filteredGames.length === 1 ? "match" : "matches"}`}{" "}
          <span className="text-muted/60">/</span> {league} ·{" "}
          {selectedSeason?.label ?? "Season"}
        </h2>
        {hasFilters ? (
          <button
            type="button"
            onClick={resetFilters}
            className="min-h-10 text-xs font-semibold text-primary hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
          >
            Reset filters
          </button>
        ) : null}
      </div>

      {renderBody()}
      {filteredGames.length > limit ? (
        <Button
          variant="outline"
          size="md"
          className="w-full"
          onClick={() => setPage({ key: pageKey, limit: limit + 36 })}
        >
          Show more games
        </Button>
      ) : null}
    </div>
  );
}
