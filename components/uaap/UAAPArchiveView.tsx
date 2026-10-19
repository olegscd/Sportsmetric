"use client";

import { cn } from "@/lib/utils";
import {
  ArrowLeft,
  Award,
  Calendar,
  ChevronRight,
  Crown,
  Info,
  Layers,
  ListOrdered,
  Medal,
  Search,
  Sparkles,
  Trophy,
} from "lucide-react";
import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/Badge";
import { Notice } from "@/components/ui/Notice";
import { TableShell, Td, Th } from "@/components/ui/Table";
import {
  formatCellValue,
  makeExtrasKey,
  normalizeChessMedalists,
  normalizeDivision,
  pickPreferredDivision,
  sortDivisions,
  type MergedUAAPData,
  type UAAPDivisionAwards,
} from "@/lib/uaap-schema";
import { getSchoolTheme } from "@/lib/uaap-schools";
import { PAGE_SHELL } from "@/components/layout/page-shell";
import { SPORTS_META, findSportMeta, formatSeasonLabel } from "@/components/uaap/sports-meta";

export { formatSeasonLabel };

type TabId = "standings" | "awards" | "leaders";

interface UAAPLeaderEntry {
  rank?: number;
  player?: string;
  school?: string;
  [key: string]: unknown;
}

type UAAPLeaderboards = Record<string, Record<string, UAAPLeaderEntry[]>>;

function isChampionRow(details: string | null, rank: number): boolean {
  if (rank !== 1) return false;
  return !details || /champion|1st|first/i.test(details);
}

function RankBadge({ rank, details }: { rank: number; details: string | null }) {
  if (rank <= 3) {
    const champion = isChampionRow(details, rank);
    return (
      <span
        aria-label={`Rank ${rank}`}
        className={cn(
          "inline-flex h-6 w-6 items-center justify-center rounded-full border",
          champion
            ? "border-archive/30 bg-archive/15 text-archive"
            : rank === 2
              ? "border-border-strong bg-elevated text-foreground"
              : "border-border bg-surface-2 text-muted"
        )}
      >
        <Medal size={13} aria-hidden="true" />
      </span>
    );
  }
  return <span className="text-xs font-bold text-muted">{rank}</span>;
}

function SchoolCell({ team }: { team: string }) {
  const theme = getSchoolTheme(team);
  return (
    <div className="flex items-center gap-2.5">
      <span
        className={cn(
          "shrink-0 rounded-md border px-2.5 py-1 text-xs font-bold",
          theme.bg,
          theme.text
        )}
      >
        {team || "—"}
      </span>
      {theme.name && theme.name !== team && (
        <span className="hidden max-w-[10rem] truncate font-semibold text-foreground text-xs sm:inline">
          {theme.name}
        </span>
      )}
    </div>
  );
}

export function UAAPArchiveView({ initialData }: { initialData: MergedUAAPData }) {
  const searchParams = useSearchParams();
  const router = useRouter();

  const sportParam = searchParams.get("sport");
  const seasonParam = searchParams.get("season");
  const divisionParam = searchParams.get("division");
  const rawTab = searchParams.get("tab");
  const tabParam: TabId =
    rawTab === "awards" || rawTab === "leaders" || rawTab === "standings"
      ? rawTab
      : "standings";

  // The server component supplies the merged dataset; this view is read-only.
  const tables = initialData.tables;
  const extras = initialData.extras;
  const [sportQuery, setSportQuery] = useState("");

  const sportMeta = useMemo(() => findSportMeta(sportParam), [sportParam]);

  const tablesForSport = useMemo(() => {
    if (!sportMeta) return [];
    return tables.filter((t) => t.sport.toLowerCase() === sportMeta.name.toLowerCase());
  }, [tables, sportMeta]);

  const availableSeasons = useMemo(
    () => Array.from(new Set(tablesForSport.map((t) => t.season))).sort().reverse(),
    [tablesForSport]
  );

  const currentSeason = useMemo(() => {
    if (!seasonParam) return null;
    return availableSeasons.find((s) => s.toLowerCase() === seasonParam.toLowerCase()) ?? null;
  }, [seasonParam, availableSeasons]);

  // The dropdown's option list must always contain the selected value, even
  // while the live fetch is mid-flight and the season list is still settling.
  const seasonOptions = useMemo(() => {
    if (currentSeason && !availableSeasons.includes(currentSeason)) {
      return [currentSeason, ...availableSeasons];
    }
    return availableSeasons;
  }, [availableSeasons, currentSeason]);

  const tablesForSeason = useMemo(
    () => tablesForSport.filter((t) => t.season === currentSeason),
    [tablesForSport, currentSeason]
  );

  const availableDivisions = useMemo(
    () => sortDivisions(tablesForSeason.map((t) => t.division)),
    [tablesForSeason]
  );

  const currentDivision = useMemo(() => {
    if (availableDivisions.length === 0) return null;
    if (divisionParam) {
      const match = availableDivisions.find(
        (d) => normalizeDivision(d) === normalizeDivision(divisionParam)
      );
      if (match) return match;
    }
    return availableDivisions[0];
  }, [divisionParam, availableDivisions]);

  const activeTable = useMemo(
    () => tablesForSeason.find((t) => t.division === currentDivision) ?? null,
    [tablesForSeason, currentDivision]
  );

  const extrasKey = useMemo(
    () => (sportMeta && currentSeason ? makeExtrasKey(sportMeta.name, currentSeason) : ""),
    [sportMeta, currentSeason]
  );

  const divisionAwards = useMemo(() => {
    if (!extrasKey || !currentDivision) return null;
    const forSeason = extras.awards?.[extrasKey];
    if (!forSeason) return null;
    return (
      (forSeason[currentDivision] ??
        forSeason[normalizeDivision(currentDivision)] ??
        forSeason[currentDivision.replace("'s", "")] ??
        null) as UAAPDivisionAwards | null
    );
  }, [extras, extrasKey, currentDivision]);

  const chessMedalists = useMemo(() => {
    if (!extrasKey || !currentDivision) return null;
    const forSeason = extras.chess_medalists?.[extrasKey];
    if (!forSeason) return null;
    const raw =
      forSeason[currentDivision] ??
      forSeason[normalizeDivision(currentDivision)] ??
      forSeason[currentDivision.replace("'s", "")];
    return normalizeChessMedalists(raw);
  }, [extras, extrasKey, currentDivision]);

  const leaderboards = useMemo(() => {
    if (!extrasKey) return null;
    const raw = extras.leaderboards?.[extrasKey];
    return raw && typeof raw === "object" ? (raw as UAAPLeaderboards) : null;
  }, [extras, extrasKey]);

  const seasonCountBySport = useMemo(() => {
    const counts = new Map<string, number>();
    for (const meta of SPORTS_META) {
      const seasons = new Set(
        tables.filter((t) => t.sport.toLowerCase() === meta.name.toLowerCase()).map((t) => t.season)
      );
      counts.set(meta.slug, seasons.size);
    }
    return counts;
  }, [tables]);

  // ---------------------------------------------------------------------------
  // Navigation — build hrefs, render with <Link>. Using Link (not router.push)
  // makes query-only navigations reliably re-render this Suspense-wrapped view.
  // ---------------------------------------------------------------------------

  const hrefFor = (params: Record<string, string | undefined>): string => {
    const search = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) {
      if (value) search.set(key, value);
    }
    const query = search.toString();
    return query ? `/uaap?${query}` : "/uaap";
  };

  const seasonHref = (season: string): string => {
    if (!sportMeta) return "/uaap";
    const seasonDivisions = tablesForSport
      .filter((t) => t.season === season)
      .map((t) => t.division);
    const firstDivision = pickPreferredDivision(seasonDivisions);
    return hrefFor({ sport: sportMeta.name, season, division: firstDivision ?? undefined, tab: "standings" });
  };

  const availableTabs = useMemo(() => {
    const tabs: Array<{ id: TabId; label: string; icon: React.ReactNode; count?: number }> = [
      { id: "standings", label: "Standings", icon: <Trophy size={14} />, count: activeTable?.rows.length },
    ];
    if (divisionAwards || chessMedalists) {
      tabs.push({ id: "awards", label: "Awards", icon: <Award size={14} /> });
    }
    if (leaderboards) {
      tabs.push({ id: "leaders", label: "Leaders", icon: <ListOrdered size={14} /> });
    }
    return tabs;
  }, [activeTable, divisionAwards, chessMedalists, leaderboards]);

  const activeTab: TabId = availableTabs.some((t) => t.id === tabParam) ? tabParam : "standings";

  // ---------------------------------------------------------------------------
  // View 1: sport picker
  // ---------------------------------------------------------------------------

  if (!sportMeta) {
    const featured = SPORTS_META.find((s) => s.isFeatured);
    const query = sportQuery.trim().toLowerCase();
    const listed = SPORTS_META.filter(
      (s) => !s.isFeatured && (!query || s.name.toLowerCase().includes(query))
    );

    return (
      <div className={`${PAGE_SHELL} space-y-6 pb-20 pt-4 md:pt-6`}>
        {featured && (
          <Link
            href={hrefFor({ sport: featured.name })}
            className="scoreboard-hero group flex w-full flex-col items-start justify-between gap-4 rounded-panel border border-archive/25 p-5 text-left shadow-card transition-colors hover:border-archive/50 sm:flex-row sm:items-center md:p-6"
          >
            <div className="flex items-center gap-4">
              <div className="rounded-card border border-archive/25 bg-archive/10 p-3.5 text-archive">
                <Crown className="h-8 w-8" aria-hidden="true" />
              </div>
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs font-extrabold uppercase tracking-wider text-archive">
                    Perpetual Trophy
                  </span>
                  <Badge tone="archive" size="sm">
                    {seasonCountBySport.get(featured.slug) ?? 0} seasons digitised
                  </Badge>
                </div>
                <h3 className="mt-0.5 text-xl font-black text-foreground transition-colors group-hover:text-archive">
                  General Championship Standings
                </h3>
                <p className="mt-1 text-xs text-muted">
                  Overall university points across every sport, for both Collegiate and Juniors.
                </p>
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-2 self-end sm:self-auto">
              <span className="text-xs font-bold text-archive">View standings</span>
              <div className="rounded-control bg-archive/10 p-2 text-archive">
                <ChevronRight size={16} aria-hidden="true" />
              </div>
            </div>
          </Link>
        )}

        <div className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-xs font-bold uppercase tracking-wider text-muted">
              Sports tournaments
            </h2>
            <div className="relative">
              <Search
                size={13}
                aria-hidden="true"
                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted"
              />
              <input
                type="search"
                value={sportQuery}
                onChange={(e) => setSportQuery(e.target.value)}
                placeholder="Filter sports"
                aria-label="Search sports"
                className="min-h-10 rounded-control border border-border bg-surface-2 py-1.5 pl-8 pr-3 text-base text-foreground placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-archive/40 sm:text-xs"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3.5">
            {listed.map((sport) => {
              const Icon = sport.icon;
              const count = seasonCountBySport.get(sport.slug) ?? 0;
              return (
                <Link
                  key={sport.slug}
                  href={hrefFor({ sport: sport.name })}
                  className={cn(
                    "group flex aspect-square flex-col items-center justify-between rounded-card border border-border bg-surface p-4 text-center shadow-card transition-colors",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-archive/50",
                    sport.bgGlow
                  )}
                >
                  <span
                    className={cn(
                      "rounded-md px-2 py-0.5 text-3xs font-semibold",
                      count > 0 ? "bg-elevated text-muted" : "bg-elevated/50 text-muted/60"
                    )}
                  >
                    {count > 0 ? `${count} ${count === 1 ? "season" : "seasons"}` : "No data yet"}
                  </span>

                  <div className="my-auto">
                    <div className={cn("rounded-card bg-elevated/60 p-3 shadow-inner", sport.color)}>
                      <Icon className="h-8 w-8 sm:h-9 sm:w-9" />
                    </div>
                  </div>

                  <span className="block w-full truncate text-sm font-bold text-foreground transition-colors group-hover:text-archive">
                    {sport.name}
                  </span>
                </Link>
              );
            })}
          </div>

          {listed.length === 0 && (
            <p className="py-10 text-center text-sm text-muted">
              No sports match “{sportQuery}”.
            </p>
          )}
        </div>
      </div>
    );
  }

  const SportIcon = sportMeta.icon;

  // ---------------------------------------------------------------------------
  // View 2: season picker
  // ---------------------------------------------------------------------------

  if (!currentSeason) {
    return (
      <div className={`${PAGE_SHELL} space-y-6 pb-20 pt-4 md:pt-6`}>
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-border/60 pb-4">
          <div className="flex flex-wrap items-center gap-3">
            <Link
              href={hrefFor({})}
              className="inline-flex min-h-10 items-center gap-1.5 rounded-control border border-border bg-surface-2 px-3 text-xs font-semibold text-muted transition-colors hover:bg-elevated hover:text-foreground"
            >
              <ArrowLeft size={14} aria-hidden="true" />
              <span>All sports</span>
            </Link>
            <div className="flex items-center gap-2.5">
              <div className={cn("rounded-control bg-elevated/70 p-2", sportMeta.color)}>
                <SportIcon className="h-5 w-5" />
              </div>
              <h2 className="text-xl font-bold text-foreground">{sportMeta.name}</h2>
            </div>
          </div>
          <Badge tone="neutral">
            {availableSeasons.length} {availableSeasons.length === 1 ? "season" : "seasons"}
          </Badge>
        </div>

        {availableSeasons.length === 0 ? (
          <div className="rounded-card border border-border bg-surface p-12 text-center shadow-card">
            <Calendar className="mx-auto mb-3 h-10 w-10 text-muted opacity-40" aria-hidden="true" />
            <h4 className="text-sm font-bold text-foreground">Nothing digitised yet</h4>
            <p className="mx-auto mt-1 max-w-sm text-xs text-muted">
              Historical records for {sportMeta.name} have not been added to the archive.
            </p>
            <Link
              href={hrefFor({})}
              className="mt-4 inline-flex min-h-10 items-center gap-1.5 rounded-control border border-border bg-elevated px-3.5 text-xs font-semibold text-foreground transition-colors hover:bg-elevated/80"
            >
              <ArrowLeft size={14} aria-hidden="true" />
              <span>Back to all sports</span>
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {availableSeasons.map((season) => {
              const info = formatSeasonLabel(season);
              const seasonTables = tablesForSport.filter((t) => t.season === season);
              const rowCount = seasonTables.reduce((sum, t) => sum + t.rows.length, 0);
              const champion = sortDivisions(seasonTables.map((t) => t.division))
                .map((division) => {
                  const table = seasonTables.find((t) => t.division === division);
                  const row = table?.rows.find((r) => isChampionRow(r.details, r.rank));
                  return row ? { row, division } : null;
                })
                .find(Boolean);
              const hasAwards = !!extras.awards?.[makeExtrasKey(sportMeta.name, season)];

              return (
                <Link
                  key={season}
                  href={seasonHref(season)}
                  className="group flex flex-col justify-between rounded-card border border-border bg-surface p-5 text-left shadow-card transition-colors hover:border-archive/40 hover:bg-elevated/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-archive/50"
                >
                  <div className="flex w-full items-start justify-between">
                    <div>
                      <Badge tone="archive" size="sm">
                        <Trophy size={12} aria-hidden="true" />
                        {info.seasonNumber}
                      </Badge>
                      <h4 className="mt-2 text-xl font-bold text-foreground transition-colors group-hover:text-archive">
                        {info.year}
                      </h4>
                    </div>
                    <span className="rounded-control bg-elevated p-2 text-muted transition-colors group-hover:bg-archive group-hover:text-bg">
                      <ChevronRight size={16} aria-hidden="true" />
                    </span>
                  </div>

                  {champion && (
                    <div className="mt-3 inline-flex items-center gap-1.5 text-xs font-medium text-muted">
                      <Trophy size={13} aria-hidden="true" className="shrink-0 text-archive" />
                      <span className="truncate">
                        Champion: <strong className="text-foreground">{champion.row.team}</strong> (
                        {champion.division})
                      </span>
                    </div>
                  )}

                  <div className="mt-4 flex w-full items-center justify-between border-t border-border/60 pt-3.5 text-xs text-muted">
                    <span className="flex items-center gap-2 truncate">
                      <span className="flex items-center gap-1">
                        <Layers size={12} aria-hidden="true" className="text-archive" />
                        {seasonTables.length}{" "}
                        {seasonTables.length === 1 ? "division" : "divisions"}
                      </span>
                      {hasAwards && (
                        <Badge tone="archive" size="sm">
                          Awards
                        </Badge>
                      )}
                    </span>
                    <span className="font-semibold text-foreground/80 shrink-0">
                      {rowCount} rows
                    </span>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // View 3: season detail
  // ---------------------------------------------------------------------------

  const navHref = (overrides: Partial<Record<string, string>>): string =>
    hrefFor({
      sport: sportMeta.name,
      season: currentSeason,
      division: currentDivision ?? undefined,
      tab: activeTab,
      ...overrides,
    });

  return (
    <div className={`${PAGE_SHELL} space-y-6 pb-20 pt-4 md:pt-6`}>
      <div className="flex flex-col gap-4 border-b border-border/60 pb-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex min-w-0 flex-wrap items-center gap-3">
          <Link
            href={hrefFor({ sport: sportMeta.name })}
            className="inline-flex min-h-10 items-center gap-1.5 rounded-control border border-border bg-surface-2 px-3 text-xs font-semibold text-muted transition-colors hover:bg-elevated hover:text-foreground"
          >
            <ArrowLeft size={14} aria-hidden="true" />
            <span>Seasons</span>
          </Link>
          <Link
            href={hrefFor({})}
            className="inline-flex min-h-10 items-center gap-1 rounded-control px-2.5 text-xs font-medium text-muted transition-colors hover:bg-elevated hover:text-foreground"
          >
            All sports
          </Link>
          <div className="flex items-center gap-2.5">
            <div className={cn("rounded-control bg-elevated/70 p-2", sportMeta.color)}>
              <SportIcon className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-bold text-foreground">{sportMeta.name}</h2>
                {currentDivision && (
                  <Badge tone="archive" size="sm">
                    {currentDivision}
                  </Badge>
                )}
              </div>
              <span className="text-xs text-muted">{formatSeasonLabel(currentSeason).label}</span>
            </div>
          </div>
        </div>

        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <select
            value={currentSeason}
            onChange={(e) => router.push(seasonHref(e.target.value))}
            className="max-w-full min-h-10 rounded-control border border-border bg-surface-2 px-3 text-xs font-bold text-foreground focus:outline-none focus:ring-2 focus:ring-archive/40"
            aria-label="Season"
          >
            {seasonOptions.map((s) => (
              <option key={s} value={s}>
                {formatSeasonLabel(s).label}
              </option>
            ))}
          </select>

          {availableDivisions.length > 1 ? (
            <div className="flex items-center gap-1 rounded-control border border-border bg-surface-2 p-1">
              {availableDivisions.map((div) => (
                <Link
                  key={div}
                  href={navHref({ division: div })}
                  aria-current={currentDivision === div ? "page" : undefined}
                  className={cn(
                    "inline-flex min-h-10 items-center rounded-control px-3.5 text-xs font-semibold transition-colors",
                    currentDivision === div
                      ? "bg-archive font-bold text-bg"
                      : "text-muted hover:bg-elevated hover:text-foreground"
                  )}
                >
                  {div}
                </Link>
              ))}
            </div>
          ) : currentDivision ? (
            <div className="flex min-h-10 items-center rounded-control border border-border bg-surface-2 px-3 text-xs font-bold text-muted">
              {currentDivision}
            </div>
          ) : null}
        </div>
      </div>

      {availableTabs.length > 1 && (
        <div className="h-scroll -mx-1 flex items-center gap-1.5 overflow-x-auto border-b border-border px-1 pb-1.5">
          {availableTabs.map((tab) => (
            <Link
              key={tab.id}
              href={navHref({ tab: tab.id })}
              aria-current={activeTab === tab.id ? "page" : undefined}
              className={cn(
                "inline-flex min-h-10 items-center gap-2 whitespace-nowrap rounded-control px-4 text-xs font-bold transition-colors",
                activeTab === tab.id
                  ? "bg-archive text-bg"
                  : "text-muted hover:bg-elevated hover:text-foreground"
              )}
            >
              <span aria-hidden="true">{tab.icon}</span>
              <span>{tab.label}</span>
              {tab.count !== undefined && (
                <span className="rounded-full bg-black/15 px-1.5 text-3xs font-semibold">
                  {tab.count}
                </span>
              )}
            </Link>
          ))}
        </div>
      )}

      {activeTab === "standings" && (
        <div className="space-y-3">
          {activeTable?.note && (
            <Notice tone="info" className="border-archive/25 bg-archive/10 text-archive">
              <span className="flex items-start gap-2">
                <Info size={14} aria-hidden="true" className="mt-0.5 shrink-0" />
                <span>{activeTable.note}</span>
              </span>
            </Notice>
          )}

          <TableShell>
            <table className="w-full min-w-[36rem] border-collapse text-left text-sm">
              <thead>
                <tr>
                  <Th sticky className="w-14 px-3 text-center">
                    Rank
                  </Th>
                  <Th className="sticky left-14 z-20 min-w-40 px-3">School</Th>
                  {activeTable?.columns.map((col) => (
                    <Th key={col.key} numeric className="px-3">
                      {col.label}
                    </Th>
                  ))}
                  <Th className="px-3">Result / Notes</Th>
                </tr>
              </thead>
              <tbody className="font-medium">
                {!activeTable || activeTable.rows.length === 0 ? (
                  <tr>
                    <Td
                      colSpan={(activeTable?.columns.length ?? 0) + 3}
                      className="py-12 text-center text-muted"
                    >
                      No standings recorded for this division.
                    </Td>
                  </tr>
                ) : (
                  activeTable.rows.map((row, idx) => (
                    <tr key={`${row.team}-${idx}`} className="transition-colors hover:bg-elevated/40">
                      <Td sticky className="w-14 px-3 text-center font-bold">
                        <RankBadge rank={row.rank} details={row.details} />
                      </Td>
                      <Td className="sticky left-14 z-10 bg-surface px-3">
                        <SchoolCell team={row.team} />
                      </Td>
                      {activeTable.columns.map((col) => (
                        <Td
                          key={col.key}
                          numeric
                          className={cn(
                            "px-3 font-mono text-xs font-semibold",
                            col.derived ? "text-muted" : "text-foreground"
                          )}
                        >
                          {formatCellValue(row, col)}
                        </Td>
                      ))}
                      <Td className="px-3 text-xs">
                        {row.details ? (
                          <span
                            className={cn(
                              "font-medium text-muted",
                              isChampionRow(row.details, row.rank) && "font-bold text-archive"
                            )}
                          >
                            {row.details}
                          </span>
                        ) : (
                          <span className="text-muted">—</span>
                        )}
                      </Td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </TableShell>

          {activeTable && (
            <p className="px-1 text-2xs text-muted">
              {activeTable.division} · {activeTable.stage} · Source: {activeTable.source_page}
            </p>
          )}
        </div>
      )}

      {activeTab === "awards" && (
        <div className="space-y-6">
          {divisionAwards && (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
              {divisionAwards.mvp && (
                <AwardCard
                  label="Most Valuable Player"
                  icon={<Crown size={24} />}
                  tone="archive"
                  player={divisionAwards.mvp.player}
                  school={divisionAwards.mvp.school}
                />
              )}
              {divisionAwards.rookie_of_the_year && (
                <AwardCard
                  label="Rookie of the Year"
                  icon={<Sparkles size={24} />}
                  tone="info"
                  player={divisionAwards.rookie_of_the_year.player}
                  school={divisionAwards.rookie_of_the_year.school}
                />
              )}

              {Array.isArray(divisionAwards.mythical_five) &&
                divisionAwards.mythical_five.length > 0 && (
                  <div className="rounded-card border border-border bg-surface p-5 shadow-card md:col-span-2 lg:col-span-1">
                    <div className="mb-3 flex items-center gap-2">
                      <Medal className="h-5 w-5 text-archive" aria-hidden="true" />
                      <h4 className="text-sm font-bold uppercase tracking-wider text-foreground">
                        Mythical selection
                      </h4>
                    </div>
                    <div className="grid grid-cols-1 gap-2.5">
                      {divisionAwards.mythical_five.map((player, idx) => {
                        const name =
                          typeof player === "string" ? player : player.name || player.player;
                        const school = typeof player === "object" ? player.school : null;
                        const position = typeof player === "object" ? player.position : null;
                        const theme = getSchoolTheme(school || "");
                        return (
                          <div
                            key={idx}
                            className="flex min-h-11 items-center justify-between gap-2 rounded-control border border-border bg-elevated/60 px-3 py-2"
                          >
                            <div className="min-w-0">
                              <span className="block truncate text-sm font-bold text-foreground">
                                {name}
                              </span>
                              {position && (
                                <span className="text-2xs text-muted">{position}</span>
                              )}
                            </div>
                            {school && (
                              <span
                                className={cn(
                                  "shrink-0 rounded border px-2 py-0.5 text-2xs font-bold",
                                  theme.bg,
                                  theme.text
                                )}
                              >
                                {school}
                              </span>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
            </div>
          )}

          {chessMedalists && (
            <div className="rounded-card border border-border bg-surface p-5 shadow-card">
              <div className="mb-4 flex items-center gap-2">
                <Crown className="h-5 w-5 text-archive" aria-hidden="true" />
                <h4 className="text-base font-bold text-foreground">
                  Individual board medalists ({currentDivision})
                </h4>
              </div>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {Object.entries(chessMedalists).map(([board, medalists]) => (
                  <div
                    key={board}
                    className="space-y-2.5 rounded-card border border-border bg-elevated/50 p-4"
                  >
                    <h5 className="text-xs font-bold uppercase tracking-wider text-muted">
                      Board {board}
                    </h5>
                    <div className="space-y-1.5 text-xs">
                      {medalists.map((m, idx) => {
                        const theme = getSchoolTheme(m.school);
                        const medalRank =
                          m.medal === "gold" ? 1 : m.medal === "silver" ? 2 : m.medal === "bronze" ? 3 : null;
                        return (
                          <div key={idx} className="flex items-center justify-between gap-2">
                            <span className="flex items-center gap-1.5 truncate">
                              {medalRank ? (
                                <span
                                  aria-label={`${m.medal} medal`}
                                  className={cn(
                                    "inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full border",
                                    medalRank === 1
                                      ? "border-archive/30 bg-archive/15 text-archive"
                                      : medalRank === 2
                                        ? "border-border-strong bg-elevated text-foreground"
                                        : "border-border bg-surface-2 text-muted"
                                  )}
                                >
                                  <Medal size={11} aria-hidden="true" />
                                </span>
                              ) : (
                                <span aria-hidden="true" className="text-muted">
                                  •
                                </span>
                              )}
                              <strong className="truncate text-foreground">{m.player}</strong>
                            </span>
                            {m.school && (
                              <span
                                className={cn(
                                  "shrink-0 rounded border px-1.5 py-0.5 text-3xs font-bold",
                                  theme.bg,
                                  theme.text
                                )}
                              >
                                {m.school}
                              </span>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {!divisionAwards && !chessMedalists && (
            <div className="rounded-card border border-border bg-surface p-12 text-center text-muted shadow-card">
              No individual awards recorded for this division in {currentSeason}.
            </div>
          )}
        </div>
      )}

      {activeTab === "leaders" && leaderboards && (
        <div className="space-y-5">
          {Object.entries(leaderboards).map(([divisionKey, categories]) => (
            <div key={divisionKey} className="space-y-3">
              <h4 className="text-xs font-bold uppercase tracking-wider text-muted capitalize">
                {divisionKey.replace(/_/g, " ")}
              </h4>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
                {Object.entries(categories as Record<string, UAAPLeaderEntry[]>).map(([category, leaders]) => (
                  <div
                    key={category}
                    className="rounded-card border border-border bg-surface p-4 shadow-card"
                  >
                    <h5 className="mb-2.5 text-xs font-bold uppercase capitalize tracking-wider text-foreground">
                      {category.replace(/_/g, " ")}
                    </h5>
                    <div className="space-y-1.5">
                      {(Array.isArray(leaders) ? leaders : []).slice(0, 10).map(
                        (leader, idx) => {
                          const theme = getSchoolTheme(leader.school || "");
                          return (
                            <div
                              key={idx}
                              className="flex min-h-8 items-center justify-between gap-2 text-xs"
                            >
                              <span className="flex min-w-0 items-center gap-2">
                                <span className="w-4 text-right font-mono text-muted">
                                  {leader.rank ?? idx + 1}
                                </span>
                                <span className="truncate font-semibold text-foreground">
                                  {leader.player}
                                </span>
                                {leader.school && (
                                  <span
                                    className={cn(
                                      "shrink-0 rounded border px-1.5 py-0.5 text-3xs font-bold",
                                      theme.bg,
                                      theme.text
                                    )}
                                  >
                                    {leader.school}
                                  </span>
                                )}
                              </span>
                              <span className="shrink-0 font-mono font-bold text-archive">
                                {String(leader.value ?? "—")}
                              </span>
                            </div>
                          );
                        }
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function AwardCard({
  label,
  icon,
  tone,
  player,
  school,
}: {
  label: string;
  icon: React.ReactNode;
  tone: "archive" | "info";
  player: string;
  school: string;
}) {
  const theme = getSchoolTheme(school);
  return (
    <div
      className={cn(
        "flex items-start gap-4 rounded-card border bg-surface p-5 shadow-card",
        tone === "archive" ? "border-archive/30" : "border-info/30"
      )}
    >
      <div
        className={cn(
          "rounded-control p-3",
          tone === "archive" ? "bg-archive/15 text-archive" : "bg-info/15 text-info"
        )}
        aria-hidden="true"
      >
        {icon}
      </div>
      <div className="min-w-0 flex-1">
        <span
          className={cn(
            "block text-2xs font-bold uppercase tracking-wider",
            tone === "archive" ? "text-archive" : "text-info"
          )}
        >
          {label}
        </span>
        <h3 className="mt-0.5 text-lg font-black text-foreground">{player}</h3>
        {school && (
          <div className="mt-2 flex items-center gap-2">
            <span
              className={cn(
                "rounded-md border px-2.5 py-0.5 text-xs font-bold",
                theme.bg,
                theme.text
              )}
            >
              {school}
            </span>
            {theme.name && theme.name !== school && (
              <span className="text-xs text-muted">{theme.name}</span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
