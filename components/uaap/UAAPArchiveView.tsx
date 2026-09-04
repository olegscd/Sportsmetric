"use client";

import { cn } from "@/lib/utils";
import {
  ArrowLeft,
  Calendar,
  ChevronRight,
  Crown,
  Layers,
  Swords,
  Trophy,
  Volleyball as VolleyballIcon,
  Medal,
  Sparkles,
  Search,
  Award,
  TrendingUp,
  Activity,
} from "lucide-react";
import { useSearchParams, useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import standingsData from "@/data/uaap_standings.json";
import archiveExtrasData from "@/data/uaap_archive_extras.json";

export function formatSeasonLabel(season: string): { label: string; seasonNumber: string; year: string } {
  const parts = season.split("-");
  const startYear = parseInt(parts[0], 10);
  if (!isNaN(startYear)) {
    const seasonNum = startYear - 1937;
    return {
      seasonNumber: `Season ${seasonNum}`,
      year: season,
      label: `Season ${seasonNum} (${season})`,
    };
  }
  return {
    seasonNumber: season,
    year: season,
    label: season,
  };
}

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
  points?: number | null;
  details: string | null;
  source_page: string;
}

// Custom Sport Logos / Icons
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

function SwimmingIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M2 18c2 0 3-1 5-1s3 1 5 1 3-1 5-1 3 1 5 1" />
      <path d="M2 21c2 0 3-1 5-1s3 1 5 1 3-1 5-1 3 1 5 1" />
      <circle cx="18" cy="6" r="3" />
      <path d="M7 12l5-4 5 3-3 4" />
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
  isFeatured?: boolean;
}

const SPORTS_META: SportMeta[] = [
  {
    name: "General Championship",
    slug: "general-championship",
    icon: Crown,
    color: "text-amber-400",
    bgGlow: "group-hover:border-amber-400/60 group-hover:bg-amber-400/10",
    divisions: ["Collegiate", "Juniors"],
    isFeatured: true,
  },
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
    divisions: ["Men's", "Women's", "Juniors"],
  },
  {
    name: "Lawn Tennis",
    slug: "lawn-tennis",
    icon: TennisIcon,
    color: "text-lime-400",
    bgGlow: "group-hover:border-lime-500/60 group-hover:bg-lime-500/5",
    divisions: ["Men's", "Women's"],
  },
  {
    name: "Swimming",
    slug: "swimming",
    icon: SwimmingIcon,
    color: "text-cyan-400",
    bgGlow: "group-hover:border-cyan-500/60 group-hover:bg-cyan-500/5",
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
  ADU: { bg: "bg-sky-600/15 border-sky-500/30", text: "text-sky-400", name: "Adamson" },
  NU: { bg: "bg-indigo-600/15 border-yellow-500/30", text: "text-indigo-400", name: "National U" },
  DLSZ: { bg: "bg-emerald-600/15 border-emerald-500/30", text: "text-emerald-400", name: "DLSZ" },
  "DLS-Z": { bg: "bg-emerald-600/15 border-emerald-500/30", text: "text-emerald-400", name: "DLSZ" },
  USTHS: { bg: "bg-amber-500/15 border-amber-500/30", text: "text-amber-400", name: "UST High" },
  "FEU-FERN": { bg: "bg-green-600/15 border-yellow-500/30", text: "text-yellow-400", name: "FEU Diliman" },
  AHS: { bg: "bg-blue-600/15 border-blue-500/30", text: "text-blue-400", name: "Ateneo High" },
  UEHS: { bg: "bg-red-600/15 border-red-500/30", text: "text-red-400", name: "UE High" },
  "NU-HS": { bg: "bg-indigo-600/15 border-yellow-500/30", text: "text-indigo-400", name: "NU High" },
};

function getSchoolTheme(code: string) {
  if (!code) return { bg: "bg-surface border-border", text: "text-foreground", name: "Unknown" };
  const upper = code.toUpperCase();
  if (SCHOOL_THEMES[code]) return SCHOOL_THEMES[code];
  if (SCHOOL_THEMES[upper]) return SCHOOL_THEMES[upper];
  return { bg: "bg-elevated border-border", text: "text-foreground", name: code };
}

export function UAAPArchiveView() {
  const router = useRouter();
  const searchParams = useSearchParams();

  // Selected sport, season, division & tab from query params
  const sportParam = searchParams.get("sport");
  const seasonParam = searchParams.get("season");
  const divisionParam = searchParams.get("division");
  const tabParam = searchParams.get("tab") || "standings";

  const [stageFilter, setStageFilter] = useState<string>("All");
  const [matchSearch, setMatchSearch] = useState<string>("");

  const data = standingsData as StandingRecord[];
  const archiveExtras = archiveExtrasData as unknown as {
    awards: Record<string, Record<string, any>>;
    games: Record<string, any[]>;
    chess_medalists: Record<string, Record<string, any>>;
    leaderboards: Record<string, Record<string, Record<string, any[]>>>;
  };

  const currentSportMeta = useMemo(() => {
    if (!sportParam) return null;
    return SPORTS_META.find(
      (s) =>
        s.name.toLowerCase() === sportParam.toLowerCase() ||
        s.slug === sportParam.toLowerCase() ||
        (s.name === "Tae Kwon Do" && sportParam.toLowerCase() === "taekwondo") ||
        (s.name === "Lawn Tennis" && sportParam.toLowerCase() === "tennis")
    );
  }, [sportParam]);

  // All seasons available for this sport from data
  const availableSeasons = useMemo(() => {
    if (!currentSportMeta) return [];
    const matching = data.filter(
      (item) => item.sport.toLowerCase() === currentSportMeta.name.toLowerCase()
    );
    const seasons = Array.from(new Set(matching.map((item) => item.season)));
    return seasons.sort().reverse();
  }, [data, currentSportMeta]);

  // Current active season if selected
  const currentSeason = useMemo(() => {
    if (!seasonParam) return null;
    return availableSeasons.find((s) => s.toLowerCase() === seasonParam.toLowerCase()) || null;
  }, [seasonParam, availableSeasons]);

  // Divisions available for the current sport AND selected season
  const availableDivisionsForSeason = useMemo(() => {
    if (!currentSportMeta) return [];
    if (!currentSeason) return currentSportMeta.divisions;
    const matching = data.filter(
      (item) =>
        item.sport.toLowerCase() === currentSportMeta.name.toLowerCase() &&
        item.season.toLowerCase() === currentSeason.toLowerCase()
    );
    const divs = Array.from(new Set(matching.map((item) => item.division)));
    return divs.length > 0 ? divs : currentSportMeta.divisions;
  }, [data, currentSportMeta, currentSeason]);

  // Selected division within the sport & season
  const currentDivision = useMemo(() => {
    if (!currentSportMeta || !currentSeason) return null;
    if (divisionParam && availableDivisionsForSeason.map((d) => d.toLowerCase()).includes(divisionParam.toLowerCase())) {
      return availableDivisionsForSeason.find((d) => d.toLowerCase() === divisionParam.toLowerCase()) || availableDivisionsForSeason[0];
    }
    return availableDivisionsForSeason[0] || "Men's";
  }, [currentSportMeta, currentSeason, divisionParam, availableDivisionsForSeason]);

  // Extras for current sport & season
  const extrasKey = useMemo(() => {
    if (!currentSportMeta || !currentSeason) return "";
    return `${currentSportMeta.name}|${currentSeason}`;
  }, [currentSportMeta, currentSeason]);

  const awardsData = useMemo(() => {
    if (!extrasKey) return null;
    return archiveExtras.awards?.[extrasKey] || null;
  }, [archiveExtras, extrasKey]);

  const gamesData = useMemo(() => {
    if (!extrasKey) return [];
    return archiveExtras.games?.[extrasKey] || [];
  }, [archiveExtras, extrasKey]);

  const chessMedalistsData = useMemo(() => {
    if (!extrasKey) return null;
    return archiveExtras.chess_medalists?.[extrasKey] || null;
  }, [archiveExtras, extrasKey]);

  const leaderboardsData = useMemo(() => {
    if (!extrasKey) return null;
    return archiveExtras.leaderboards?.[extrasKey] || null;
  }, [archiveExtras, extrasKey]);

  // Filtered standings for the selected sport, season & division
  const sportStandings = useMemo(() => {
    if (!currentSportMeta || !currentSeason || !currentDivision) return [];
    return data.filter((item) => {
      const matchSport = item.sport.toLowerCase() === currentSportMeta.name.toLowerCase();
      const matchSeason = item.season.toLowerCase() === currentSeason.toLowerCase();
      const matchDivision = item.division.toLowerCase() === currentDivision.toLowerCase();
      const matchStage = stageFilter === "All" || item.stage.startsWith(stageFilter);
      return matchSport && matchSeason && matchDivision && matchStage;
    });
  }, [data, currentSportMeta, currentSeason, currentDivision, stageFilter]);

  // Check if current standings use points
  const isPointsBased = useMemo(() => {
    if (currentSportMeta?.slug === "general-championship" || currentSportMeta?.slug === "chess") return true;
    return sportStandings.some((item) => item.points !== null && item.points !== undefined);
  }, [sportStandings, currentSportMeta]);

  // Check available stages for the selected sport, season & division
  const availableStages = useMemo(() => {
    if (!currentSportMeta || !currentSeason || !currentDivision) return [];
    const stages = new Set(
      data
        .filter(
          (item) =>
            item.sport.toLowerCase() === currentSportMeta.name.toLowerCase() &&
            item.season.toLowerCase() === currentSeason.toLowerCase() &&
            item.division.toLowerCase() === currentDivision.toLowerCase()
        )
        .map((item) => item.stage)
    );
    return Array.from(stages);
  }, [data, currentSportMeta, currentSeason, currentDivision]);

  // Filtered games if available
  const filteredGames = useMemo(() => {
    if (!gamesData || gamesData.length === 0) return [];
    return gamesData.filter((g) => {
      if (!matchSearch) return true;
      const q = matchSearch.toUpperCase();
      const w = (g.winner?.school || "").toUpperCase();
      const l = (g.loser?.school || "").toUpperCase();
      return w.includes(q) || l.includes(q);
    });
  }, [gamesData, matchSearch]);

  const handleSelectSport = (sport: SportMeta) => {
    router.push(`/uaap?sport=${encodeURIComponent(sport.name)}`);
  };

  const handleSelectSeason = (season: string) => {
    if (!currentSportMeta) return;
    const matching = data.filter(
      (item) =>
        item.sport.toLowerCase() === currentSportMeta.name.toLowerCase() &&
        item.season.toLowerCase() === season.toLowerCase()
    );
    const divs = Array.from(new Set(matching.map((item) => item.division)));
    const firstDiv = divs[0] || currentSportMeta.divisions[0] || "Men's";
    router.push(
      `/uaap?sport=${encodeURIComponent(currentSportMeta.name)}&season=${encodeURIComponent(season)}&division=${encodeURIComponent(firstDiv)}`
    );
  };

  const handleSelectDivision = (div: string) => {
    if (!currentSportMeta || !currentSeason) return;
    router.push(
      `/uaap?sport=${encodeURIComponent(currentSportMeta.name)}&season=${encodeURIComponent(currentSeason)}&division=${encodeURIComponent(div)}&tab=${tabParam}`
    );
  };

  const handleSelectTab = (tab: string) => {
    if (!currentSportMeta || !currentSeason || !currentDivision) return;
    router.push(
      `/uaap?sport=${encodeURIComponent(currentSportMeta.name)}&season=${encodeURIComponent(currentSeason)}&division=${encodeURIComponent(currentDivision)}&tab=${tab}`
    );
  };

  const handleBackToSeasons = () => {
    if (!currentSportMeta) return;
    router.push(`/uaap?sport=${encodeURIComponent(currentSportMeta.name)}`);
  };

  const handleBackToSports = () => {
    router.push("/uaap");
  };

  // Division-specific awards
  const divisionAwards = useMemo(() => {
    if (!awardsData || !currentDivision) return null;
    return awardsData[currentDivision] || awardsData[currentDivision.replace("'s", "")] || null;
  }, [awardsData, currentDivision]);

  // Division-specific chess medalists
  const divisionChessMedalists = useMemo(() => {
    if (!chessMedalistsData || !currentDivision) return null;
    return chessMedalistsData[currentDivision] || chessMedalistsData[currentDivision.replace("'s", "")] || null;
  }, [chessMedalistsData, currentDivision]);

  return (
    <div className="space-y-6 max-w-7xl mx-auto p-4 md:p-6 pb-20">
      {/* VIEW 1: OFF THE RIP — GRID OF ALL SPORTS & GENERAL CHAMPIONSHIP HERO */}
      {!currentSportMeta ? (
        <div className="space-y-6 animate-in fade-in duration-200">
          {/* Header Banner */}
          <div className="p-6 md:p-8 rounded-3xl bg-gradient-to-br from-surface via-surface to-elevated border border-border relative overflow-hidden shadow-lg">
            <div className="absolute -right-10 -bottom-10 w-64 h-64 bg-amber-500/5 rounded-full blur-3xl pointer-events-none" />
            <div className="max-w-2xl relative z-10">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-500/10 text-amber-400 border border-amber-500/20 mb-3">
                <Trophy size={13} />
                Multi-Era Official Historical Archive
              </span>
              <h1 className="text-2xl md:text-3xl font-black text-foreground tracking-tight">
                UAAP Tournament & Athletics Archive
              </h1>
              <p className="text-sm text-muted mt-2 leading-relaxed">
                Digitized annual reports across 7 benchmark seasons (1987 to 2004). Explore general championship standings, 13 official sports tournaments, individual awards, and game results.
              </p>

              {/* Season Pills */}
              <div className="flex flex-wrap items-center gap-2 mt-4">
                <span className="text-xs font-bold text-muted uppercase tracking-wider mr-1">Digitized Seasons:</span>
                {["1987-1988", "1988-1989", "1989-1990", "1998-1999", "1999-2000", "2000-2001", "2003-2004"].map((s) => (
                  <span key={s} className="px-2.5 py-0.5 rounded-lg text-xs font-semibold bg-surface border border-border text-foreground/80">
                    {s}
                  </span>
                ))}
              </div>
            </div>
          </div>

          {/* Featured: General Championship Card */}
          {(() => {
            const genSport = SPORTS_META.find((s) => s.slug === "general-championship");
            if (!genSport) return null;
            const genMatching = data.filter((item) => item.sport === genSport.name);
            const genSeasons = Array.from(new Set(genMatching.map((item) => item.season))).sort().reverse();
            return (
              <div
                onClick={() => handleSelectSport(genSport)}
                className="p-5 md:p-6 rounded-3xl bg-gradient-to-r from-amber-500/10 via-amber-500/5 to-surface border border-amber-500/30 hover:border-amber-400/60 transition-all cursor-pointer group shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4"
              >
                <div className="flex items-center gap-4">
                  <div className="p-3.5 rounded-2xl bg-amber-500/20 text-amber-400 border border-amber-500/30 group-hover:scale-110 transition-transform">
                    <Crown className="w-8 h-8" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-extrabold uppercase tracking-wider text-amber-400">
                        Perpetual Trophy
                      </span>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-amber-500/10 text-amber-400 border border-amber-500/20">
                        {genSeasons.length} Seasons Digitized
                      </span>
                    </div>
                    <h3 className="text-xl font-black text-foreground mt-0.5 group-hover:text-amber-400 transition-colors">
                      General Championship Standings
                    </h3>
                    <p className="text-xs text-muted mt-1">
                      Aggregated overall university points across all sports for Collegiate and Junior divisions.
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0 self-end sm:self-auto">
                  <span className="text-xs font-bold text-amber-400 group-hover:translate-x-1 transition-transform">
                    View Overall Standings
                  </span>
                  <div className="p-2 rounded-xl bg-amber-500/20 text-amber-400">
                    <ChevronRight size={16} />
                  </div>
                </div>
              </div>
            );
          })()}

          {/* Sports Grid */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-xs font-bold uppercase tracking-wider text-muted">
                Official UAAP Sports Tournaments
              </h2>
              <span className="text-xs text-muted font-medium">
                {SPORTS_META.filter((s) => !s.isFeatured).length} Sports
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3.5">
              {SPORTS_META.filter((s) => !s.isFeatured).map((sport) => {
                const Icon = sport.icon;
                const matching = data.filter((item) => item.sport.toLowerCase() === sport.name.toLowerCase());
                const seasonsCount = Array.from(new Set(matching.map((item) => item.season))).length;

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
                    <div className="w-full flex justify-between items-center text-[10px] font-semibold text-muted/80">
                      <span className="bg-elevated px-2 py-0.5 rounded-md">
                        {seasonsCount} {seasonsCount === 1 ? "Season" : "Seasons"}
                      </span>
                      <span className="bg-elevated px-1.5 py-0.5 rounded-md">
                        {sport.divisions.length} {sport.divisions.length > 1 ? "Divs" : "Div"}
                      </span>
                    </div>

                    <div className="my-auto flex flex-col items-center justify-center transition-transform group-hover:scale-110">
                      <div className={cn("p-3 rounded-2xl bg-elevated/60 shadow-inner", sport.color)}>
                        <Icon className="w-8 h-8 sm:w-9 sm:h-9" />
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
        </div>
      ) : !currentSeason ? (
        /* VIEW 2: SPORT CLICKED — SEASONS AVAILABLE SELECTOR */
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-200">
          {/* Back Navigation & Sport Title */}
          <div className="flex items-center justify-between gap-4 border-b border-border/60 pb-4">
            <div className="flex items-center gap-3">
              <button
                onClick={handleBackToSports}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-surface border border-border text-muted hover:text-foreground hover:bg-elevated transition-colors cursor-pointer"
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

            <span className="text-xs font-semibold text-muted bg-surface border border-border px-3 py-1 rounded-xl">
              {availableSeasons.length} {availableSeasons.length === 1 ? "Season Available" : "Seasons Available"}
            </span>
          </div>

          <div>
            <h3 className="text-base font-bold text-foreground">Available Archived Seasons</h3>
            <p className="text-xs text-muted mt-0.5">
              Select an annual report year to inspect standings, champions, awards, and tournament records.
            </p>
          </div>

          {availableSeasons.length === 0 ? (
            <div className="bg-surface border border-border rounded-2xl p-12 text-center">
              <Calendar className="w-10 h-10 text-muted mx-auto mb-3 opacity-40" />
              <h4 className="text-sm font-bold text-foreground">No Archived Seasons Available</h4>
              <p className="text-xs text-muted mt-1 max-w-sm mx-auto">
                Historical records for {currentSportMeta.name} are pending digitization.
              </p>
              <button
                onClick={handleBackToSports}
                className="mt-4 inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-semibold bg-elevated hover:bg-elevated/80 border border-border text-foreground transition-all cursor-pointer"
              >
                <ArrowLeft size={14} />
                <span>Back to All Sports</span>
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {availableSeasons.map((season) => {
                const info = formatSeasonLabel(season);
                const matching = data.filter(
                  (item) =>
                    item.sport.toLowerCase() === currentSportMeta.name.toLowerCase() &&
                    item.season.toLowerCase() === season.toLowerCase()
                );
                const divs = Array.from(new Set(matching.map((item) => item.division)));
                const recordsCount = matching.length;
                const champRecord = matching.find(
                  (r) => r.rank === 1 && (r.details?.includes("Champion") || r.stage.toLowerCase().includes("final"))
                );

                const hasGames = (archiveExtras.games?.[`${currentSportMeta.name}|${season}`] || []).length > 0;
                const hasAwards = !!archiveExtras.awards?.[`${currentSportMeta.name}|${season}`];

                return (
                  <button
                    key={season}
                    onClick={() => handleSelectSeason(season)}
                    className={cn(
                      "flex flex-col justify-between p-5 rounded-2xl bg-surface border border-border transition-all duration-200 text-left group cursor-pointer shadow-sm",
                      "hover:border-amber-500/60 hover:bg-elevated/40 hover:scale-[1.02] hover:shadow-lg focus:outline-none focus:ring-2 focus:ring-amber-500/50"
                    )}
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

                    {champRecord && (
                      <div className="mt-3 inline-flex items-center gap-1.5 text-xs font-medium text-muted">
                        <Trophy size={13} className="text-amber-400 shrink-0" />
                        <span className="truncate">
                          Champion: <strong className="text-foreground">{champRecord.team}</strong> ({champRecord.division})
                        </span>
                      </div>
                    )}

                    <div className="mt-4 pt-3.5 border-t border-border/60 flex items-center justify-between text-xs text-muted w-full">
                      <div className="flex items-center gap-2 truncate">
                        <span className="flex items-center gap-1">
                          <Layers size={12} className="text-amber-400" />
                          <span>{divs.length} {divs.length > 1 ? "Divisions" : "Div"}</span>
                        </span>
                        {hasAwards && (
                          <span className="px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-400 font-semibold text-[10px]">
                            Awards
                          </span>
                        )}
                        {hasGames && (
                          <span className="px-1.5 py-0.5 rounded bg-sky-500/10 text-sky-400 font-semibold text-[10px]">
                            Games
                          </span>
                        )}
                      </div>
                      <span className="font-semibold text-foreground/80 shrink-0">
                        {recordsCount} records
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      ) : (
        /* VIEW 3: SPORT & SEASON OPENED — SUB-TABS (STANDINGS, AWARDS, GAMES, LEADERS) */
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-200">
          {/* Top Bar: Back Nav & Sport Header */}
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-border/60 pb-4">
            <div className="flex items-center gap-3">
              <button
                onClick={handleBackToSeasons}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-surface border border-border text-muted hover:text-foreground hover:bg-elevated transition-colors cursor-pointer"
                title="Back to seasons"
              >
                <ArrowLeft size={14} />
                <span>Seasons</span>
              </button>

              <button
                onClick={handleBackToSports}
                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-medium text-muted hover:text-foreground hover:bg-elevated transition-colors cursor-pointer"
                title="Back to all sports"
              >
                All Sports
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

            {/* Combined Selectors: Season & Division */}
            <div className="flex flex-wrap items-center gap-2">
              {/* Season Selector Pills */}
              <div className="flex items-center gap-1.5 p-1 bg-surface border border-border rounded-xl">
                <span className="text-[11px] font-bold text-muted px-2 uppercase tracking-wider hidden sm:inline">
                  Season:
                </span>
                {availableSeasons.map((s) => {
                  const info = formatSeasonLabel(s);
                  const active = currentSeason.toLowerCase() === s.toLowerCase();
                  return (
                    <button
                      key={s}
                      onClick={() => handleSelectSeason(s)}
                      className={cn(
                        "px-3 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer",
                        active
                          ? "bg-amber-500 text-slate-950 font-bold shadow-sm"
                          : "text-muted hover:text-foreground hover:bg-elevated"
                      )}
                    >
                      {info.seasonNumber} ({info.year})
                    </button>
                  );
                })}
              </div>

              {/* Division Selector Pills */}
              <div className="flex items-center gap-1.5 p-1 bg-surface border border-border rounded-xl">
                <span className="text-[11px] font-bold text-muted px-2 uppercase tracking-wider hidden sm:inline">
                  Division:
                </span>
                {availableDivisionsForSeason.map((div) => {
                  const active = currentDivision?.toLowerCase() === div.toLowerCase();
                  return (
                    <button
                      key={div}
                      onClick={() => handleSelectDivision(div)}
                      className={cn(
                        "px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer",
                        active
                          ? "bg-primary text-primary-foreground font-bold shadow-sm"
                          : "text-muted hover:text-foreground hover:bg-elevated"
                      )}
                    >
                      {div}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Sub-Navigation Tabs: Standings / Awards / Games / Leaders */}
          <div className="flex items-center gap-2 border-b border-border pb-1 overflow-x-auto">
            <button
              onClick={() => handleSelectTab("standings")}
              className={cn(
                "inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer",
                tabParam === "standings"
                  ? "bg-amber-500 text-slate-950 shadow-sm"
                  : "text-muted hover:text-foreground hover:bg-elevated"
              )}
            >
              <Trophy size={14} />
              <span>Standings</span>
              <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-black/15 font-semibold">
                {sportStandings.length}
              </span>
            </button>

            {(awardsData || chessMedalistsData) && (
              <button
                onClick={() => handleSelectTab("awards")}
                className={cn(
                  "inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer",
                  tabParam === "awards"
                    ? "bg-amber-500 text-slate-950 shadow-sm"
                    : "text-muted hover:text-foreground hover:bg-elevated"
                )}
              >
                <Award size={14} />
                <span>Awards & Honors</span>
                <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-black/15 font-semibold">
                  ★
                </span>
              </button>
            )}

            {gamesData.length > 0 && (
              <button
                onClick={() => handleSelectTab("games")}
                className={cn(
                  "inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer",
                  tabParam === "games"
                    ? "bg-amber-500 text-slate-950 shadow-sm"
                    : "text-muted hover:text-foreground hover:bg-elevated"
                )}
              >
                <Activity size={14} />
                <span>Game Results</span>
                <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-black/15 font-semibold">
                  {gamesData.length}
                </span>
              </button>
            )}

            {leaderboardsData && (
              <button
                onClick={() => handleSelectTab("leaders")}
                className={cn(
                  "inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer",
                  tabParam === "leaders"
                    ? "bg-amber-500 text-slate-950 shadow-sm"
                    : "text-muted hover:text-foreground hover:bg-elevated"
                )}
              >
                <TrendingUp size={14} />
                <span>Stat Leaders</span>
              </button>
            )}
          </div>

          {/* TAB CONTENT 1: STANDINGS */}
          {tabParam === "standings" && (
            <div className="space-y-4">
              {availableStages.length > 1 && (
                <div className="flex items-center gap-1.5 p-1 bg-surface border border-border rounded-xl self-start flex-wrap">
                  <span className="text-xs font-semibold text-muted px-2">Stage:</span>
                  {["All", ...availableStages].map((stg) => {
                    const active = stageFilter === stg;
                    return (
                      <button
                        key={stg}
                        onClick={() => setStageFilter(stg)}
                        className={cn(
                          "px-2.5 py-1 rounded-lg text-xs font-medium transition-all cursor-pointer",
                          active
                            ? "bg-primary text-primary-foreground font-semibold"
                            : "text-muted hover:bg-elevated hover:text-foreground"
                        )}
                      >
                        {stg}
                      </button>
                    );
                  })}
                </div>
              )}

              {/* Standings Table Card */}
              <div className="bg-surface border border-border rounded-2xl overflow-hidden shadow-sm">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm border-collapse">
                    <thead>
                      <tr className="border-b border-border bg-elevated/40 text-[11px] font-bold uppercase tracking-wider text-muted">
                        <th className="py-3 px-4 w-14 text-center">Rank</th>
                        <th className="py-3 px-4">School</th>
                        {!isPointsBased && <th className="py-3 px-4">Stage</th>}
                        {isPointsBased ? (
                          <th className="py-3 px-4 text-center">Total Points</th>
                        ) : (
                          <>
                            <th className="py-3 px-4 text-center">Wins</th>
                            <th className="py-3 px-4 text-center">Losses</th>
                            <th className="py-3 px-4 text-center">Win %</th>
                          </>
                        )}
                        <th className="py-3 px-4">Result / Notes</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/60 font-medium">
                      {sportStandings.length === 0 ? (
                        <tr>
                          <td colSpan={isPointsBased ? 4 : 7} className="py-12 text-center text-muted">
                            No standings found for this division/stage.
                          </td>
                        </tr>
                      ) : (
                        sportStandings.map((item, idx) => {
                          const theme = getSchoolTheme(item.team);
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

                              {/* Stage (if not points based) */}
                              {!isPointsBased && (
                                <td className="py-3 px-4">
                                  <span className="inline-block px-2 py-0.5 rounded-md bg-elevated text-[11px] text-muted font-medium">
                                    {item.stage}
                                  </span>
                                </td>
                              )}

                              {/* Points or Wins/Losses */}
                              {isPointsBased ? (
                                <td className="py-3 px-4 text-center font-bold text-amber-400 font-mono">
                                  {item.points !== null && item.points !== undefined ? `${item.points} pts` : "—"}
                                </td>
                              ) : (
                                <>
                                  <td className="py-3 px-4 text-center font-bold text-foreground">
                                    {item.wins !== null && item.wins !== undefined ? item.wins : "—"}
                                  </td>
                                  <td className="py-3 px-4 text-center font-bold text-muted">
                                    {item.losses !== null && item.losses !== undefined ? item.losses : "—"}
                                  </td>
                                  <td className="py-3 px-4 text-center font-mono text-xs text-foreground font-semibold">
                                    {item.pct !== null && item.pct !== undefined ? item.pct.toFixed(3) : "—"}
                                  </td>
                                </>
                              )}

                              {/* Result / Notes */}
                              <td className="py-3 px-4 text-xs text-muted">
                                {item.details ? (
                                  <span
                                    className={cn(
                                      "font-medium",
                                      isChamp && "text-amber-400 font-bold",
                                      isRunnerUp && "text-slate-300 font-semibold"
                                    )}
                                  >
                                    {item.details}
                                  </span>
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

          {/* TAB CONTENT 2: AWARDS & HONORS */}
          {tabParam === "awards" && (
            <div className="space-y-6">
              {divisionAwards ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {divisionAwards.mvp && (
                    <div className="p-5 rounded-2xl bg-surface border border-amber-500/30 shadow-sm flex items-start gap-4">
                      <div className="p-3 rounded-xl bg-amber-500/20 text-amber-400">
                        <Crown size={24} />
                      </div>
                      <div className="flex-1">
                        <span className="text-[11px] font-bold uppercase tracking-wider text-amber-400 block">
                          Most Valuable Player
                        </span>
                        <h3 className="text-lg font-black text-foreground mt-0.5">
                          {divisionAwards.mvp.player}
                        </h3>
                        <div className="mt-2 flex items-center gap-2">
                          <span
                            className={cn(
                              "px-2.5 py-0.5 rounded-md border text-xs font-bold",
                              getSchoolTheme(divisionAwards.mvp.school).bg,
                              getSchoolTheme(divisionAwards.mvp.school).text
                            )}
                          >
                            {divisionAwards.mvp.school}
                          </span>
                          <span className="text-xs text-muted">
                            {getSchoolTheme(divisionAwards.mvp.school).name}
                          </span>
                        </div>
                      </div>
                    </div>
                  )}

                  {divisionAwards.rookie_of_the_year && (
                    <div className="p-5 rounded-2xl bg-surface border border-sky-500/30 shadow-sm flex items-start gap-4">
                      <div className="p-3 rounded-xl bg-sky-500/20 text-sky-400">
                        <Sparkles size={24} />
                      </div>
                      <div className="flex-1">
                        <span className="text-[11px] font-bold uppercase tracking-wider text-sky-400 block">
                          Rookie of the Year
                        </span>
                        <h3 className="text-lg font-black text-foreground mt-0.5">
                          {divisionAwards.rookie_of_the_year.player}
                        </h3>
                        <div className="mt-2 flex items-center gap-2">
                          <span
                            className={cn(
                              "px-2.5 py-0.5 rounded-md border text-xs font-bold",
                              getSchoolTheme(divisionAwards.rookie_of_the_year.school).bg,
                              getSchoolTheme(divisionAwards.rookie_of_the_year.school).text
                            )}
                          >
                            {divisionAwards.rookie_of_the_year.school}
                          </span>
                          <span className="text-xs text-muted">
                            {getSchoolTheme(divisionAwards.rookie_of_the_year.school).name}
                          </span>
                        </div>
                      </div>
                    </div>
                  )}

                  {divisionAwards.mythical_five && Array.isArray(divisionAwards.mythical_five) && (
                    <div className="p-5 rounded-2xl bg-surface border border-border shadow-sm md:col-span-2">
                      <div className="flex items-center gap-2 mb-3">
                        <Medal className="w-5 h-5 text-amber-400" />
                        <h4 className="text-sm font-bold text-foreground uppercase tracking-wider">
                          Mythical Selection
                        </h4>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                        {divisionAwards.mythical_five.map((player: any, pIdx: number) => {
                          const pName = typeof player === "string" ? player : player.name || player.player;
                          const pSchool = typeof player === "object" ? player.school : null;
                          const pPos = typeof player === "object" ? player.position : null;
                          return (
                            <div key={pIdx} className="p-3 rounded-xl bg-elevated/60 border border-border flex items-center justify-between gap-2">
                              <div>
                                <span className="font-bold text-sm text-foreground block">{pName}</span>
                                {pPos && <span className="text-[11px] text-muted">{pPos}</span>}
                              </div>
                              {pSchool && (
                                <span
                                  className={cn(
                                    "px-2 py-0.5 rounded border text-[11px] font-bold",
                                    getSchoolTheme(pSchool).bg,
                                    getSchoolTheme(pSchool).text
                                  )}
                                >
                                  {pSchool}
                                </span>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              ) : null}

              {/* Chess Board Medalists */}
              {divisionChessMedalists && (
                <div className="p-5 rounded-2xl bg-surface border border-border shadow-sm">
                  <div className="flex items-center gap-2 mb-4">
                    <Crown className="w-5 h-5 text-amber-400" />
                    <h4 className="text-base font-bold text-foreground">
                      Individual Board Medalists ({currentDivision})
                    </h4>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {Object.entries(divisionChessMedalists).map(([boardNum, medals]: [string, any]) => (
                      <div key={boardNum} className="p-4 rounded-xl bg-elevated/50 border border-border space-y-2.5">
                        <h5 className="text-xs font-bold uppercase tracking-wider text-muted flex items-center justify-between">
                          <span>Board {boardNum}</span>
                        </h5>
                        <div className="space-y-1.5 text-xs">
                          {Array.isArray(medals) &&
                            medals.map((m: any, mIdx: number) => {
                              const medalEmoji = m.medal === "gold" ? "🥇" : m.medal === "silver" ? "🥈" : "🥉";
                              const theme = getSchoolTheme(m.school);
                              return (
                                <div key={mIdx} className="flex items-center justify-between gap-2">
                                  <span className="flex items-center gap-1.5 truncate">
                                    <span>{medalEmoji}</span>
                                    <strong className="text-foreground">{m.player}</strong>
                                  </span>
                                  <span className={cn("px-1.5 py-0.5 rounded border text-[10px] font-bold", theme.bg, theme.text)}>
                                    {m.school}
                                  </span>
                                </div>
                              );
                            })}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {!divisionAwards && !divisionChessMedalists && (
                <div className="p-12 text-center text-muted bg-surface border border-border rounded-2xl">
                  No individual awards recorded for this division in {currentSeason}.
                </div>
              )}
            </div>
          )}

          {/* TAB CONTENT 3: GAME RESULTS */}
          {tabParam === "games" && (
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
                <div className="relative w-full sm:w-72">
                  <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
                  <input
                    type="text"
                    value={matchSearch}
                    onChange={(e) => setMatchSearch(e.target.value)}
                    placeholder="Search by team (e.g. ADMU, FEU)..."
                    className="w-full pl-9 pr-3 py-1.5 rounded-xl text-xs bg-surface border border-border text-foreground placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-amber-500/50"
                  />
                </div>
                <span className="text-xs text-muted font-medium self-end sm:self-auto">
                  Showing {filteredGames.length} of {gamesData.length} matches
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {filteredGames.length === 0 ? (
                  <div className="col-span-full p-12 text-center text-muted bg-surface border border-border rounded-2xl">
                    No game results matched your filter.
                  </div>
                ) : (
                  filteredGames.map((game, gIdx) => {
                    const wTheme = getSchoolTheme(game.winner?.school);
                    const lTheme = getSchoolTheme(game.loser?.school);
                    const wScore = game.winner?.score;
                    const lScore = game.loser?.score;

                    return (
                      <div
                        key={gIdx}
                        className={cn(
                          "p-4 rounded-2xl bg-surface border border-border shadow-sm flex flex-col justify-between space-y-3",
                          game.is_championship && "border-amber-500/40 bg-gradient-to-br from-amber-500/5 via-surface to-surface"
                        )}
                      >
                        <div className="flex items-center justify-between text-[11px] text-muted">
                          <span className="font-semibold uppercase tracking-wider">
                            {game.round ? game.round.replace(/_/g, " ") : "Match"}
                          </span>
                          {game.is_championship ? (
                            <span className="px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-400 font-bold text-[10px]">
                              🏆 Championship
                            </span>
                          ) : (
                            game.date && <span>{game.date}</span>
                          )}
                        </div>

                        {/* Matchup row */}
                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <span className={cn("px-2 py-0.5 rounded-md border text-xs font-bold", wTheme.bg, wTheme.text)}>
                                {game.winner?.school}
                              </span>
                              <span className="text-xs font-semibold text-foreground truncate max-w-[120px]">
                                {wTheme.name}
                              </span>
                            </div>
                            <span className="text-base font-black text-foreground font-mono">
                              {wScore ?? "W"}
                            </span>
                          </div>

                          <div className="flex items-center justify-between opacity-80">
                            <div className="flex items-center gap-2">
                              <span className={cn("px-2 py-0.5 rounded-md border text-xs font-bold", lTheme.bg, lTheme.text)}>
                                {game.loser?.school}
                              </span>
                              <span className="text-xs font-medium text-muted truncate max-w-[120px]">
                                {lTheme.name}
                              </span>
                            </div>
                            <span className="text-base font-medium text-muted font-mono">
                              {lScore ?? "L"}
                            </span>
                          </div>
                        </div>

                        {game.stage && (
                          <div className="pt-2 border-t border-border/60 text-[10px] text-muted truncate">
                            {game.stage}
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          )}

          {/* TAB CONTENT 4: STATISTICAL LEADERS */}
          {tabParam === "leaders" && (
            <div className="space-y-6">
              {leaderboardsData ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {Object.entries(
                    (leaderboardsData as any)["men"] || (currentDivision ? (leaderboardsData as any)[currentDivision.toLowerCase()] : null) || leaderboardsData
                  ).map(([cat, players]: [string, any]) => {
                    if (!Array.isArray(players)) return null;
                    return (
                      <div key={cat} className="p-5 rounded-2xl bg-surface border border-border shadow-sm space-y-3">
                        <div className="flex items-center justify-between border-b border-border/60 pb-2">
                          <h4 className="text-sm font-bold uppercase tracking-wider text-amber-400">
                            Top {cat.replace(/_/g, " ")}
                          </h4>
                          <span className="text-[10px] font-semibold text-muted">Average</span>
                        </div>

                        <div className="space-y-2">
                          {players.slice(0, 10).map((p: any, idx: number) => {
                            const theme = getSchoolTheme(p.school);
                            return (
                              <div key={idx} className="flex items-center justify-between text-xs">
                                <div className="flex items-center gap-2 truncate">
                                  <span className="text-muted font-mono w-4 text-center font-bold">
                                    {p.rank || idx + 1}
                                  </span>
                                  <span className="font-semibold text-foreground truncate">
                                    {p.player}
                                  </span>
                                  <span className={cn("px-1.5 py-0.2 rounded border text-[10px] font-bold shrink-0", theme.bg, theme.text)}>
                                    {p.school}
                                  </span>
                                </div>
                                <span className="font-mono font-bold text-foreground ml-2 shrink-0">
                                  {p.value || p.stat}
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="p-12 text-center text-muted bg-surface border border-border rounded-2xl">
                  No statistical leaderboards compiled for this season.
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
