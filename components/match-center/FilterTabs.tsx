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
import { TeamBadge } from "@/components/ui/TeamBadge";
import { useSportsData, useSportsScope } from "@/context/SportsDataContext";
import { getEffectiveGameStatus, isLifetimeSeason } from "@/lib/derivations";
import { useGameModal } from "@/lib/game-modal-context";
import { getTopGamePerformer } from "@/lib/game-overview";
import { inferLeague } from "@/lib/league-utils";
import { formatFullDayHeader, formatGameDate, formatRecord, formatStartTime, isoToPhtInput } from "@/lib/utils";
import type { Game, League } from "@/types/sports";
import {
  ArrowUpRight,
  CalendarDays,
  CheckCheck,
  MapPin,
  Radio,
  RefreshCw,
  SlidersHorizontal,
  Sparkles,
  Trophy,
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
  UAAP: "radial-gradient(ellipse 70% 60% at 95% 0%, rgb(225 29 72 / 0.22), transparent 64%)",
  PBA: "radial-gradient(ellipse 70% 60% at 95% 0%, rgb(245 158 11 / 0.20), transparent 64%)",
  PVL: "radial-gradient(ellipse 70% 60% at 95% 0%, rgb(14 165 233 / 0.22), transparent 64%)",
};

function sortBySpotlightPriority(a: Game, b: Game): number {
  const rank = (g: Game) => {
    const s = getEffectiveGameStatus(g);
    return s === "LIVE" ? 0 : s === "UPCOMING" ? 1 : 2;
  };
  const ra = rank(a);
  const rb = rank(b);
  if (ra !== rb) return ra - rb;
  const ta = new Date(a.startTime).getTime();
  const tb = new Date(b.startTime).getTime();
  // Live/Upcoming: soonest first; Final: newest first
  return ra === 2 ? tb - ta : ta - tb;
}

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
  const { games, teams, players, seasons, currentSeasonId, loading, error, refreshData } = useSportsData();
  const { openGame } = useGameModal();
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

  const playerNamesById = useMemo(
    () => new Map(players.map((p) => [p.id, p.name])),
    [players]
  );

  const orderedSeasonGames = useMemo(
    () => [...seasonGames].sort(sortBySpotlightPriority),
    [seasonGames]
  );
  const tickerGames = useMemo(() => orderedSeasonGames.slice(0, 8), [orderedSeasonGames]);
  const spotlightGame = orderedSeasonGames[0] ?? null;
  const spotlightStatus = spotlightGame ? getEffectiveGameStatus(spotlightGame) : null;
  const spotlightShowScore = spotlightStatus !== null && spotlightStatus !== "UPCOMING";
  const spotlightTopScorer = useMemo(
    () =>
      spotlightGame && spotlightShowScore
        ? getTopGamePerformer(spotlightGame, playerNamesById)
        : null,
    [spotlightGame, spotlightShowScore, playerNamesById]
  );

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
      {!error && tickerGames.length > 0 ? (
        <div
          role="region"
          aria-label="Scoreboard ticker"
          className="broadcast-ticker flex w-full min-w-0 items-center gap-2.5 overflow-hidden rounded-panel border border-border/85 px-3 py-2"
        >
          <span className="flex shrink-0 items-center gap-1.5 rounded-control border border-primary/40 bg-primary/15 px-2 py-1 text-3xs font-extrabold uppercase tracking-[0.16em] text-foreground">
            <span
              aria-hidden="true"
              className={
                counts.LIVE > 0
                  ? "animate-live-pulse h-1.5 w-1.5 rounded-full bg-live"
                  : "h-1.5 w-1.5 rounded-full bg-primary"
              }
            />
            {counts.LIVE > 0 ? "Live Wire" : "Scoreboard"}
          </span>
          <div className="h-scroll flex min-w-0 flex-1 items-center gap-2 overflow-x-auto py-0.5">
            {tickerGames.map((g) => {
              const gStatus = getEffectiveGameStatus(g);
              const showTickerScore = gStatus !== "UPCOMING";
              return (
                <button
                  key={g.id}
                  type="button"
                  onClick={() => openGame(g.id)}
                  aria-label={`Ticker ${g.awayTeam.shortName} vs ${g.homeTeam.shortName}`}
                  className="flex shrink-0 items-center gap-2 rounded-control border border-border/80 bg-surface-2/90 px-2.5 py-1.5 text-2xs transition-colors hover:border-border-strong hover:bg-elevated/80 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                >
                  <TeamBadge team={g.awayTeam} size="sm" className="h-5 w-5 text-[7px]" />
                  <span className="font-bold text-foreground">{g.awayTeam.shortName}</span>
                  {showTickerScore ? (
                    <span className="font-mono font-extrabold tabular-nums text-foreground">
                      {g.awayScore}-{g.homeScore}
                    </span>
                  ) : (
                    <span className="text-3xs font-semibold uppercase text-muted">vs</span>
                  )}
                  <span className="font-bold text-foreground">{g.homeTeam.shortName}</span>
                  <TeamBadge team={g.homeTeam} size="sm" className="h-5 w-5 text-[7px]" />
                  <span
                    className={
                      gStatus === "LIVE"
                        ? "rounded px-1 py-0.5 text-3xs font-extrabold uppercase text-live bg-live/15"
                        : "text-3xs font-semibold text-muted"
                    }
                  >
                    {gStatus === "LIVE"
                      ? g.league === "PVL"
                        ? `S${g.quarterOrSet}`
                        : `Q${g.quarterOrSet}`
                      : gStatus === "FINAL"
                        ? "F"
                        : formatStartTime(g.startTime)}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      ) : null}

      <section
        className="scoreboard-hero relative overflow-hidden rounded-panel border border-border-strong/70 p-5 md:p-7"
        style={{
          backgroundImage: `${HERO_ACCENT[league]}, url('/assets/arena-court-bg.svg'), linear-gradient(155deg, rgb(18 26 44 / 0.96), rgb(8 13 24 / 0.98))`,
          backgroundSize: "cover",
          backgroundPosition: "center",
        }}
        aria-label="Season overview"
      >
        <div className="grid grid-cols-1 items-stretch gap-6 lg:grid-cols-[minmax(0,1.15fr)_minmax(19rem,0.85fr)]">
          <div className="flex min-w-0 flex-col justify-between gap-5">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="min-w-0">
                <p className="eyebrow mb-3 flex items-center gap-2 text-primary">
                  <span className="h-1.5 w-1.5 rounded-full bg-primary shadow-[0_0_8px_rgba(239,68,68,0.85)]" aria-hidden="true" />
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

            <div className="grid grid-cols-3 gap-2.5 border-t border-border/75 pt-5 sm:gap-3.5">
              {([
                { value: "LIVE", label: "Live now", icon: Radio },
                { value: "UPCOMING", label: "Upcoming", icon: CalendarDays },
                { value: "FINAL", label: "Completed", icon: CheckCheck },
              ] as const).map(({ value, label, icon: Icon }) => {
                const isLive = value === "LIVE" && counts.LIVE > 0;
                const isSelected = activeStatus === value;
                return (
                  <button
                    key={value}
                    type="button"
                    disabled={isOldSeason && value !== "FINAL"}
                    aria-label={`Jump to ${label} matches`}
                    onClick={() => {
                      statusTouched.current = true;
                      setStatus(value);
                    }}
                    className={
                      isLive
                        ? "flex min-w-0 flex-col gap-1 rounded-card border border-live/45 bg-live/12 px-3 py-2.5 text-left shadow-[0_0_24px_-12px_rgba(251,113,133,0.65)] transition-colors hover:bg-live/18 md:flex-row md:items-center md:gap-3 md:px-4 md:py-3"
                        : isSelected
                          ? "flex min-w-0 flex-col gap-1 rounded-card border border-border-strong bg-elevated/85 px-3 py-2.5 text-left transition-colors md:flex-row md:items-center md:gap-3 md:px-4 md:py-3"
                          : "flex min-w-0 flex-col gap-1 rounded-card border border-border/75 bg-surface-2/80 px-3 py-2.5 text-left transition-colors hover:border-border-strong hover:bg-surface/90 disabled:opacity-50 md:flex-row md:items-center md:gap-3 md:px-4 md:py-3"
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
                  </button>
                );
              })}
            </div>
          </div>

          {spotlightGame ? (
            <div
              role="region"
              aria-label="Spotlight matchup"
              className="glass-card relative flex min-w-0 flex-col justify-between gap-4 overflow-hidden rounded-card border border-border-strong/80 p-4 shadow-raised sm:p-5"
              style={{
                backgroundImage: `linear-gradient(135deg, ${spotlightGame.awayTeam.accentColor}22 0%, transparent 48%, ${spotlightGame.homeTeam.accentColor}22 100%)`,
              }}
            >
              <div
                aria-hidden="true"
                className="pointer-events-none absolute inset-x-0 top-0 h-[3px]"
                style={{
                  background: `linear-gradient(90deg, ${spotlightGame.awayTeam.accentColor}, ${spotlightGame.homeTeam.accentColor})`,
                }}
              />
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="flex items-center gap-1.5 text-3xs font-extrabold uppercase tracking-[0.18em] text-primary">
                  <Trophy size={12} aria-hidden="true" />
                  {spotlightStatus === "LIVE"
                    ? "Center Court Live"
                    : spotlightStatus === "UPCOMING"
                      ? "Next Marquee Match"
                      : "Featured Result"}
                </span>
                <Badge tone={spotlightStatus === "LIVE" ? "live" : "neutral"} size="sm" dot={spotlightStatus === "LIVE"}>
                  {spotlightStatus === "LIVE"
                    ? spotlightGame.league === "PVL"
                      ? `LIVE · Set ${spotlightGame.quarterOrSet}`
                      : `LIVE · Q${spotlightGame.quarterOrSet}`
                    : spotlightStatus === "FINAL"
                      ? `Final · ${formatGameDate(spotlightGame.startTime, true)}`
                      : `${formatGameDate(spotlightGame.startTime, true)} · ${formatStartTime(spotlightGame.startTime)}`}
                </Badge>
              </div>

              <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3 py-1 text-center">
                <div className="flex min-w-0 flex-col items-center gap-1.5">
                  <TeamBadge team={spotlightGame.awayTeam} size="lg" />
                  <span className="font-display text-lg font-extrabold tracking-tight text-foreground">
                    {spotlightGame.awayTeam.shortName}
                  </span>
                  <span className="max-w-full truncate text-3xs font-medium text-muted">
                    {formatRecord(spotlightGame.awayTeam.record)}
                  </span>
                </div>

                <div className="flex flex-col items-center gap-1">
                  {spotlightShowScore ? (
                    <div className="led-score-box flex items-center gap-2 rounded-xl border border-border-strong/75 px-3 py-2">
                      <span
                        className={`font-display text-3xl font-black tabular-nums leading-none ${
                          spotlightGame.awayScore >= spotlightGame.homeScore ? "text-foreground" : "text-muted"
                        }`}
                      >
                        {spotlightGame.awayScore}
                      </span>
                      <span className="text-xs font-bold text-muted/60">:</span>
                      <span
                        className={`font-display text-3xl font-black tabular-nums leading-none ${
                          spotlightGame.homeScore >= spotlightGame.awayScore ? "text-foreground" : "text-muted"
                        }`}
                      >
                        {spotlightGame.homeScore}
                      </span>
                    </div>
                  ) : (
                    <span className="rounded-full border border-border-strong bg-surface-2 px-3 py-1 font-display text-sm font-extrabold uppercase tracking-widest text-muted">
                      VS
                    </span>
                  )}
                </div>

                <div className="flex min-w-0 flex-col items-center gap-1.5">
                  <TeamBadge team={spotlightGame.homeTeam} size="lg" />
                  <span className="font-display text-lg font-extrabold tracking-tight text-foreground">
                    {spotlightGame.homeTeam.shortName}
                  </span>
                  <span className="max-w-full truncate text-3xs font-medium text-muted">
                    {formatRecord(spotlightGame.homeTeam.record)}
                  </span>
                </div>
              </div>

              <div className="flex flex-col gap-2 border-t border-border/70 pt-3">
                {spotlightTopScorer ? (
                  <div className="flex items-center justify-between gap-2 text-2xs">
                    <span className="flex min-w-0 items-center gap-1.5 text-muted">
                      <Sparkles size={11} aria-hidden="true" className="shrink-0 text-archive" />
                      <span className="truncate font-semibold text-foreground">{spotlightTopScorer.playerName}</span>
                    </span>
                    <span className="font-mono shrink-0 font-bold text-archive">{spotlightTopScorer.pts} PTS</span>
                  </div>
                ) : null}
                <div className="flex items-center justify-between gap-2">
                  <span className="flex min-w-0 items-center gap-1 text-2xs text-muted">
                    <MapPin size={11} aria-hidden="true" className="shrink-0" />
                    <span className="truncate">{spotlightGame.venue || selectedSeason?.label || league}</span>
                  </span>
                  <button
                    type="button"
                    onClick={() => openGame(spotlightGame.id)}
                    aria-label="Open spotlight match breakdown"
                    className="inline-flex shrink-0 items-center gap-1 rounded-control border border-primary/50 bg-primary/15 px-2.5 py-1 text-2xs font-bold text-foreground transition-colors hover:bg-primary/25 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                  >
                    Match Breakdown
                    <ArrowUpRight size={12} aria-hidden="true" />
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div className="glass-card flex flex-col justify-center gap-2 rounded-card border border-border/75 p-5">
              <p className="eyebrow text-primary">{league} Telemetry</p>
              <p className="font-display text-2xl font-extrabold text-foreground">
                {selectedSeason?.label ?? "Season Center"}
              </p>
              <p className="text-xs leading-relaxed text-muted">
                Select another league or season to browse match reports, box scores, and player leaders.
              </p>
            </div>
          )}
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
