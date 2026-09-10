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
import { useSearchParams, useRouter } from "next/navigation";
import { useMemo, useState, useEffect } from "react";
import {
  formatCellValue,
  legacyRecordsToTables,
  makeExtrasKey,
  normalizeChessMedalists,
  normalizeDivision,
  type LegacyStandingRecord,
  type UAAPArchiveExtras,
  type UAAPTable,
} from "@/lib/uaap-schema";
import { getSchoolTheme } from "@/lib/uaap-schools";
import { SPORTS_META, findSportMeta, formatSeasonLabel } from "@/components/uaap/sports-meta";
import standingsData from "@/data/uaap_standings.json";
import archiveExtrasData from "@/data/uaap_archive_extras.json";

export { formatSeasonLabel };

type TabId = "standings" | "awards" | "leaders";

function isChampionRow(details: string | null, rank: number): boolean {
  if (rank !== 1) return false;
  return !details || /champion|1st|first/i.test(details);
}

function RankBadge({ rank, details }: { rank: number; details: string | null }) {
  if (isChampionRow(details, rank)) {
    return (
      <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-amber-500/20 text-xs shadow-sm">
        🥇
      </span>
    );
  }
  if (rank === 2) {
    return (
      <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-slate-400/20 text-xs">
        🥈
      </span>
    );
  }
  if (rank === 3) {
    return (
      <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-amber-700/20 text-xs">
        🥉
      </span>
    );
  }
  return <span className="text-muted text-xs font-bold">{rank}</span>;
}

function SchoolCell({ team }: { team: string }) {
  const theme = getSchoolTheme(team);
  return (
    <div className="flex items-center gap-2.5">
      <span
        className={cn(
          "px-2.5 py-1 rounded-md border text-xs font-bold shrink-0 shadow-sm",
          theme.bg,
          theme.text
        )}
      >
        {team || "—"}
      </span>
      {theme.name && theme.name !== team && (
        <span className="font-semibold text-foreground text-xs hidden sm:inline">{theme.name}</span>
      )}
    </div>
  );
}

export function UAAPArchiveView() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const sportParam = searchParams.get("sport");
  const seasonParam = searchParams.get("season");
  const divisionParam = searchParams.get("division");
  const tabParam = (searchParams.get("tab") as TabId) || "standings";

  const [tables, setTables] = useState<UAAPTable[]>(() =>
    legacyRecordsToTables(standingsData as LegacyStandingRecord[])
  );
  const [extras, setExtras] = useState<UAAPArchiveExtras>(archiveExtrasData as UAAPArchiveExtras);
  const [sportQuery, setSportQuery] = useState("");

  useEffect(() => {
    let active = true;
    fetch("/api/uaap/data", { cache: "no-store" })
      .then((res) => (res.ok ? res.json() : null))
      .then((json) => {
        if (!active || !json) return;
        if (Array.isArray(json.tables)) setTables(json.tables);
        if (json.extras) setExtras(json.extras);
      })
      .catch((err) => {
        console.warn("[UAAPArchiveView] Live fetch failed, using bundled data:", err);
      });
    return () => {
      active = false;
    };
  }, []);

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

  const tablesForSeason = useMemo(
    () => tablesForSport.filter((t) => t.season === currentSeason),
    [tablesForSport, currentSeason]
  );

  const availableDivisions = useMemo(
    () => Array.from(new Set(tablesForSeason.map((t) => t.division))),
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
      forSeason[currentDivision] ??
      forSeason[normalizeDivision(currentDivision)] ??
      forSeason[currentDivision.replace("'s", "")] ??
      null
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
    return raw && typeof raw === "object" ? (raw as Record<string, any>) : null;
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
  // Navigation
  // ---------------------------------------------------------------------------

  const go = (params: Record<string, string | undefined>) => {
    const search = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) {
      if (value) search.set(key, value);
    }
    const query = search.toString();
    router.push(query ? `/uaap?${query}` : "/uaap");
  };

  const selectSeason = (season: string) => {
    if (!sportMeta) return;
    const firstDivision = tablesForSport.find((t) => t.season === season)?.division;
    go({ sport: sportMeta.name, season, division: firstDivision, tab: "standings" });
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
      <div className="space-y-6 max-w-7xl mx-auto p-4 md:p-6 pb-20 animate-in fade-in duration-200">
        {featured && (
          <button
            onClick={() => go({ sport: featured.name })}
            className="w-full text-left p-5 md:p-6 rounded-3xl bg-gradient-to-r from-amber-500/10 via-amber-500/5 to-surface border border-amber-500/30 hover:border-amber-400/60 transition-all cursor-pointer group shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4"
          >
            <div className="flex items-center gap-4">
              <div className="p-3.5 rounded-2xl bg-amber-500/20 text-amber-400 border border-amber-500/30 group-hover:scale-110 transition-transform">
                <Crown className="w-8 h-8" />
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs font-extrabold uppercase tracking-wider text-amber-400">
                    Perpetual Trophy
                  </span>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-amber-500/10 text-amber-400 border border-amber-500/20">
                    {seasonCountBySport.get(featured.slug) ?? 0} seasons digitised
                  </span>
                </div>
                <h3 className="text-xl font-black text-foreground mt-0.5 group-hover:text-amber-400 transition-colors">
                  General Championship Standings
                </h3>
                <p className="text-xs text-muted mt-1">
                  Overall university points across every sport, for both Collegiate and Juniors.
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0 self-end sm:self-auto">
              <span className="text-xs font-bold text-amber-400 group-hover:translate-x-1 transition-transform">
                View standings
              </span>
              <div className="p-2 rounded-xl bg-amber-500/20 text-amber-400">
                <ChevronRight size={16} />
              </div>
            </div>
          </button>
        )}

        <div className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-xs font-bold uppercase tracking-wider text-muted">
              Sports tournaments
            </h2>
            <div className="relative">
              <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted" />
              <input
                type="search"
                value={sportQuery}
                onChange={(e) => setSportQuery(e.target.value)}
                placeholder="Filter sports"
                className="pl-7 pr-3 py-1.5 rounded-xl text-xs bg-surface border border-border text-foreground placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-amber-500/40"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3.5">
            {listed.map((sport) => {
              const Icon = sport.icon;
              const count = seasonCountBySport.get(sport.slug) ?? 0;
              return (
                <button
                  key={sport.slug}
                  onClick={() => go({ sport: sport.name })}
                  className={cn(
                    "aspect-square flex flex-col items-center justify-between p-4 rounded-2xl bg-surface border border-border transition-all duration-200 group text-center cursor-pointer",
                    "hover:scale-[1.03] hover:shadow-lg focus:outline-none focus:ring-2 focus:ring-amber-500/50",
                    sport.bgGlow
                  )}
                >
                  <span
                    className={cn(
                      "text-[10px] font-semibold px-2 py-0.5 rounded-md",
                      count > 0 ? "bg-elevated text-muted" : "bg-elevated/50 text-muted/60"
                    )}
                  >
                    {count > 0 ? `${count} ${count === 1 ? "season" : "seasons"}` : "No data yet"}
                  </span>

                  <div className="my-auto transition-transform group-hover:scale-110">
                    <div className={cn("p-3 rounded-2xl bg-elevated/60 shadow-inner", sport.color)}>
                      <Icon className="w-8 h-8 sm:w-9 sm:h-9" />
                    </div>
                  </div>

                  <span className="text-sm font-bold text-foreground group-hover:text-amber-400 transition-colors block truncate w-full">
                    {sport.name}
                  </span>
                </button>
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
      <div className="space-y-6 max-w-7xl mx-auto p-4 md:p-6 pb-20 animate-in fade-in slide-in-from-bottom-2 duration-200">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-border/60 pb-4">
          <div className="flex items-center gap-3">
            <button
              onClick={() => go({})}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-surface border border-border text-muted hover:text-foreground hover:bg-elevated transition-colors cursor-pointer"
            >
              <ArrowLeft size={14} />
              <span>All sports</span>
            </button>
            <div className="flex items-center gap-2.5">
              <div className={cn("p-2 rounded-xl bg-elevated/70", sportMeta.color)}>
                <SportIcon className="w-5 h-5" />
              </div>
              <h2 className="text-xl font-bold text-foreground">{sportMeta.name}</h2>
            </div>
          </div>
          <span className="text-xs font-semibold text-muted bg-surface border border-border px-3 py-1 rounded-xl">
            {availableSeasons.length} {availableSeasons.length === 1 ? "season" : "seasons"}
          </span>
        </div>

        {availableSeasons.length === 0 ? (
          <div className="bg-surface border border-border rounded-2xl p-12 text-center">
            <Calendar className="w-10 h-10 text-muted mx-auto mb-3 opacity-40" />
            <h4 className="text-sm font-bold text-foreground">Nothing digitised yet</h4>
            <p className="text-xs text-muted mt-1 max-w-sm mx-auto">
              Historical records for {sportMeta.name} have not been added to the archive.
            </p>
            <button
              onClick={() => go({})}
              className="mt-4 inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-semibold bg-elevated hover:bg-elevated/80 border border-border text-foreground transition-all cursor-pointer"
            >
              <ArrowLeft size={14} />
              <span>Back to all sports</span>
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {availableSeasons.map((season) => {
              const info = formatSeasonLabel(season);
              const seasonTables = tablesForSport.filter((t) => t.season === season);
              const rowCount = seasonTables.reduce((sum, t) => sum + t.rows.length, 0);
              const champion = seasonTables
                .flatMap((t) => t.rows.map((r) => ({ row: r, division: t.division })))
                .find(({ row }) => isChampionRow(row.details, row.rank));
              const hasAwards = !!extras.awards?.[makeExtrasKey(sportMeta.name, season)];

              return (
                <button
                  key={season}
                  onClick={() => selectSeason(season)}
                  className="flex flex-col justify-between p-5 rounded-2xl bg-surface border border-border transition-all duration-200 text-left group cursor-pointer shadow-sm hover:border-amber-500/60 hover:bg-elevated/40 hover:scale-[1.02] hover:shadow-lg focus:outline-none focus:ring-2 focus:ring-amber-500/50"
                >
                  <div className="flex items-start justify-between w-full">
                    <div>
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-500/10 text-amber-400 border border-amber-500/20">
                        <Trophy size={12} />
                        {info.seasonNumber}
                      </span>
                      <h4 className="text-xl font-bold text-foreground mt-2 group-hover:text-amber-400 transition-colors">
                        {info.year}
                      </h4>
                    </div>
                    <span className="p-2 rounded-xl bg-elevated group-hover:bg-amber-500 group-hover:text-slate-950 text-muted transition-all">
                      <ChevronRight size={16} />
                    </span>
                  </div>

                  {champion && (
                    <div className="mt-3 inline-flex items-center gap-1.5 text-xs font-medium text-muted">
                      <Trophy size={13} className="text-amber-400 shrink-0" />
                      <span className="truncate">
                        Champion: <strong className="text-foreground">{champion.row.team}</strong> (
                        {champion.division})
                      </span>
                    </div>
                  )}

                  <div className="mt-4 pt-3.5 border-t border-border/60 flex items-center justify-between text-xs text-muted w-full">
                    <span className="flex items-center gap-2 truncate">
                      <span className="flex items-center gap-1">
                        <Layers size={12} className="text-amber-400" />
                        {seasonTables.length}{" "}
                        {seasonTables.length === 1 ? "division" : "divisions"}
                      </span>
                      {hasAwards && (
                        <span className="px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-400 font-semibold text-[10px]">
                          Awards
                        </span>
                      )}
                    </span>
                    <span className="font-semibold text-foreground/80 shrink-0">
                      {rowCount} rows
                    </span>
                  </div>
                </button>
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

  const navTo = (overrides: Partial<Record<string, string>>) =>
    go({
      sport: sportMeta.name,
      season: currentSeason,
      division: currentDivision ?? undefined,
      tab: activeTab,
      ...overrides,
    });

  return (
    <div className="space-y-6 max-w-7xl mx-auto p-4 md:p-6 pb-20 animate-in fade-in slide-in-from-bottom-2 duration-200">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-border/60 pb-4">
        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={() => go({ sport: sportMeta.name })}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-surface border border-border text-muted hover:text-foreground hover:bg-elevated transition-colors cursor-pointer"
          >
            <ArrowLeft size={14} />
            <span>Seasons</span>
          </button>
          <button
            onClick={() => go({})}
            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-medium text-muted hover:text-foreground hover:bg-elevated transition-colors cursor-pointer"
          >
            All sports
          </button>
          <div className="flex items-center gap-2.5">
            <div className={cn("p-2 rounded-xl bg-elevated/70", sportMeta.color)}>
              <SportIcon className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-bold text-foreground">{sportMeta.name}</h2>
                {currentDivision && (
                  <span className="text-xs font-bold px-2 py-0.5 rounded-md bg-amber-500/15 text-amber-400 border border-amber-500/25">
                    {currentDivision}
                  </span>
                )}
              </div>
              <span className="text-xs text-muted">{formatSeasonLabel(currentSeason).label}</span>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <select
            value={currentSeason}
            onChange={(e) => selectSeason(e.target.value)}
            className="px-3 py-1.5 rounded-xl text-xs font-bold bg-surface border border-border text-foreground focus:outline-none focus:ring-2 focus:ring-amber-500/40"
            aria-label="Season"
          >
            {availableSeasons.map((s) => (
              <option key={s} value={s}>
                {formatSeasonLabel(s).label}
              </option>
            ))}
          </select>

          {availableDivisions.length > 1 ? (
            <div className="flex items-center gap-1.5 p-1 bg-surface border border-border rounded-xl">
              {availableDivisions.map((div) => (
                <button
                  key={div}
                  onClick={() => navTo({ division: div })}
                  className={cn(
                    "px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer",
                    currentDivision === div
                      ? "bg-primary text-primary-foreground font-bold shadow-sm"
                      : "text-muted hover:text-foreground hover:bg-elevated"
                  )}
                >
                  {div}
                </button>
              ))}
            </div>
          ) : currentDivision ? (
            <div className="flex items-center px-3 py-1.5 bg-surface border border-border rounded-xl text-xs font-bold text-muted">
              {currentDivision}
            </div>
          ) : null}
        </div>
      </div>

      {availableTabs.length > 1 && (
        <div className="flex items-center gap-2 border-b border-border pb-1 overflow-x-auto">
          {availableTabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => navTo({ tab: tab.id })}
              className={cn(
                "inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap",
                activeTab === tab.id
                  ? "bg-amber-500 text-slate-950 shadow-sm"
                  : "text-muted hover:text-foreground hover:bg-elevated"
              )}
            >
              {tab.icon}
              <span>{tab.label}</span>
              {tab.count !== undefined && (
                <span className="text-[10px] px-1.5 rounded-full bg-black/15 font-semibold">
                  {tab.count}
                </span>
              )}
            </button>
          ))}
        </div>
      )}

      {activeTab === "standings" && (
        <div className="space-y-3">
          {activeTable?.note && (
            <div className="flex items-start gap-2 p-3 rounded-xl bg-amber-500/10 border border-amber-500/25 text-xs text-amber-200">
              <Info size={14} className="shrink-0 mt-0.5 text-amber-400" />
              <span>{activeTable.note}</span>
            </div>
          )}

          <div className="bg-surface border border-border rounded-2xl overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm border-collapse">
                <thead>
                  <tr className="border-b border-border bg-elevated/40 text-[11px] font-bold uppercase tracking-wider text-muted">
                    <th className="py-3 px-4 w-14 text-center">Rank</th>
                    <th className="py-3 px-4">School</th>
                    {activeTable?.columns.map((col) => (
                      <th key={col.key} className="py-3 px-4 text-center whitespace-nowrap">
                        {col.label}
                      </th>
                    ))}
                    <th className="py-3 px-4">Result / Notes</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60 font-medium">
                  {!activeTable || activeTable.rows.length === 0 ? (
                    <tr>
                      <td
                        colSpan={(activeTable?.columns.length ?? 0) + 3}
                        className="py-12 text-center text-muted"
                      >
                        No standings recorded for this division.
                      </td>
                    </tr>
                  ) : (
                    activeTable.rows.map((row, idx) => (
                      <tr
                        key={`${row.team}-${idx}`}
                        className="hover:bg-elevated/40 transition-colors"
                      >
                        <td className="py-3 px-4 text-center font-bold">
                          <RankBadge rank={row.rank} details={row.details} />
                        </td>
                        <td className="py-3 px-4">
                          <SchoolCell team={row.team} />
                        </td>
                        {activeTable.columns.map((col) => (
                          <td
                            key={col.key}
                            className={cn(
                              "py-3 px-4 text-center font-mono text-xs font-semibold",
                              col.derived ? "text-muted" : "text-foreground"
                            )}
                          >
                            {formatCellValue(row, col)}
                          </td>
                        ))}
                        <td className="py-3 px-4 text-xs">
                          {row.details ? (
                            <span
                              className={cn(
                                "font-medium text-muted",
                                isChampionRow(row.details, row.rank) && "text-amber-400 font-bold"
                              )}
                            >
                              {row.details}
                            </span>
                          ) : (
                            <span className="text-muted">—</span>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {activeTable && (
            <p className="text-[11px] text-muted px-1">
              {activeTable.division} · {activeTable.stage} · Source: {activeTable.source_page}
            </p>
          )}
        </div>
      )}

      {activeTab === "awards" && (
        <div className="space-y-6">
          {divisionAwards && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {divisionAwards.mvp && (
                <AwardCard
                  label="Most Valuable Player"
                  icon={<Crown size={24} />}
                  tone="amber"
                  player={divisionAwards.mvp.player}
                  school={divisionAwards.mvp.school}
                />
              )}
              {divisionAwards.rookie_of_the_year && (
                <AwardCard
                  label="Rookie of the Year"
                  icon={<Sparkles size={24} />}
                  tone="sky"
                  player={divisionAwards.rookie_of_the_year.player}
                  school={divisionAwards.rookie_of_the_year.school}
                />
              )}

              {Array.isArray(divisionAwards.mythical_five) &&
                divisionAwards.mythical_five.length > 0 && (
                  <div className="p-5 rounded-2xl bg-surface border border-border shadow-sm md:col-span-2">
                    <div className="flex items-center gap-2 mb-3">
                      <Medal className="w-5 h-5 text-amber-400" />
                      <h4 className="text-sm font-bold text-foreground uppercase tracking-wider">
                        Mythical selection
                      </h4>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                      {divisionAwards.mythical_five.map((player: any, idx: number) => {
                        const name =
                          typeof player === "string" ? player : player.name || player.player;
                        const school = typeof player === "object" ? player.school : null;
                        const position = typeof player === "object" ? player.position : null;
                        const theme = getSchoolTheme(school || "");
                        return (
                          <div
                            key={idx}
                            className="p-3 rounded-xl bg-elevated/60 border border-border flex items-center justify-between gap-2"
                          >
                            <div className="min-w-0">
                              <span className="font-bold text-sm text-foreground block truncate">
                                {name}
                              </span>
                              {position && (
                                <span className="text-[11px] text-muted">{position}</span>
                              )}
                            </div>
                            {school && (
                              <span
                                className={cn(
                                  "px-2 py-0.5 rounded border text-[11px] font-bold shrink-0",
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
            <div className="p-5 rounded-2xl bg-surface border border-border shadow-sm">
              <div className="flex items-center gap-2 mb-4">
                <Crown className="w-5 h-5 text-amber-400" />
                <h4 className="text-base font-bold text-foreground">
                  Individual board medalists ({currentDivision})
                </h4>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {Object.entries(chessMedalists).map(([board, medalists]) => (
                  <div
                    key={board}
                    className="p-4 rounded-xl bg-elevated/50 border border-border space-y-2.5"
                  >
                    <h5 className="text-xs font-bold uppercase tracking-wider text-muted">
                      Board {board}
                    </h5>
                    <div className="space-y-1.5 text-xs">
                      {medalists.map((m, idx) => {
                        const theme = getSchoolTheme(m.school);
                        const emoji =
                          m.medal === "gold"
                            ? "🥇"
                            : m.medal === "silver"
                              ? "🥈"
                              : m.medal === "bronze"
                                ? "🥉"
                                : "•";
                        return (
                          <div key={idx} className="flex items-center justify-between gap-2">
                            <span className="flex items-center gap-1.5 truncate">
                              <span>{emoji}</span>
                              <strong className="text-foreground truncate">{m.player}</strong>
                            </span>
                            {m.school && (
                              <span
                                className={cn(
                                  "px-1.5 py-0.5 rounded border text-[10px] font-bold shrink-0",
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
            <div className="p-12 text-center text-muted bg-surface border border-border rounded-2xl">
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
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {Object.entries(categories as Record<string, any>).map(([category, leaders]) => (
                  <div
                    key={category}
                    className="p-4 rounded-2xl bg-surface border border-border shadow-sm"
                  >
                    <h5 className="text-xs font-bold text-foreground uppercase tracking-wider mb-2.5 capitalize">
                      {category.replace(/_/g, " ")}
                    </h5>
                    <div className="space-y-1.5">
                      {(Array.isArray(leaders) ? leaders : []).slice(0, 10).map(
                        (leader: any, idx: number) => {
                          const theme = getSchoolTheme(leader.school || "");
                          return (
                            <div
                              key={idx}
                              className="flex items-center justify-between gap-2 text-xs"
                            >
                              <span className="flex items-center gap-2 min-w-0">
                                <span className="w-4 text-right text-muted font-mono">
                                  {leader.rank ?? idx + 1}
                                </span>
                                <span className="font-semibold text-foreground truncate">
                                  {leader.player}
                                </span>
                                {leader.school && (
                                  <span
                                    className={cn(
                                      "px-1.5 py-0.5 rounded border text-[10px] font-bold shrink-0",
                                      theme.bg,
                                      theme.text
                                    )}
                                  >
                                    {leader.school}
                                  </span>
                                )}
                              </span>
                              <span className="font-mono font-bold text-amber-400 shrink-0">
                                {leader.value}
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
  tone: "amber" | "sky";
  player: string;
  school: string;
}) {
  const theme = getSchoolTheme(school);
  return (
    <div
      className={cn(
        "p-5 rounded-2xl bg-surface border shadow-sm flex items-start gap-4",
        tone === "amber" ? "border-amber-500/30" : "border-sky-500/30"
      )}
    >
      <div
        className={cn(
          "p-3 rounded-xl",
          tone === "amber" ? "bg-amber-500/20 text-amber-400" : "bg-sky-500/20 text-sky-400"
        )}
      >
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <span
          className={cn(
            "text-[11px] font-bold uppercase tracking-wider block",
            tone === "amber" ? "text-amber-400" : "text-sky-400"
          )}
        >
          {label}
        </span>
        <h3 className="text-lg font-black text-foreground mt-0.5">{player}</h3>
        {school && (
          <div className="mt-2 flex items-center gap-2">
            <span
              className={cn(
                "px-2.5 py-0.5 rounded-md border text-xs font-bold",
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
