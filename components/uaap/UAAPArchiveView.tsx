"use client";

import { cn } from "@/lib/utils";
import { BookOpen, Download, Filter, Search, Trophy } from "lucide-react";
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

const SPORTS_LIST = [
  "All",
  "Basketball",
  "Volleyball",
  "Badminton",
  "Table Tennis",
  "Tae Kwon Do",
  "Judo",
  "Baseball",
  "Softball",
  "Football",
  "Fencing",
  "Chess",
];

const DIVISIONS_LIST = ["All", "Men's", "Women's", "Juniors", "Girls"];

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

  const sportParam = searchParams.get("sport") || "All";
  const divisionParam = searchParams.get("division") || "All";

  const [selectedSport, setSelectedSport] = useState(sportParam);
  const [selectedDivision, setSelectedDivision] = useState(divisionParam);
  const [searchQuery, setSearchQuery] = useState("");
  const [stageFilter, setStageFilter] = useState<"All" | "Final Standings" | "Elimination Round">("All");

  const data = standingsData as StandingRecord[];

  const handleSportSelect = (sport: string) => {
    setSelectedSport(sport);
    const params = new URLSearchParams(searchParams.toString());
    if (sport === "All") params.delete("sport");
    else params.set("sport", sport);
    router.replace(`/uaap?${params.toString()}`, { scroll: false });
  };

  const handleDivisionSelect = (division: string) => {
    setSelectedDivision(division);
    const params = new URLSearchParams(searchParams.toString());
    if (division === "All") params.delete("division");
    else params.set("division", division);
    router.replace(`/uaap?${params.toString()}`, { scroll: false });
  };

  const filteredData = useMemo(() => {
    return data.filter((item) => {
      const matchSport = selectedSport === "All" || item.sport.toLowerCase() === selectedSport.toLowerCase();
      const matchDivision = selectedDivision === "All" || item.division.toLowerCase() === selectedDivision.toLowerCase();
      const matchStage = stageFilter === "All" || item.stage === stageFilter;
      const matchQuery =
        !searchQuery ||
        item.team.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.sport.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (item.details && item.details.toLowerCase().includes(searchQuery.toLowerCase()));

      return matchSport && matchDivision && matchStage && matchQuery;
    });
  }, [data, selectedSport, selectedDivision, stageFilter, searchQuery]);

  return (
    <div className="space-y-6 max-w-7xl mx-auto p-4 md:p-6 pb-20">
      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border pb-5">
        <div>
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20">
              <Trophy size={13} />
              Historical Archive
            </span>
            <span className="text-xs text-muted font-medium">Season 66 (2003–2004)</span>
          </div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-foreground mt-1.5 flex items-center gap-2.5">
            UAAP Multi-Sport Archive
          </h1>
          <p className="text-sm text-muted mt-1">
            Official team standings, win-loss records, and podium finishes across all sports.
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2.5">
          <a
            href="/data/seasons/2003-2004/UAAP_2003_2004_Annual_Report.html"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold bg-elevated hover:bg-elevated/80 border border-border text-foreground transition-all"
          >
            <BookOpen size={14} className="text-amber-400" />
            <span>Digital Book Reader</span>
          </a>
          <a
            href="/data/seasons/2003-2004/UAAP_2003_2004_Annual_Report.pdf"
            download
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold bg-primary hover:bg-primary/90 text-primary-foreground transition-all shadow-sm"
          >
            <Download size={14} />
            <span>Download PDF</span>
          </a>
        </div>
      </div>

      {/* Sport Selector Carousel / Pills */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <label className="text-xs font-bold uppercase tracking-wider text-muted flex items-center gap-1.5">
            <Filter size={13} />
            Select Sport
          </label>
          <span className="text-xs text-muted font-medium">
            {filteredData.length} records found
          </span>
        </div>

        <div className="flex items-center gap-1.5 overflow-x-auto pb-2 scrollbar-none">
          {SPORTS_LIST.map((sport) => {
            const active = selectedSport.toLowerCase() === sport.toLowerCase();
            return (
              <button
                key={sport}
                onClick={() => handleSportSelect(sport)}
                className={cn(
                  "px-3.5 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all border",
                  active
                    ? "bg-amber-500 text-slate-950 border-amber-400 shadow-sm font-bold"
                    : "bg-surface text-muted border-border hover:bg-elevated hover:text-foreground"
                )}
              >
                {sport}
              </button>
            );
          })}
        </div>
      </div>

      {/* Division Selector & Search Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-surface border border-border rounded-2xl p-3">
        <div className="flex items-center gap-1.5 overflow-x-auto">
          <span className="text-xs font-semibold text-muted mr-1.5 shrink-0">Division:</span>
          {DIVISIONS_LIST.map((div) => {
            const active = selectedDivision.toLowerCase() === div.toLowerCase();
            return (
              <button
                key={div}
                onClick={() => handleDivisionSelect(div)}
                className={cn(
                  "px-3 py-1 rounded-lg text-xs font-medium transition-all",
                  active
                    ? "bg-primary text-primary-foreground font-semibold"
                    : "text-muted hover:bg-elevated hover:text-foreground"
                )}
              >
                {div}
              </button>
            );
          })}

          <div className="h-4 w-px bg-border mx-1" />

          {(["All", "Final Standings", "Elimination Round"] as const).map((stg) => {
            const active = stageFilter === stg;
            return (
              <button
                key={stg}
                onClick={() => setStageFilter(stg)}
                className={cn(
                  "px-2.5 py-1 rounded-lg text-[11px] font-medium transition-all whitespace-nowrap",
                  active
                    ? "bg-amber-500/20 text-amber-300 font-semibold border border-amber-500/40"
                    : "text-muted hover:bg-elevated hover:text-foreground"
                )}
              >
                {stg}
              </button>
            );
          })}
        </div>

        <div className="relative min-w-[200px] sm:w-64">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
          <input
            type="text"
            placeholder="Search school or details..."
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
                <th className="py-3 px-4">Sport & Division</th>
                <th className="py-3 px-4">Stage</th>
                <th className="py-3 px-4 text-center">Wins</th>
                <th className="py-3 px-4 text-center">Losses</th>
                <th className="py-3 px-4 text-center">Win %</th>
                <th className="py-3 px-4">Result / Notes</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60 font-medium">
              {filteredData.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-muted">
                    No standings matching your selected filters.
                  </td>
                </tr>
              ) : (
                filteredData.map((item, idx) => {
                  const theme = SCHOOL_THEMES[item.team] || {
                    bg: "bg-surface border-border",
                    text: "text-foreground",
                    name: item.team,
                  };

                  const isChamp = item.rank === 1 && (item.stage.includes("Final") || item.details?.includes("Champion"));
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
                              "px-2 py-0.5 rounded-md border text-xs font-bold shrink-0",
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

                      {/* Sport & Division */}
                      <td className="py-3 px-4">
                        <div className="flex flex-col">
                          <span className="font-semibold text-foreground text-xs">{item.sport}</span>
                          <span className="text-[11px] text-muted">{item.division}</span>
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
  );
}
