"use client";

import { cn } from "@/lib/utils";
import {
  ArrowLeft,
  Search,
  Volleyball as VolleyballIcon,
  Swords,
  Crown,
} from "lucide-react";
import { useSearchParams, useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import standingsData from "@/data/uaap_standings.json";

export interface StandingRecord {
  season: string;
  sport: string;
  division: string;
  stage: string;
  rank: number;
  team: string;
  wins: number | null;
  losses: number | null;
  pct: number | null;
  details: string | null;
  source_page: string;
}

// Custom Sport Logos/Icons (Ultra-clean modern SVGs)
function BasketballIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <circle cx="12" cy="12" r="10" />
      <path d="M4.93 4.93c4.24 4.24 4.24 11.1 0 15.34" />
      <path d="M19.07 4.93c-4.24 4.24-4.24 11.1 0 15.34" />
      <line x1="2" y1="12" x2="22" y2="12" />
    </svg>
  );
}

function BadmintonIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M12 2l4 7-8 0z" />
      <circle cx="12" cy="12" r="3" />
      <line x1="12" y1="15" x2="12" y2="22" />
      <line x1="8" y1="19" x2="16" y2="19" />
    </svg>
  );
}

function TableTennisIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <circle cx="11" cy="9" r="6" />
      <path d="M16 13l5 5a2 2 0 0 1-2.83 2.83l-5-5" />
      <circle cx="18" cy="6" r="2" fill="currentColor" />
    </svg>
  );
}

function MartialArtsIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M6 4h12a2 2 0 0 1 2 2v3a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z" />
      <path d="M9 11v9l3-3 3 3v-9" />
    </svg>
  );
}

function BaseballIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <circle cx="12" cy="12" r="10" />
      <path d="M5.5 5.5c3.5 3.5 3.5 9.5 0 13" strokeDasharray="2 2" />
      <path d="M18.5 5.5c-3.5 3.5-3.5 9.5 0 13" strokeDasharray="2 2" />
    </svg>
  );
}

function FootballIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <circle cx="12" cy="12" r="10" />
      <polygon points="12,8 15,10 14,14 10,14 9,10" fill="currentColor" fillOpacity="0.2" />
      <line x1="12" y1="8" x2="12" y2="2" />
      <line x1="15" y1="10" x2="20" y2="7" />
      <line x1="14" y1="14" x2="18" y2="18" />
      <line x1="10" y1="14" x2="6" y2="18" />
      <line x1="9" y1="10" x2="4" y2="7" />
    </svg>
  );
}

function TennisIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <circle cx="12" cy="12" r="10" />
      <path d="M4.93 4.93a10 10 0 0 1 14.14 0" />
      <path d="M4.93 19.07a10 10 0 0 0 14.14 0" />
    </svg>
  );
}

interface SportMeta {
  name: string;
  slug: string;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
  bgGlow: string;
  divisions: string[];
}

const SPORTS_META: SportMeta[] = [
  {
    name: "Basketball",
    slug: "basketball",
    icon: BasketballIcon,
    color: "text-amber-500",
    bgGlow: "group-hover:border-amber-500/60 group-hover:bg-amber-500/5",
    divisions: ["Men's", "Women's", "Juniors"],
  },
  {
    name: "Volleyball",
    slug: "volleyball",
    icon: VolleyballIcon,
    color: "text-sky-400",
    bgGlow: "group-hover:border-sky-500/60 group-hover:bg-sky-500/5",
    divisions: ["Men's", "Women's", "Girls", "Boys"],
  },
  {
    name: "Badminton",
    slug: "badminton",
    icon: BadmintonIcon,
    color: "text-emerald-400",
    bgGlow: "group-hover:border-emerald-500/60 group-hover:bg-emerald-500/5",
    divisions: ["Men's", "Women's"],
  },
  {
    name: "Table Tennis",
    slug: "table-tennis",
    icon: TableTennisIcon,
    color: "text-orange-400",
    bgGlow: "group-hover:border-orange-500/60 group-hover:bg-orange-500/5",
    divisions: ["Men's", "Women's", "Juniors"],
  },
  {
    name: "Tae Kwon Do",
    slug: "tae-kwon-do",
    icon: MartialArtsIcon,
    color: "text-red-400",
    bgGlow: "group-hover:border-red-500/60 group-hover:bg-red-500/5",
    divisions: ["Men's", "Women's", "Juniors"],
  },
  {
    name: "Judo",
    slug: "judo",
    icon: MartialArtsIcon,
    color: "text-indigo-400",
    bgGlow: "group-hover:border-indigo-500/60 group-hover:bg-indigo-500/5",
    divisions: ["Men's", "Women's"],
  },
  {
    name: "Baseball",
    slug: "baseball",
    icon: BaseballIcon,
    color: "text-rose-400",
    bgGlow: "group-hover:border-rose-500/60 group-hover:bg-rose-500/5",
    divisions: ["Men's"],
  },
  {
    name: "Softball",
    slug: "softball",
    icon: BaseballIcon,
    color: "text-yellow-400",
    bgGlow: "group-hover:border-yellow-500/60 group-hover:bg-yellow-500/5",
    divisions: ["Women's"],
  },
  {
    name: "Football",
    slug: "football",
    icon: FootballIcon,
    color: "text-teal-400",
    bgGlow: "group-hover:border-teal-500/60 group-hover:bg-teal-500/5",
    divisions: ["Men's", "Women's"],
  },
  {
    name: "Fencing",
    slug: "fencing",
    icon: Swords,
    color: "text-purple-400",
    bgGlow: "group-hover:border-purple-500/60 group-hover:bg-purple-500/5",
    divisions: ["Men's", "Women's"],
  },
  {
    name: "Chess",
    slug: "chess",
    icon: Crown,
    color: "text-amber-300",
    bgGlow: "group-hover:border-amber-400/60 group-hover:bg-amber-400/5",
    divisions: ["Juniors", "Women's"],
  },
  {
    name: "Lawn Tennis",
    slug: "lawn-tennis",
    icon: TennisIcon,
    color: "text-lime-400",
    bgGlow: "group-hover:border-lime-500/60 group-hover:bg-lime-500/5",
    divisions: ["Men's", "Women's"],
  },
];

const SCHOOL_THEMES: Record<string, { bg: string; text: string; name: string }> = {
  ADMU: { bg: "bg-blue-600/15 border-blue-500/30", text: "text-blue-400", name: "Ateneo" },
  DLSU: { bg: "bg-emerald-600/15 border-emerald-500/30", text: "text-emerald-400", name: "La Salle" },
  FEU: { bg: "bg-green-600/15 border-yellow-500/30", text: "text-yellow-400", name: "Far Eastern" },
  UST: { bg: "bg-amber-500/15 border-amber-500/30", text: "text-amber-400", name: "Santo Tomas" },
  UP: { bg: "bg-rose-700/15 border-rose-500/30", text: "text-rose-400", name: "UP" },
  UPIS: { bg: "bg-rose-700/15 border-rose-500/30", text: "text-rose-400", name: "UPIS" },
  UE: { bg: "bg-red-600/15 border-red-500/30", text: "text-red-400", name: "UE" },
  AdU: { bg: "bg-sky-600/15 border-sky-500/30", text: "text-sky-400", name: "Adamson" },
  NU: { bg: "bg-indigo-600/15 border-yellow-500/30", text: "text-indigo-400", name: "National U" },
  DLSZ: { bg: "bg-emerald-600/15 border-emerald-500/30", text: "text-emerald-400", name: "DLSZ" },
};

export function UAAPArchiveView() {
  const router = useRouter();
  const searchParams = useSearchParams();

  // Selected sport & division from query params or null for "off the rip" box view
  const sportParam = searchParams.get("sport");
  const divisionParam = searchParams.get("division");

  const [searchQuery, setSearchQuery] = useState("");
  const [stageFilter, setStageFilter] = useState<string>("All");

  const data = standingsData as StandingRecord[];

  const currentSportMeta = useMemo(() => {
    if (!sportParam) return null;
    return SPORTS_META.find(
      (s) => s.name.toLowerCase() === sportParam.toLowerCase() || s.slug === sportParam.toLowerCase()
    );
  }, [sportParam]);

  // Selected division within the sport (default to first available division)
  const currentDivision = useMemo(() => {
    if (!currentSportMeta) return null;
    if (divisionParam && currentSportMeta.divisions.map((d) => d.toLowerCase()).includes(divisionParam.toLowerCase())) {
      return currentSportMeta.divisions.find((d) => d.toLowerCase() === divisionParam.toLowerCase()) || currentSportMeta.divisions[0];
    }
    return currentSportMeta.divisions[0];
  }, [currentSportMeta, divisionParam]);

  const handleSelectSport = (sport: SportMeta) => {
    router.push(`/uaap?sport=${encodeURIComponent(sport.name)}&division=${encodeURIComponent(sport.divisions[0])}`);
  };

  const handleSelectDivision = (div: string) => {
    if (!currentSportMeta) return;
    router.push(`/uaap?sport=${encodeURIComponent(currentSportMeta.name)}&division=${encodeURIComponent(div)}`);
  };

  const handleBackToSports = () => {
    router.push("/uaap");
  };

  // Filtered standings for the selected sport & division
  const sportStandings = useMemo(() => {
    if (!currentSportMeta || !currentDivision) return [];
    return data.filter((item) => {
      const matchSport = item.sport.toLowerCase() === currentSportMeta.name.toLowerCase();
      const matchDivision = item.division.toLowerCase() === currentDivision.toLowerCase();
      const matchStage = stageFilter === "All" || item.stage.startsWith(stageFilter);
      const matchQuery =
        !searchQuery ||
        item.team.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (item.details && item.details.toLowerCase().includes(searchQuery.toLowerCase()));

      return matchSport && matchDivision && matchStage && matchQuery;
    });
  }, [data, currentSportMeta, currentDivision, stageFilter, searchQuery]);

  // Check if both Final Standings and Elimination Round exist for current sport & division
  const availableStages = useMemo(() => {
    if (!currentSportMeta || !currentDivision) return [];
    const stages = new Set(
      data
        .filter(
          (item) =>
            item.sport.toLowerCase() === currentSportMeta.name.toLowerCase() &&
            item.division.toLowerCase() === currentDivision.toLowerCase()
        )
        .map((item) => item.stage)
    );
    return Array.from(stages);
  }, [data, currentSportMeta, currentDivision]);

  return (
    <div className="space-y-6 max-w-7xl mx-auto p-4 md:p-6 pb-20">
      {/* VIEW 1: OFF THE RIP — SQUARE BOXES GRID OF SPORTS */}
      {!currentSportMeta ? (
        <div className="space-y-4 animate-in fade-in duration-200">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold uppercase tracking-wider text-muted">
              Select a Sport
            </h2>
            <span className="text-xs text-muted font-medium">
              {SPORTS_META.length} Official UAAP Sports
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
            {SPORTS_META.map((sport) => {
              const Icon = sport.icon;
              return (
                <button
                  key={sport.slug}
                  onClick={() => handleSelectSport(sport)}
                  className={cn(
                    "aspect-square flex flex-col items-center justify-between p-4 rounded-2xl bg-surface border border-border transition-all duration-200 group text-center cursor-pointer",
                    "hover:scale-[1.03] hover:shadow-lg focus:outline-none focus:ring-2 focus:ring-amber-500/50",
                    sport.bgGlow
                  )}
                >
                  <div className="w-full flex justify-end">
                    <span className="text-[10px] font-semibold text-muted/80 bg-elevated px-2 py-0.5 rounded-md">
                      {sport.divisions.length} {sport.divisions.length > 1 ? "Divs" : "Div"}
                    </span>
                  </div>

                  <div className="my-auto flex flex-col items-center justify-center transition-transform group-hover:scale-110">
                    <div className={cn("p-3 rounded-2xl bg-elevated/60 shadow-inner", sport.color)}>
                      <Icon className="w-8 h-8 sm:w-10 sm:h-10" />
                    </div>
                  </div>

                  <div className="w-full">
                    <span className="text-sm font-bold text-foreground group-hover:text-amber-400 transition-colors block truncate">
                      {sport.name}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      ) : (
        /* VIEW 2: SPORT OPENED — DIVISION SELECTOR & STANDINGS */
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-200">
          {/* Back Navigation & Sport Title */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <button
                onClick={handleBackToSports}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-surface border border-border text-muted hover:text-foreground hover:bg-elevated transition-colors"
              >
                <ArrowLeft size={14} />
                <span>All Sports</span>
              </button>

              <div className="flex items-center gap-2.5">
                <div className={cn("p-2 rounded-xl bg-elevated/70", currentSportMeta.color)}>
                  <currentSportMeta.icon className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-foreground flex items-center gap-2">
                    {currentSportMeta.name}
                  </h2>
                </div>
              </div>
            </div>

            {/* Division Selector Pills */}
            <div className="flex items-center gap-1.5 p-1 bg-surface border border-border rounded-xl self-start sm:self-auto">
              <span className="text-[11px] font-bold text-muted px-2 uppercase tracking-wider hidden sm:inline">
                Division:
              </span>
              {currentSportMeta.divisions.map((div) => {
                const active = currentDivision?.toLowerCase() === div.toLowerCase();
                return (
                  <button
                    key={div}
                    onClick={() => handleSelectDivision(div)}
                    className={cn(
                      "px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all",
                      active
                        ? "bg-amber-500 text-slate-950 font-bold shadow-sm"
                        : "text-muted hover:text-foreground hover:bg-elevated"
                    )}
                  >
                    {div}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Sub-bar: Stage Toggle & Search */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-surface border border-border rounded-2xl p-3">
            {/* Stage filter if multiple stages exist */}
            <div className="flex items-center gap-1.5">
              {availableStages.length > 1 ? (
                <>
                  <span className="text-xs font-semibold text-muted mr-1.5">Stage:</span>
                  {["All", ...availableStages].map((stg) => {
                    const active = stageFilter === stg;
                    return (
                      <button
                        key={stg}
                        onClick={() => setStageFilter(stg)}
                        className={cn(
                          "px-2.5 py-1 rounded-lg text-xs font-medium transition-all",
                          active
                            ? "bg-primary text-primary-foreground font-semibold"
                            : "text-muted hover:bg-elevated hover:text-foreground"
                        )}
                      >
                        {stg}
                      </button>
                    );
                  })}
                </>
              ) : (
                <span className="text-xs font-medium text-muted">
                  Official {currentDivision} Standings
                </span>
              )}
            </div>

            {/* Search within current division */}
            <div className="relative min-w-[200px] sm:w-64">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
              <input
                type="text"
                placeholder="Filter by school..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-elevated/50 border border-border rounded-xl pl-9 pr-3 py-1.5 text-xs text-foreground placeholder:text-muted focus:outline-none focus:border-primary transition-all"
              />
            </div>
          </div>

          {/* Standings Table Card */}
          <div className="bg-surface border border-border rounded-2xl overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm border-collapse">
                <thead>
                  <tr className="border-b border-border bg-elevated/40 text-[11px] font-bold uppercase tracking-wider text-muted">
                    <th className="py-3 px-4 w-14 text-center">Rank</th>
                    <th className="py-3 px-4">School</th>
                    <th className="py-3 px-4">Stage</th>
                    <th className="py-3 px-4 text-center">Wins</th>
                    <th className="py-3 px-4 text-center">Losses</th>
                    <th className="py-3 px-4 text-center">Win %</th>
                    <th className="py-3 px-4">Result / Notes</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60 font-medium">
                  {sportStandings.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-12 text-center text-muted">
                        No standings found for this division/stage.
                      </td>
                    </tr>
                  ) : (
                    sportStandings.map((item, idx) => {
                      const theme = SCHOOL_THEMES[item.team] || {
                        bg: "bg-surface border-border",
                        text: "text-foreground",
                        name: item.team,
                      };

                      const isChamp =
                        item.rank === 1 && (item.stage.includes("Final") || item.details?.includes("Champion"));
                      const isRunnerUp = item.rank === 2 && item.stage.includes("Final");
                      const isThird = item.rank === 3 && item.stage.includes("Final");

                      return (
                        <tr
                          key={`${item.sport}-${item.division}-${item.stage}-${item.team}-${idx}`}
                          className="hover:bg-elevated/40 transition-colors"
                        >
                          {/* Rank */}
                          <td className="py-3 px-4 text-center font-bold">
                            {isChamp ? (
                              <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-amber-500/20 text-amber-400 text-xs shadow-sm">
                                🥇
                              </span>
                            ) : isRunnerUp ? (
                              <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-slate-400/20 text-slate-300 text-xs">
                                🥈
                              </span>
                            ) : isThird ? (
                              <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-amber-700/20 text-amber-600 text-xs">
                                🥉
                              </span>
                            ) : (
                              <span className="text-muted text-xs font-bold">{item.rank}</span>
                            )}
                          </td>

                          {/* Team */}
                          <td className="py-3 px-4">
                            <div className="flex items-center gap-2.5">
                              <span
                                className={cn(
                                  "px-2.5 py-1 rounded-md border text-xs font-bold shrink-0 shadow-sm",
                                  theme.bg,
                                  theme.text
                                )}
                              >
                                {item.team}
                              </span>
                              <span className="font-semibold text-foreground text-xs hidden sm:inline">
                                {theme.name}
                              </span>
                            </div>
                          </td>

                          {/* Stage */}
                          <td className="py-3 px-4">
                            <span className="inline-block px-2 py-0.5 rounded-md bg-elevated text-[11px] text-muted font-medium">
                              {item.stage}
                            </span>
                          </td>

                          {/* Wins */}
                          <td className="py-3 px-4 text-center font-bold text-foreground">
                            {item.wins !== null && item.wins !== undefined ? item.wins : "—"}
                          </td>

                          {/* Losses */}
                          <td className="py-3 px-4 text-center font-bold text-muted">
                            {item.losses !== null && item.losses !== undefined ? item.losses : "—"}
                          </td>

                          {/* Pct */}
                          <td className="py-3 px-4 text-center font-mono text-xs text-foreground font-semibold">
                            {item.pct !== null && item.pct !== undefined ? item.pct.toFixed(3) : "—"}
                          </td>

                          {/* Result / Notes */}
                          <td className="py-3 px-4 text-xs text-muted">
                            {item.details ? (
                              <span
                                className={cn(
                                  "font-medium",
                                  isChamp && "text-amber-400 font-bold",
                                  isRunnerUp && "text-slate-300 font-semibold"
                                )}
                                dangerouslySetInnerHTML={{ __html: item.details }}
                              />
                            ) : (
                              "—"
                            )}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
