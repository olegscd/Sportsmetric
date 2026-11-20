"use client";

import { PAGE_FRAME } from "@/components/layout/page-shell";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorNotice } from "@/components/ui/ErrorNotice";
import { Field, Input, Select } from "@/components/ui/Field";
import { SearchInput } from "@/components/ui/SearchInput";
import { SeasonPicker } from "@/components/ui/SeasonPicker";
import { SkeletonCardGrid } from "@/components/ui/Skeleton";
import { useSportsData, useSportsScope } from "@/context/SportsDataContext";
import { getEffectiveGameStatus } from "@/lib/derivations";
import { inferLeague } from "@/lib/league-utils";
import { isSeasonInProgress } from "@/lib/season-status";
import { formatFullDayHeader, formatGameDate, isoToPhtInput } from "@/lib/utils";
import type { Game, League } from "@/types/sports";
import { ArrowRight, CalendarDays, ChevronDown, Radio, RefreshCw, SlidersHorizontal } from "lucide-react";
import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import { GameCard } from "./GameCard";
import { LeagueBadge } from "./LeagueBadge";

type LeagueScope = "ALL" | League;

const LEAGUE_TABS: { value: LeagueScope; label: string; dotColor?: string }[] = [
  { value: "ALL", label: "All" },
  { value: "UAAP", label: "UAAP", dotColor: "var(--color-league-uaap)" },
  { value: "PBA", label: "PBA", dotColor: "var(--color-league-pba)" },
  { value: "PVL", label: "PVL", dotColor: "var(--color-league-pvl)" },
];

const HERO_ACCENT: Record<LeagueScope, string> = {
  ALL: "radial-gradient(ellipse 75% 65% at 75% 0%, rgb(239 68 68 / 0.2), transparent 65%), radial-gradient(ellipse 55% 55% at 15% 10%, rgb(59 130 246 / 0.14), transparent 60%)",
  UAAP: "radial-gradient(ellipse 75% 65% at 80% 0%, rgb(225 29 72 / 0.26), transparent 66%)",
  PBA: "radial-gradient(ellipse 75% 65% at 80% 0%, rgb(245 158 11 / 0.24), transparent 66%)",
  PVL: "radial-gradient(ellipse 75% 65% at 80% 0%, rgb(14 165 233 / 0.26), transparent 66%)",
};

const ARENA_SLIDES = [
  { src: "/arenas/ust-qpav.jpg", label: "UST Quadricentennial Pavilion" },
  { src: "/arenas/blue-eagle-gym.jpg", label: "Ateneo Blue Eagle Gym" },
  { src: "/assets/arena-court-bg.svg", label: "Arena Telemetry Court" },
] as const;

export function FilterTabs() {
  const { games, teams, seasons, currentSeasonId, loading, error, refreshData } = useSportsData();
  const [league, setLeague] = useState<LeagueScope>("ALL");
  const [userSelectedSeasonId, setUserSelectedSeasonId] = useState<string | null>(null);
  const [showFilters, setShowFilters] = useState(false);

  const activeLeague: League = league === "ALL" ? "UAAP" : league;
  const targetSeasons = seasons.filter((s) => inferLeague(s) === activeLeague);
  const activeCurrent =
    targetSeasons.find((s) => s.isCurrent)?.id ?? targetSeasons[0]?.id ?? currentSeasonId;
  const seasonId =
    league !== "ALL" && userSelectedSeasonId && targetSeasons.some((s) => s.id === userSelectedSeasonId)
      ? userSelectedSeasonId
      : activeCurrent;

  const { isPending: isSeasonPending } = useSportsScope(
    league === "ALL"
      ? "league=ALL"
      : `league=${league}&season=${encodeURIComponent(seasonId)}`
  );

  const selectedSeason = seasons.find((s) => s.id === seasonId);

  const [teamId, setTeamId] = useState<string>("ALL");
  const [query, setQuery] = useState("");
  const [date, setDate] = useState("");
  const [sort, setSort] = useState<"default" | "oldest" | "newest">("default");

  const [arenaIndex, setArenaIndex] = useState(0);
  useEffect(() => {
    const timer = setInterval(() => {
      setArenaIndex((prev) => (prev + 1) % ARENA_SLIDES.length);
    }, 8000);
    return () => clearInterval(timer);
  }, []);

  const scopedGames = useMemo(() => {
    if (league === "ALL") {
      const activeIds = new Set(seasons.filter((s) => isSeasonInProgress(s)).map((s) => s.id));
      return activeIds.size > 0 ? games.filter((g) => activeIds.has(g.seasonId)) : games;
    }
    if (!seasonId) return games.filter((g) => g.league === league);
    return games.filter((g) => g.seasonId === seasonId && g.league === league);
  }, [games, seasons, league, seasonId]);

  const availableTeams = useMemo(() => {
    if (league === "ALL") {
      const activeIds = new Set(seasons.filter((s) => isSeasonInProgress(s)).map((s) => s.id));
      return activeIds.size > 0 ? teams.filter((t) => activeIds.has(t.seasonId)) : teams;
    }
    return teams.filter((t) => t.seasonId === seasonId && t.league === league);
  }, [teams, seasons, seasonId, league]);

  const filteredGames = useMemo(
    () =>
      scopedGames.filter((game) => {
        const searchText =
          `${game.homeTeam.name} ${game.homeTeam.shortName} ${game.awayTeam.name} ${game.awayTeam.shortName} ${game.venue ?? ""}`.toLowerCase();
        return (
          (league === "ALL" || game.league === league) &&
          (teamId === "ALL" || game.homeTeam.id === teamId || game.awayTeam.id === teamId) &&
          (!date || isoToPhtInput(game.startTime).slice(0, 10) === date) &&
          (!query.trim() || searchText.includes(query.trim().toLowerCase()))
        );
      }),
    [scopedGames, league, teamId, date, query]
  );

  const pageKey = `${league}|${seasonId}|${teamId}|${query}|${date}|${sort}`;
  const [page, setPage] = useState({ key: pageKey, limit: 36 });
  const limit = page.key === pageKey ? page.limit : 36;

  const feedSections = useMemo(() => {
    if (sort !== "default") {
      const dir = sort === "oldest" ? 1 : -1;
      const flat = [...filteredGames].sort(
        (a, b) =>
          dir * (new Date(a.startTime).getTime() - new Date(b.startTime).getTime()) ||
          a.id.localeCompare(b.id)
      );
      return { mode: "flat" as const, games: flat.slice(0, limit), total: flat.length };
    }

    const live: Game[] = [];
    const upcoming: Game[] = [];
    const final: Game[] = [];

    for (const game of filteredGames) {
      const st = getEffectiveGameStatus(game);
      if (st === "LIVE") live.push(game);
      else if (st === "UPCOMING") upcoming.push(game);
      else final.push(game);
    }

    live.sort(
      (a, b) =>
        new Date(a.startTime).getTime() - new Date(b.startTime).getTime() ||
        a.id.localeCompare(b.id)
    );
    upcoming.sort(
      (a, b) =>
        new Date(a.startTime).getTime() - new Date(b.startTime).getTime() ||
        a.id.localeCompare(b.id)
    );
    final.sort(
      (a, b) =>
        new Date(b.startTime).getTime() - new Date(a.startTime).getTime() ||
        a.id.localeCompare(b.id)
    );

    const remainingAfterLive = Math.max(0, limit - live.length);
    const visibleUpcoming = upcoming.slice(0, remainingAfterLive);
    const remainingForFinal = Math.max(0, remainingAfterLive - visibleUpcoming.length);
    const visibleFinal = final.slice(0, remainingForFinal);
    const finalByLeague: Record<League, Game[]> = {
      UAAP: final.filter((g) => g.league === "UAAP").slice(0, 3),
      PBA: final.filter((g) => g.league === "PBA").slice(0, 3),
      PVL: final.filter((g) => g.league === "PVL").slice(0, 3),
    };

    const upcomingGroups: { dateKey: string; dateLabel: string; games: Game[] }[] = [];
    const groupMap = new Map<string, { dateKey: string; dateLabel: string; games: Game[] }>();
    for (const game of visibleUpcoming) {
      const dateKey = formatGameDate(game.startTime, true);
      const dateLabel = formatFullDayHeader(game.startTime) || dateKey;
      let group = groupMap.get(dateKey);
      if (!group) {
        group = { dateKey, dateLabel, games: [] };
        groupMap.set(dateKey, group);
        upcomingGroups.push(group);
      }
      group.games.push(game);
    }

    return {
      mode: "sections" as const,
      live,
      upcomingGroups,
      final: visibleFinal,
      finalByLeague,
      total: filteredGames.length,
    };
  }, [filteredGames, sort, limit]);

  function handleLeagueChange(newLeague: LeagueScope) {
    setLeague(newLeague);
    setTeamId("ALL");
    setDate("");
    setUserSelectedSeasonId(null);
  }

  function handleAnySeasonPick(pickedSeasonId: string) {
    if (!pickedSeasonId) {
      setLeague("ALL");
      setUserSelectedSeasonId(null);
      setTeamId("ALL");
      return;
    }
    const found = seasons.find((s) => s.id === pickedSeasonId);
    if (found) {
      setLeague(inferLeague(found));
      setUserSelectedSeasonId(found.id);
      setTeamId("ALL");
      setDate("");
    }
  }

  const hasFilters =
    teamId !== "ALL" || !!query || !!date || sort !== "default" || !!userSelectedSeasonId;
  const countsPending = isSeasonPending || loading;

  function resetFilters() {
    setTeamId("ALL");
    setQuery("");
    setDate("");
    setSort("default");
    setUserSelectedSeasonId(null);
  }

  const showAllLeaguesShowcase = league === "ALL" && !hasFilters;

  function renderBody() {
    if (error && games.length === 0) {
      return <ErrorNotice message={error} onRetry={() => void refreshData()} />;
    }
    if (isSeasonPending || (loading && games.length === 0)) {
      return <SkeletonCardGrid count={6} />;
    }
    if (filteredGames.length === 0) {
      return (
        <EmptyState
          icon={<Radio size={22} aria-hidden="true" />}
          title="No games match these filters"
          description={
            hasFilters
              ? "Try clearing your search, team, or date filter."
              : "Matches and box scores appear here once scheduled or published."
          }
        />
      );
    }
    if (feedSections.mode === "flat") {
      return (
        <div className="grid grid-cols-1 gap-3.5 md:grid-cols-2 lg:grid-cols-3">
          {feedSections.games.map((game) => (
            <GameCard key={game.id} game={game} />
          ))}
        </div>
      );
    }

    const liveGridClass =
      feedSections.live.length === 1
        ? "grid grid-cols-1 gap-3.5"
        : feedSections.live.length === 2
          ? "grid grid-cols-1 gap-3.5 md:grid-cols-2"
          : "grid grid-cols-1 gap-3.5 md:grid-cols-2 lg:grid-cols-3";

    const leagueShowcase = (["UAAP", "PBA", "PVL"] as const)
      .map((l) => ({ league: l, games: feedSections.finalByLeague[l] }))
      .filter((entry) => entry.games.length > 0);

    return (
      <div className="flex flex-col gap-7">
        {feedSections.live.length > 0 ? (
          <section aria-label="Live games" className="flex flex-col gap-3">
            <div className="flex items-center gap-2 px-0.5">
              <span className="animate-live-pulse h-2 w-2 rounded-full bg-live" aria-hidden="true" />
              <h2 className="text-xs font-extrabold uppercase tracking-wider text-live">
                Live Now
              </h2>
              <span className="text-2xs font-medium text-muted">({feedSections.live.length})</span>
            </div>
            <div className={liveGridClass}>
              {feedSections.live.map((game) => (
                <GameCard
                  key={game.id}
                  game={game}
                  featured={feedSections.live.length === 1}
                />
              ))}
            </div>
          </section>
        ) : null}

        {feedSections.upcomingGroups.length > 0 ? (
          <section aria-label="Upcoming schedule" className="flex flex-col gap-4">
            {feedSections.upcomingGroups.map((group) => (
              <div key={group.dateKey} className="flex flex-col gap-3">
                <div className="flex items-center justify-between border-b border-white/[0.08] pb-2 px-0.5">
                  <div className="flex items-center gap-2">
                    <CalendarDays size={13} aria-hidden="true" className="text-primary" />
                    <h2 className="text-xs font-bold uppercase tracking-wider text-foreground">
                      Upcoming · {group.dateLabel}
                    </h2>
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
          </section>
        ) : null}

        {showAllLeaguesShowcase ? (
          leagueShowcase.length > 0 ? (
            <section aria-label="Recent results" className="flex flex-col gap-6">
              {leagueShowcase.map(({ league: l, games: leagueGames }) => (
                <div key={l} className="flex flex-col gap-3">
                  <div className="flex items-center justify-between border-b border-white/[0.08] pb-2 px-0.5">
                    <div className="flex items-center gap-2.5">
                      <LeagueBadge league={l} />
                      <h2 className="text-xs font-extrabold uppercase tracking-wider text-foreground">
                        Recent {l} Results
                      </h2>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleLeagueChange(l)}
                      className="inline-flex items-center gap-1 text-xs font-semibold text-primary transition-colors hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                    >
                      All {l} scores
                      <ArrowRight size={13} aria-hidden="true" />
                    </button>
                  </div>
                  <div className="grid grid-cols-1 gap-3.5 md:grid-cols-2 lg:grid-cols-3">
                    {leagueGames.map((game) => (
                      <GameCard key={game.id} game={game} />
                    ))}
                  </div>
                </div>
              ))}
            </section>
          ) : null
        ) : feedSections.final.length > 0 ? (
          <section aria-label="Recent results" className="flex flex-col gap-3">
            {(feedSections.live.length > 0 || feedSections.upcomingGroups.length > 0) ? (
              <div className="flex items-center justify-between border-b border-white/[0.08] pb-2 px-0.5">
                <h2 className="text-xs font-bold uppercase tracking-wider text-muted">
                  Recent Results
                </h2>
              </div>
            ) : null}
            <div className="grid grid-cols-1 gap-3.5 md:grid-cols-2 lg:grid-cols-3">
              {feedSections.final.map((game) => (
                <GameCard key={game.id} game={game} />
              ))}
            </div>
          </section>
        ) : null}
      </div>
    );
  }

  const contextSummary =
    league === "ALL"
      ? "All leagues · Seasons in progress"
      : `${league} · ${selectedSeason?.label ?? "Season"}`;

  return (
    <div className="relative overflow-x-clip">
      {/* Full-bleed edge-less moving arena backdrop fading smoothly into #050811 */}
      <div
        aria-hidden="true"
        className="arena-edge-fade pointer-events-none absolute inset-x-0 top-0 h-[360px] overflow-hidden sm:h-[400px]"
      >
        {ARENA_SLIDES.map((slide, idx) => (
          <Image
            key={slide.src}
            src={slide.src}
            alt=""
            fill
            sizes="100vw"
            priority={idx === 0}
            unoptimized={slide.src.endsWith(".svg")}
            className={`animate-arena-pan object-cover object-center transition-opacity duration-1000 ${
              idx === arenaIndex ? "opacity-40" : "opacity-0"
            }`}
          />
        ))}
        <div
          className="absolute inset-0 transition-all duration-500"
          style={{
            backgroundImage: `${HERO_ACCENT[league]}, linear-gradient(180deg, rgba(5,8,17,0.34) 0%, rgba(5,8,17,0.72) 62%, #050811 100%)`,
          }}
        />
      </div>

      <div className={`${PAGE_FRAME} relative z-10`}>
        {/* Open borderless top stage directly above the scores */}
        <header className="flex flex-col gap-3.5 pb-1">
          <div className="flex flex-wrap items-end justify-between gap-2">
            <div className="min-w-0">
              <h1 className="font-display text-2xl font-extrabold tracking-tight text-white drop-shadow-[0_2px_16px_rgba(0,0,0,0.85)] sm:text-3xl">
                Philippine sports scores and stats.
              </h1>
              <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-300/85">
                <span aria-live="polite">
                  {countsPending
                    ? "Loading matches…"
                    : `${filteredGames.length} ${filteredGames.length === 1 ? "match" : "matches"}`}{" "}
                  <span className="text-white/35">·</span> {contextSummary}
                </span>
                {hasFilters ? (
                  <button
                    type="button"
                    onClick={resetFilters}
                    className="font-semibold text-primary hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                  >
                    Reset filters
                  </button>
                ) : null}
              </div>
            </div>

            <span className="hidden items-center gap-2 rounded-full border border-white/[0.1] bg-black/45 px-2.5 py-1 text-3xs font-medium text-slate-300/90 backdrop-blur-md sm:inline-flex">
              <span>{ARENA_SLIDES[arenaIndex].label}</span>
              <span className="inline-flex items-center gap-1">
                {ARENA_SLIDES.map((slide, idx) => (
                  <button
                    key={slide.src}
                    type="button"
                    onClick={() => setArenaIndex(idx)}
                    aria-label={`Show ${slide.label} backdrop`}
                    className={`h-1.5 rounded-full transition-all ${
                      idx === arenaIndex ? "w-3 bg-primary" : "w-1.5 bg-white/35 hover:bg-white/70"
                    }`}
                  />
                ))}
              </span>
            </span>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3">
            <nav
              aria-label="Leagues"
              className="h-scroll inline-flex max-w-full items-center gap-1 overflow-x-auto rounded-xl border border-white/[0.12] bg-black/50 p-1 backdrop-blur-md shadow-[inset_0_1px_0_rgba(255,255,255,0.08),0_10px_24px_-12px_rgba(0,0,0,0.9)]"
            >
              {LEAGUE_TABS.map((tab) => {
                const selected = league === tab.value;
                return (
                  <button
                    key={tab.value}
                    type="button"
                    aria-pressed={selected}
                    onClick={() => handleLeagueChange(tab.value)}
                    className={`relative inline-flex shrink-0 items-center gap-1.5 rounded-lg px-3.5 py-1.5 text-sm font-semibold transition-all focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary ${
                      selected
                        ? "bg-white/[0.16] text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.22),0_2px_10px_rgba(0,0,0,0.45)]"
                        : "text-slate-300/80 hover:bg-white/[0.06] hover:text-white"
                    }`}
                  >
                    {tab.dotColor ? (
                      <span
                        aria-hidden="true"
                        className="h-1.5 w-1.5 rounded-full"
                        style={{
                          backgroundColor: tab.dotColor,
                          boxShadow: selected ? `0 0 8px ${tab.dotColor}` : undefined,
                        }}
                      />
                    ) : null}
                    {tab.label}
                  </button>
                );
              })}
            </nav>

            <div className="flex shrink-0 items-center gap-1.5">
              <button
                type="button"
                aria-expanded={showFilters}
                onClick={() => setShowFilters((v) => !v)}
                className={`inline-flex items-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-semibold backdrop-blur-md transition-all focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary ${
                  showFilters || hasFilters
                    ? "border-primary/45 bg-primary/20 text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.16)]"
                    : "border-white/[0.12] bg-black/45 text-slate-200 hover:border-white/25 hover:bg-white/[0.1]"
                }`}
              >
                <SlidersHorizontal size={13} aria-hidden="true" />
                <span>Filters / Past Seasons</span>
                <ChevronDown
                  size={13}
                  aria-hidden="true"
                  className={`transition-transform duration-150 ${showFilters ? "rotate-180" : ""}`}
                />
              </button>
              <button
                type="button"
                onClick={() => void refreshData()}
                disabled={loading}
                aria-label={loading ? "Updating scores" : "Refresh scores"}
                title={loading ? "Updating…" : "Refresh scores"}
                className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/[0.12] bg-black/45 text-slate-300 backdrop-blur-md transition-all hover:border-white/25 hover:bg-white/[0.1] hover:text-white disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
              >
                <RefreshCw
                  size={13}
                  aria-hidden="true"
                  className={loading ? "animate-spin" : ""}
                />
              </button>
            </div>
          </div>
        </header>

      {showFilters ? (
        <div
          role="region"
          aria-label="Filters and past seasons"
          className="translucent-card grid gap-3 rounded-panel border border-white/[0.08] p-4 shadow-card sm:p-5"
        >
          <div className="flex flex-wrap items-center justify-between gap-3">
            {league === "ALL" ? (
              <label className="relative flex min-w-0 items-center gap-2 text-xs text-muted">
                <span className="text-2xs font-semibold uppercase tracking-wide">Season</span>
                <select
                  aria-label="Season"
                  value=""
                  onChange={(event) => handleAnySeasonPick(event.target.value)}
                  className="min-h-10 appearance-none rounded-control border border-border/90 bg-surface-2/95 py-2 pl-3 pr-8 text-xs font-semibold text-foreground hover:border-border-strong focus:border-primary/70 focus:outline-none"
                >
                  <option value="">Seasons in progress (All leagues)</option>
                  {(["UAAP", "PBA", "PVL"] as const).map((l) => {
                    const list = seasons.filter((s) => inferLeague(s) === l);
                    if (!list.length) return null;
                    return (
                      <optgroup key={l} label={l}>
                        {list.map((s) => (
                          <option key={s.id} value={s.id}>
                            {s.label}
                          </option>
                        ))}
                      </optgroup>
                    );
                  })}
                </select>
              </label>
            ) : (
              <SeasonPicker
                value={seasonId}
                onChange={(newSeasonId) => {
                  setUserSelectedSeasonId(newSeasonId);
                  setTeamId("ALL");
                  setDate("");
                }}
                league={league}
                includeLifetime={false}
              />
            )}
            <span className="text-2xs text-muted">All times Philippine time (UTC+8)</span>
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
                <option value="default">Live &amp; upcoming first</option>
                <option value="newest">Newest first</option>
                <option value="oldest">Oldest first</option>
              </Select>
            </Field>
          </div>
        </div>
      ) : null}

      {error && games.length > 0 ? (
        <ErrorNotice message={error} onRetry={() => void refreshData()} />
      ) : null}

      {renderBody()}

      {(feedSections.mode === "flat" || !showAllLeaguesShowcase) && filteredGames.length > limit ? (
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
    </div>
  );
}
