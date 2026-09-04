"use client";

import { useState, useMemo, useEffect, useCallback } from "react";
import { cn } from "@/lib/utils";
import type { ToastFn } from "@/components/admin/Toast";
import {
  saveUAAPArchiveData,
  deleteUAAPArchiveDivision,
  getUAAPAnnualReportSnippet,
  type UAAPStandingEntry,
} from "@/app/admin/actions";
import standingsData from "@/data/uaap_standings.json";
import archiveExtrasData from "@/data/uaap_archive_extras.json";
import {
  Trophy,
  Crown,
  Award,
  Plus,
  Trash2,
  ArrowUp,
  ArrowDown,
  Sparkles,
  ExternalLink,
  BookOpen,
  Save,
  RotateCcw,
  Wand2,
  FileText,
} from "lucide-react";

const STANDARD_UAAP_SCHOOLS = [
  { code: "ADMU", name: "Ateneo de Manila" },
  { code: "DLSU", name: "De La Salle" },
  { code: "FEU", name: "Far Eastern" },
  { code: "UST", name: "Univ. of Santo Tomas" },
  { code: "UP", name: "Univ. of the Philippines" },
  { code: "UE", name: "Univ. of the East" },
  { code: "AdU", name: "Adamson University" },
  { code: "NU", name: "National University" },
  { code: "DLSZ", name: "De La Salle Zobel (Juniors)" },
  { code: "UPIS", name: "UP Integrated School (Juniors)" },
  { code: "USTHS", name: "UST High School" },
  { code: "FEU-FERN", name: "FEU Diliman (FERN)" },
  { code: "AHS", name: "Ateneo High School" },
  { code: "UEHS", name: "UE High School" },
  { code: "NU-HS", name: "NU Nazareth (Juniors)" },
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

const ALL_SPORTS = [
  "General Championship",
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
  "Lawn Tennis",
  "Swimming",
];

const ALL_DIVISIONS = ["Men's", "Women's", "Juniors", "Collegiate", "Boys", "Girls"];

export function UAAPArchiveManager({ onToast }: { onToast: ToastFn }) {
  // Existing seasons discovered from current data
  const existingSeasons = useMemo(() => {
    const list = Array.from(new Set(standingsData.map((item: any) => item.season))).sort().reverse();
    return list.length > 0
      ? list
      : ["2003-2004", "2000-2001", "1999-2000", "1998-1999", "1989-1990", "1988-1989", "1987-1988"];
  }, []);

  // Selection states
  const [season, setSeason] = useState<string>(existingSeasons[0] || "2003-2004");
  const [newSeasonInput, setNewSeasonInput] = useState<string>("");
  const [showNewSeasonModal, setShowNewSeasonModal] = useState<boolean>(false);

  const [sport, setSport] = useState<string>("Basketball");
  const [division, setDivision] = useState<string>("Men's");

  // Mode: W-L format or Points format
  const [isPointsMode, setIsPointsMode] = useState<boolean>(false);

  // Editable rows
  const [standings, setStandings] = useState<UAAPStandingEntry[]>([]);

  // Editable awards
  const [mvpName, setMvpName] = useState<string>("");
  const [mvpSchool, setMvpSchool] = useState<string>("FEU");
  const [royName, setRoyName] = useState<string>("");
  const [roySchool, setRoySchool] = useState<string>("FEU");
  const [mythicalFive, setMythicalFive] = useState<Array<{ player: string; school: string; position?: string }>>([]);

  // Chess medalists (Boards 1-6)
  const [chessBoards, setChessBoards] = useState<
    Record<string, Array<{ medal: "gold" | "silver" | "bronze"; player: string; school: string }>>
  >({
    "1": [],
    "2": [],
    "3": [],
    "4": [],
    "5": [],
    "6": [],
  });

  // Smart quick-paste drawer state
  const [pasteText, setPasteText] = useState<string>("");
  const [showPasteBox, setShowPasteBox] = useState<boolean>(false);

  // Raw report reference drawer state
  const [showReportRef, setShowReportRef] = useState<boolean>(false);
  const [reportSnippet, setReportSnippet] = useState<string>("");
  const [reportSourceFile, setReportSourceFile] = useState<string>("");
  const [loadingReport, setLoadingReport] = useState<boolean>(false);

  // Saving state
  const [isSaving, setIsSaving] = useState<boolean>(false);

  // Load existing records whenever season, sport, or division changes
  const loadCurrentData = useCallback(() => {
    // 1. Find matching standings
    const matching = standingsData.filter(
      (item: any) =>
        item.season === season &&
        item.sport.toLowerCase() === sport.toLowerCase() &&
        item.division.toLowerCase() === division.toLowerCase()
    );

    if (matching.length > 0) {
      setStandings(
        matching.map((m: any, idx: number) => ({
          rank: m.rank || idx + 1,
          team: m.team,
          wins: m.wins,
          losses: m.losses,
          pct: m.pct,
          points: m.points,
          details: m.details,
        }))
      );
      setIsPointsMode(sport === "General Championship" || sport === "Chess" || matching.some((m: any) => m.points !== null && m.points !== undefined));
    } else {
      // Blank or pre-fill standard 8 schools
      setStandings([]);
      setIsPointsMode(sport === "General Championship" || sport === "Chess");
    }

    // 2. Load awards from extras
    const extrasKey = `${sport}|${season}`;
    const allExtras = archiveExtrasData as any;
    const aw = allExtras.awards?.[extrasKey]?.[division];
    if (aw) {
      setMvpName(aw.mvp?.player || "");
      setMvpSchool(aw.mvp?.school || "FEU");
      setRoyName(aw.rookie_of_the_year?.player || "");
      setRoySchool(aw.rookie_of_the_year?.school || "FEU");
      setMythicalFive(aw.mythical_five || []);
    } else {
      setMvpName("");
      setMvpSchool("FEU");
      setRoyName("");
      setRoySchool("FEU");
      setMythicalFive([]);
    }

    // 3. Load chess medalists if sport is Chess
    if (sport === "Chess") {
      const cm = allExtras.chess_medalists?.[extrasKey]?.[division];
      if (cm) {
        setChessBoards(cm);
      } else {
        setChessBoards({ "1": [], "2": [], "3": [], "4": [], "5": [], "6": [] });
      }
    }
  }, [season, sport, division]);

  useEffect(() => {
    loadCurrentData();
  }, [loadCurrentData]);

  // Load raw report snippet if drawer is open
  useEffect(() => {
    if (showReportRef) {
      setLoadingReport(true);
      getUAAPAnnualReportSnippet(season, sport).then((res) => {
        setReportSnippet(res.content);
        setReportSourceFile(res.sourceFile || "");
        setLoadingReport(false);
      });
    }
  }, [showReportRef, season, sport]);

  // Table row modifiers
  const handleUpdateRow = (idx: number, field: keyof UAAPStandingEntry, value: any) => {
    setStandings((prev) => {
      const next = [...prev];
      const row = { ...next[idx], [field]: value };

      // Auto-calc win % if wins and losses change
      if (field === "wins" || field === "losses") {
        const w = field === "wins" ? (value === "" ? null : Number(value)) : row.wins;
        const l = field === "losses" ? (value === "" ? null : Number(value)) : row.losses;
        if (typeof w === "number" && !isNaN(w) && typeof l === "number" && !isNaN(l) && w + l > 0) {
          row.pct = Number((w / (w + l)).toFixed(3));
        }
      }

      next[idx] = row;
      return next;
    });
  };

  const handleAddRow = (prefillTeam?: string) => {
    setStandings((prev) => [
      ...prev,
      {
        rank: prev.length + 1,
        team: prefillTeam || "FEU",
        wins: isPointsMode ? null : 0,
        losses: isPointsMode ? null : 0,
        pct: isPointsMode ? null : 0.0,
        points: isPointsMode ? 0 : null,
        details: null,
      },
    ]);
  };

  const handleDeleteRow = (idx: number) => {
    setStandings((prev) => {
      const next = prev.filter((_, i) => i !== idx);
      // Re-number ranks
      return next.map((r, i) => ({ ...r, rank: i + 1 }));
    });
  };

  const handleMoveRow = (idx: number, dir: -1 | 1) => {
    setStandings((prev) => {
      const target = idx + dir;
      if (target < 0 || target >= prev.length) return prev;
      const next = [...prev];
      const temp = next[idx];
      next[idx] = next[target];
      next[target] = temp;
      return next.map((r, i) => ({ ...r, rank: i + 1 }));
    });
  };

  const handlePrefillEightSchools = () => {
    const schools = ["UST", "DLSU", "FEU", "ADMU", "UP", "UE", "AdU", "NU"];
    setStandings(
      schools.map((team, idx) => ({
        rank: idx + 1,
        team,
        wins: isPointsMode ? null : 0,
        losses: isPointsMode ? null : 0,
        pct: isPointsMode ? null : 0.0,
        points: isPointsMode ? 0 : null,
        details: idx === 0 ? "Champion" : idx === 1 ? "Runner-up" : null,
      }))
    );
    onToast("Populated standard 8 UAAP teams.", "success");
  };

  const handleAutoSort = () => {
    setStandings((prev) => {
      const sorted = [...prev].sort((a, b) => {
        if (isPointsMode) {
          return (b.points || 0) - (a.points || 0);
        }
        if ((b.wins || 0) !== (a.wins || 0)) {
          return (b.wins || 0) - (a.wins || 0);
        }
        return (a.losses || 0) - (b.losses || 0);
      });
      return sorted.map((r, i) => ({
        ...r,
        rank: i + 1,
        details: i === 0 && !r.details ? "Champion" : i === 1 && !r.details ? "Runner-up" : r.details,
      }));
    });
    onToast("Auto-sorted table by record / points.", "success");
  };

  // Smart Text Parser for Quick Paste
  const handleParsePasteText = () => {
    if (!pasteText.trim()) return;

    const lines = pasteText.split("\n").map((l) => l.trim()).filter(Boolean);
    const newRows: UAAPStandingEntry[] = [];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const upper = line.toUpperCase();

      // Look for known school code or alias
      let matchedSchool: string | null = null;
      for (const s of STANDARD_UAAP_SCHOOLS) {
        if (upper.includes(s.code) || upper.includes(s.name.toUpperCase())) {
          matchedSchool = s.code;
          break;
        }
      }

      if (!matchedSchool) {
        // Simple word search
        if (upper.includes("ATENEO")) matchedSchool = "ADMU";
        else if (upper.includes("LA SALLE") || upper.includes("DLSU")) matchedSchool = "DLSU";
        else if (upper.includes("SANTO TOMAS") || upper.includes("UST")) matchedSchool = "UST";
        else if (upper.includes("FAR EASTERN") || upper.includes("FEU")) matchedSchool = "FEU";
        else if (upper.includes("PHILIPPINES") || upper.includes("UP")) matchedSchool = "UP";
        else if (upper.includes("EAST") || upper.includes("UE")) matchedSchool = "UE";
        else if (upper.includes("ADAMSON") || upper.includes("ADU")) matchedSchool = "AdU";
        else if (upper.includes("NATIONAL") || upper.includes("NU")) matchedSchool = "NU";
      }

      if (matchedSchool) {
        // Look for W-L pattern (e.g. 12-2, 12 - 2, 12 2)
        const wlMatch = line.match(/\b(\d{1,2})\s*[-–—/]\s*(\d{1,2})\b/);
        // Look for points pattern (e.g. 120.0 pts or 120 pts)
        const ptsMatch = line.match(/\b(\d{1,3}(?:\.\d)?)\s*(?:pts|points)?\b/i);

        let w: number | null = null;
        let l: number | null = null;
        let pts: number | null = null;

        if (wlMatch) {
          w = parseInt(wlMatch[1], 10);
          l = parseInt(wlMatch[2], 10);
        } else if (ptsMatch && isPointsMode) {
          pts = parseFloat(ptsMatch[1]);
        }

        let details: string | null = null;
        if (upper.includes("CHAMPION") || upper.includes("1ST")) details = "Champion";
        else if (upper.includes("RUNNER") || upper.includes("2ND")) details = "Runner-up";
        else if (upper.includes("3RD") || upper.includes("THIRD")) details = "3rd Place";

        newRows.push({
          rank: newRows.length + 1,
          team: matchedSchool,
          wins: w,
          losses: l,
          pct: w !== null && l !== null && w + l > 0 ? Number((w / (w + l)).toFixed(3)) : null,
          points: pts,
          details,
        });
      }
    }

    if (newRows.length > 0) {
      setStandings(newRows);
      setShowPasteBox(false);
      setPasteText("");
      onToast(`✨ Extracted ${newRows.length} team standings from text!`, "success");
    } else {
      onToast("Could not recognize school names in pasted text.", "error");
    }
  };

  // Save changes
  const handleSave = async () => {
    setIsSaving(true);

    const awardsPayload =
      mvpName.trim() || royName.trim() || mythicalFive.length > 0
        ? {
            mvp: mvpName.trim() ? { player: mvpName.trim(), school: mvpSchool } : null,
            rookie_of_the_year: royName.trim() ? { player: royName.trim(), school: roySchool } : null,
            mythical_five: mythicalFive.length > 0 ? mythicalFive : null,
          }
        : null;

    const chessPayload = sport === "Chess" ? chessBoards : null;

    const res = await saveUAAPArchiveData({
      season,
      sport,
      division,
      standings,
      awards: awardsPayload,
      chess_medalists: chessPayload,
    });

    setIsSaving(false);

    if (res.success) {
      onToast(`✅ Saved ${season} ${sport} (${division}) — ${standings.length} records!`, "success");
    } else {
      onToast(`Save failed: ${res.error}`, "error");
    }
  };

  // Delete division
  const handleDeleteDivision = async () => {
    if (!confirm(`Are you sure you want to delete all standings for ${season} ${sport} (${division})?`)) {
      return;
    }
    const res = await deleteUAAPArchiveDivision(season, sport, division);
    if (res.success) {
      setStandings([]);
      onToast(`Deleted ${season} ${sport} (${division}) standings.`, "success");
    } else {
      onToast(`Delete failed: ${res.error}`, "error");
    }
  };

  // Keyboard shortcut Ctrl+S
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "s") {
        e.preventDefault();
        handleSave();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  });

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-24">
      {/* HEADER BAR */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border pb-4">
        <div>
          <h2 className="text-xl font-black text-foreground flex items-center gap-2">
            <span className="p-2 rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/30">
              <Trophy size={18} />
            </span>
            UAAP Historical Archive Curation
          </h2>
          <p className="text-xs text-muted mt-1">
            Manually enter, edit, and fine-tune team standings, points, and awards for any season or sport.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <a
            href={`/uaap?sport=${encodeURIComponent(sport)}&season=${encodeURIComponent(season)}&division=${encodeURIComponent(division)}`}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-surface border border-border text-muted hover:text-foreground hover:bg-elevated transition-colors"
            title="Open live view in new tab"
          >
            <span>Preview Live</span>
            <ExternalLink size={13} />
          </a>

          <button
            type="button"
            onClick={() => setShowReportRef(!showReportRef)}
            className={cn(
              "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all cursor-pointer",
              showReportRef
                ? "bg-amber-500/20 text-amber-400 border-amber-500/40"
                : "bg-surface border-border text-muted hover:text-foreground"
            )}
            title="Inspect raw annual report text"
          >
            <BookOpen size={14} />
            <span>OCR Reference</span>
          </button>

          <button
            type="button"
            onClick={handleSave}
            disabled={isSaving}
            className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-xl text-xs font-bold bg-amber-500 text-slate-950 hover:bg-amber-400 active:scale-95 transition-all shadow-sm cursor-pointer disabled:opacity-50"
          >
            <Save size={14} />
            <span>{isSaving ? "Saving..." : "Save (Ctrl+S)"}</span>
          </button>
        </div>
      </div>

      {/* SELECTORS ROW */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-5 rounded-2xl bg-surface border border-border shadow-sm">
        {/* Season Selector */}
        <div>
          <label className="text-[11px] font-bold uppercase tracking-wider text-muted block mb-1.5">
            Season
          </label>
          <div className="flex items-center gap-2">
            <select
              value={season}
              onChange={(e) => setSeason(e.target.value)}
              className="flex-1 px-3 py-2 rounded-xl text-xs font-bold bg-elevated border border-border text-foreground focus:outline-none focus:ring-2 focus:ring-amber-500/50"
            >
              {existingSeasons.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={() => setShowNewSeasonModal(true)}
              className="p-2 rounded-xl bg-elevated border border-border text-muted hover:text-foreground hover:bg-elevated/80"
              title="Add new season"
            >
              <Plus size={15} />
            </button>
          </div>
        </div>

        {/* Sport Selector */}
        <div>
          <label className="text-[11px] font-bold uppercase tracking-wider text-muted block mb-1.5">
            Sport Tournament
          </label>
          <select
            value={sport}
            onChange={(e) => setSport(e.target.value)}
            className="w-full px-3 py-2 rounded-xl text-xs font-bold bg-elevated border border-border text-foreground focus:outline-none focus:ring-2 focus:ring-amber-500/50"
          >
            {ALL_SPORTS.map((sp) => (
              <option key={sp} value={sp}>
                {sp}
              </option>
            ))}
          </select>
        </div>

        {/* Division Selector */}
        <div>
          <label className="text-[11px] font-bold uppercase tracking-wider text-muted block mb-1.5">
            Division
          </label>
          <div className="flex flex-wrap items-center gap-1.5">
            {ALL_DIVISIONS.map((div) => {
              const active = division === div;
              return (
                <button
                  key={div}
                  type="button"
                  onClick={() => setDivision(div)}
                  className={cn(
                    "px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer",
                    active
                      ? "bg-amber-500 text-slate-950 font-bold shadow-sm"
                      : "bg-elevated border border-border text-muted hover:text-foreground"
                  )}
                >
                  {div}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* NEW SEASON MODAL */}
      {showNewSeasonModal && (
        <div className="p-4 rounded-2xl bg-surface border border-amber-500/40 shadow-lg flex items-center justify-between gap-3 animate-in fade-in">
          <div className="flex items-center gap-2 flex-1">
            <span className="text-xs font-bold text-foreground">New Season ID:</span>
            <input
              type="text"
              value={newSeasonInput}
              onChange={(e) => setNewSeasonInput(e.target.value)}
              placeholder="e.g. 2004-2005"
              className="px-3 py-1 rounded-xl text-xs bg-elevated border border-border text-foreground w-40"
            />
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                if (newSeasonInput.trim()) {
                  setSeason(newSeasonInput.trim());
                  setShowNewSeasonModal(false);
                  setNewSeasonInput("");
                }
              }}
              className="px-3 py-1 rounded-xl text-xs font-bold bg-amber-500 text-slate-950"
            >
              Add Season
            </button>
            <button
              type="button"
              onClick={() => setShowNewSeasonModal(false)}
              className="px-2.5 py-1 rounded-xl text-xs text-muted hover:text-foreground"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* RAW OCR REFERENCE DRAWER */}
      {showReportRef && (
        <div className="p-5 rounded-2xl bg-surface border border-border shadow-md space-y-3 animate-in fade-in">
          <div className="flex items-center justify-between border-b border-border/60 pb-2.5">
            <div className="flex items-center gap-2">
              <FileText size={16} className="text-amber-400" />
              <h4 className="text-xs font-bold uppercase tracking-wider text-foreground">
                Raw Annual Report Reference ({season} {sport})
              </h4>
            </div>
            <span className="text-[11px] font-mono text-muted">{reportSourceFile}</span>
          </div>

          {loadingReport ? (
            <div className="py-8 text-center text-xs text-muted">Loading reference text...</div>
          ) : (
            <div className="max-h-60 overflow-y-auto font-mono text-[11px] bg-elevated p-3 rounded-xl text-muted leading-relaxed whitespace-pre-wrap">
              {reportSnippet || "No relevant section found in annual report for this sport."}
            </div>
          )}
        </div>
      )}

      {/* SMART QUICK-PASTE DRAWER */}
      {showPasteBox && (
        <div className="p-5 rounded-2xl bg-surface border border-amber-500/30 shadow-md space-y-3 animate-in fade-in">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Wand2 size={16} className="text-amber-400" />
              <h4 className="text-xs font-bold uppercase tracking-wider text-foreground">
                Smart Quick-Paste / Text Importer
              </h4>
            </div>
            <span className="text-[11px] text-muted">Paste lines like &quot;1. FEU 12-2 Champion&quot;</span>
          </div>

          <textarea
            rows={5}
            value={pasteText}
            onChange={(e) => setPasteText(e.target.value)}
            placeholder="Paste text, e.g.:&#10;1. FEU 12-2 Champion&#10;2. UST 11-3 Runner-up&#10;3. UP 8-6&#10;4. DLSU 8-6..."
            className="w-full p-3 rounded-xl text-xs font-mono bg-elevated border border-border text-foreground placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-amber-500/50"
          />

          <div className="flex items-center justify-between">
            <button
              type="button"
              onClick={handleParsePasteText}
              className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-xl text-xs font-bold bg-amber-500 text-slate-950 hover:bg-amber-400 cursor-pointer"
            >
              <Sparkles size={14} />
              <span>Auto-Populate Table</span>
            </button>
            <button
              type="button"
              onClick={() => setShowPasteBox(false)}
              className="px-3 py-1 text-xs text-muted hover:text-foreground"
            >
              Close
            </button>
          </div>
        </div>
      )}

      {/* STANDINGS TABLE EDITOR */}
      <div className="p-5 rounded-3xl bg-surface border border-border shadow-sm space-y-4">
        {/* Table Toolbar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border/60 pb-3">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-bold text-foreground">
              Standings Table ({standings.length} Teams)
            </h3>
            <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-elevated text-muted">
              {season} · {sport} · {division}
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Format toggle: W-L vs Points */}
            <button
              type="button"
              onClick={() => setIsPointsMode(!isPointsMode)}
              className={cn(
                "px-2.5 py-1 rounded-lg text-xs font-medium border transition-colors cursor-pointer",
                isPointsMode
                  ? "bg-amber-500/20 text-amber-400 border-amber-500/30"
                  : "bg-elevated border-border text-muted hover:text-foreground"
              )}
            >
              {isPointsMode ? "Points Format" : "Win-Loss Format"}
            </button>

            <button
              type="button"
              onClick={() => setShowPasteBox(!showPasteBox)}
              className="px-2.5 py-1 rounded-lg text-xs font-medium bg-elevated border border-border text-foreground hover:bg-elevated/80 transition-colors inline-flex items-center gap-1 cursor-pointer"
            >
              <Wand2 size={13} />
              <span>Quick Paste</span>
            </button>

            <button
              type="button"
              onClick={handlePrefillEightSchools}
              className="px-2.5 py-1 rounded-lg text-xs font-medium bg-elevated border border-border text-foreground hover:bg-elevated/80 transition-colors inline-flex items-center gap-1 cursor-pointer"
            >
              <span>+ 8 Standard Teams</span>
            </button>

            <button
              type="button"
              onClick={handleAutoSort}
              className="px-2.5 py-1 rounded-lg text-xs font-medium bg-elevated border border-border text-foreground hover:bg-elevated/80 transition-colors inline-flex items-center gap-1 cursor-pointer"
            >
              <RotateCcw size={12} />
              <span>Auto-Rank</span>
            </button>
          </div>
        </div>

        {/* Table Rows */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-border bg-elevated/40 text-[10px] font-bold uppercase tracking-wider text-muted">
                <th className="py-2.5 px-3 w-16 text-center">Rank</th>
                <th className="py-2.5 px-3 w-44">School</th>
                {!isPointsMode ? (
                  <>
                    <th className="py-2.5 px-3 w-20 text-center">Wins</th>
                    <th className="py-2.5 px-3 w-20 text-center">Losses</th>
                    <th className="py-2.5 px-3 w-20 text-center">Win %</th>
                  </>
                ) : (
                  <th className="py-2.5 px-3 w-28 text-center">Total Points</th>
                )}
                <th className="py-2.5 px-3">Result / Notes</th>
                <th className="py-2.5 px-3 w-20 text-center">Reorder</th>
                <th className="py-2.5 px-3 w-12 text-center">Del</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60 font-medium">
              {standings.length === 0 ? (
                <tr>
                  <td colSpan={isPointsMode ? 5 : 7} className="py-10 text-center text-muted">
                    No teams added yet. Click &quot;+ 8 Standard Teams&quot; or &quot;Quick Paste&quot; to populate.
                  </td>
                </tr>
              ) : (
                standings.map((row, idx) => {
                  const theme = getSchoolTheme(row.team);
                  return (
                    <tr key={idx} className="hover:bg-elevated/40 transition-colors">
                      {/* Rank Input */}
                      <td className="py-2 px-3 text-center">
                        <input
                          type="number"
                          value={row.rank || idx + 1}
                          onChange={(e) => handleUpdateRow(idx, "rank", parseInt(e.target.value, 10) || 1)}
                          className="w-12 text-center px-1 py-1 rounded bg-elevated border border-border text-foreground font-bold font-mono"
                        />
                      </td>

                      {/* School Select */}
                      <td className="py-2 px-3">
                        <div className="flex items-center gap-1.5">
                          <span
                            className={cn(
                              "px-2 py-0.5 rounded border text-[11px] font-bold shrink-0",
                              theme.bg,
                              theme.text
                            )}
                          >
                            {row.team}
                          </span>
                          <select
                            value={row.team}
                            onChange={(e) => handleUpdateRow(idx, "team", e.target.value)}
                            className="px-2 py-1 rounded bg-elevated border border-border text-foreground text-xs font-semibold truncate flex-1"
                          >
                            {STANDARD_UAAP_SCHOOLS.map((s) => (
                              <option key={s.code} value={s.code}>
                                {s.code} ({s.name})
                              </option>
                            ))}
                          </select>
                        </div>
                      </td>

                      {/* Wins / Losses or Points */}
                      {!isPointsMode ? (
                        <>
                          <td className="py-2 px-3 text-center">
                            <input
                              type="number"
                              value={row.wins !== null && row.wins !== undefined ? row.wins : ""}
                              onChange={(e) => handleUpdateRow(idx, "wins", e.target.value)}
                              placeholder="0"
                              className="w-14 text-center px-1 py-1 rounded bg-elevated border border-border text-foreground font-bold font-mono"
                            />
                          </td>
                          <td className="py-2 px-3 text-center">
                            <input
                              type="number"
                              value={row.losses !== null && row.losses !== undefined ? row.losses : ""}
                              onChange={(e) => handleUpdateRow(idx, "losses", e.target.value)}
                              placeholder="0"
                              className="w-14 text-center px-1 py-1 rounded bg-elevated border border-border text-foreground font-bold font-mono"
                            />
                          </td>
                          <td className="py-2 px-3 text-center font-mono font-semibold text-foreground">
                            {row.pct !== null && row.pct !== undefined ? row.pct.toFixed(3) : "—"}
                          </td>
                        </>
                      ) : (
                        <td className="py-2 px-3 text-center">
                          <input
                            type="number"
                            step="any"
                            value={row.points !== null && row.points !== undefined ? row.points : ""}
                            onChange={(e) => handleUpdateRow(idx, "points", e.target.value)}
                            placeholder="0.0"
                            className="w-20 text-center px-2 py-1 rounded bg-elevated border border-border text-amber-400 font-bold font-mono"
                          />
                        </td>
                      )}

                      {/* Result / Notes */}
                      <td className="py-2 px-3">
                        <input
                          type="text"
                          value={row.details || ""}
                          onChange={(e) => handleUpdateRow(idx, "details", e.target.value)}
                          placeholder="e.g. Champion, Runner-up..."
                          className="w-full px-2 py-1 rounded bg-elevated border border-border text-foreground text-xs"
                        />
                      </td>

                      {/* Reorder buttons */}
                      <td className="py-2 px-3 text-center">
                        <div className="inline-flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => handleMoveRow(idx, -1)}
                            disabled={idx === 0}
                            className="p-1 rounded bg-elevated text-muted hover:text-foreground disabled:opacity-30"
                          >
                            <ArrowUp size={12} />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleMoveRow(idx, 1)}
                            disabled={idx === standings.length - 1}
                            className="p-1 rounded bg-elevated text-muted hover:text-foreground disabled:opacity-30"
                          >
                            <ArrowDown size={12} />
                          </button>
                        </div>
                      </td>

                      {/* Delete */}
                      <td className="py-2 px-3 text-center">
                        <button
                          type="button"
                          onClick={() => handleDeleteRow(idx)}
                          className="p-1 rounded text-rose-400 hover:bg-rose-500/10"
                        >
                          <Trash2 size={13} />
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Add Row Button & Delete Division */}
        <div className="flex items-center justify-between pt-2 border-t border-border/60">
          <button
            type="button"
            onClick={() => handleAddRow()}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-elevated border border-border text-foreground hover:bg-elevated/80 transition-colors cursor-pointer"
          >
            <Plus size={14} />
            <span>Add Team Row</span>
          </button>

          {standings.length > 0 && (
            <button
              type="button"
              onClick={handleDeleteDivision}
              className="text-xs text-rose-400 hover:underline cursor-pointer"
            >
              Delete this division standings
            </button>
          )}
        </div>
      </div>

      {/* AWARDS & HONORS EDITOR */}
      <div className="p-5 rounded-3xl bg-surface border border-border shadow-sm space-y-4">
        <div className="flex items-center gap-2 border-b border-border/60 pb-3">
          <Award size={16} className="text-amber-400" />
          <h3 className="text-sm font-bold text-foreground">
            Awards &amp; Honors ({season} {sport} - {division})
          </h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* MVP */}
          <div className="p-4 rounded-2xl bg-elevated/40 border border-border space-y-2">
            <span className="text-[11px] font-bold uppercase tracking-wider text-amber-400 flex items-center gap-1">
              <Crown size={13} /> Most Valuable Player (MVP)
            </span>
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={mvpName}
                onChange={(e) => setMvpName(e.target.value)}
                placeholder="Player full name"
                className="flex-1 px-3 py-1.5 rounded-xl text-xs bg-surface border border-border text-foreground"
              />
              <select
                value={mvpSchool}
                onChange={(e) => setMvpSchool(e.target.value)}
                className="w-28 px-2 py-1.5 rounded-xl text-xs font-bold bg-surface border border-border text-foreground"
              >
                {STANDARD_UAAP_SCHOOLS.map((s) => (
                  <option key={s.code} value={s.code}>
                    {s.code}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Rookie of the Year */}
          <div className="p-4 rounded-2xl bg-elevated/40 border border-border space-y-2">
            <span className="text-[11px] font-bold uppercase tracking-wider text-sky-400 flex items-center gap-1">
              <Sparkles size={13} /> Rookie of the Year (ROY)
            </span>
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={royName}
                onChange={(e) => setRoyName(e.target.value)}
                placeholder="Player full name"
                className="flex-1 px-3 py-1.5 rounded-xl text-xs bg-surface border border-border text-foreground"
              />
              <select
                value={roySchool}
                onChange={(e) => setRoySchool(e.target.value)}
                className="w-28 px-2 py-1.5 rounded-xl text-xs font-bold bg-surface border border-border text-foreground"
              >
                {STANDARD_UAAP_SCHOOLS.map((s) => (
                  <option key={s.code} value={s.code}>
                    {s.code}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Mythical Selection */}
        <div className="p-4 rounded-2xl bg-elevated/40 border border-border space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-foreground">
              Mythical Selection / All-Star Team ({mythicalFive.length} players)
            </span>
            <button
              type="button"
              onClick={() => setMythicalFive((prev) => [...prev, { player: "", school: "FEU" }])}
              className="text-xs font-bold text-amber-400 hover:underline"
            >
              + Add Player
            </button>
          </div>

          <div className="space-y-2">
            {mythicalFive.map((p, pIdx) => (
              <div key={pIdx} className="flex items-center gap-2">
                <input
                  type="text"
                  value={p.player}
                  onChange={(e) => {
                    const next = [...mythicalFive];
                    next[pIdx] = { ...next[pIdx], player: e.target.value };
                    setMythicalFive(next);
                  }}
                  placeholder="Player name"
                  className="flex-1 px-3 py-1.5 rounded-xl text-xs bg-surface border border-border text-foreground"
                />
                <select
                  value={p.school}
                  onChange={(e) => {
                    const next = [...mythicalFive];
                    next[pIdx] = { ...next[pIdx], school: e.target.value };
                    setMythicalFive(next);
                  }}
                  className="w-28 px-2 py-1.5 rounded-xl text-xs font-bold bg-surface border border-border text-foreground"
                >
                  {STANDARD_UAAP_SCHOOLS.map((s) => (
                    <option key={s.code} value={s.code}>
                      {s.code}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={() => setMythicalFive((prev) => prev.filter((_, i) => i !== pIdx))}
                  className="p-1 rounded text-rose-400 hover:bg-rose-500/10"
                >
                  <Trash2 size={13} />
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Chess Board Medalists (if Chess) */}
        {sport === "Chess" && (
          <div className="p-4 rounded-2xl bg-elevated/40 border border-border space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-amber-400">
              Chess Board Medalists (Boards 1 through 6)
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {["1", "2", "3", "4", "5", "6"].map((bNum) => (
                <div key={bNum} className="p-3 rounded-xl bg-surface border border-border space-y-2">
                  <span className="text-xs font-bold text-foreground">Board {bNum}</span>
                  {(["gold", "silver", "bronze"] as const).map((medal) => {
                    const existing = (chessBoards[bNum] || []).find((m) => m.medal === medal);
                    const emoji = medal === "gold" ? "🥇" : medal === "silver" ? "🥈" : "🥉";
                    return (
                      <div key={medal} className="flex items-center gap-1.5 text-xs">
                        <span>{emoji}</span>
                        <input
                          type="text"
                          value={existing?.player || ""}
                          onChange={(e) => {
                            const val = e.target.value;
                            setChessBoards((prev) => {
                              const bList = [...(prev[bNum] || [])].filter((m) => m.medal !== medal);
                              if (val.trim()) {
                                bList.push({
                                  medal,
                                  player: val.trim(),
                                  school: existing?.school || "UST",
                                });
                              }
                              return { ...prev, [bNum]: bList };
                            });
                          }}
                          placeholder={`${medal} player`}
                          className="flex-1 px-2 py-1 rounded bg-elevated border border-border text-[11px]"
                        />
                        <select
                          value={existing?.school || "UST"}
                          onChange={(e) => {
                            const sch = e.target.value;
                            setChessBoards((prev) => {
                              const bList = [...(prev[bNum] || [])].map((m) =>
                                m.medal === medal ? { ...m, school: sch } : m
                              );
                              return { ...prev, [bNum]: bList };
                            });
                          }}
                          className="w-16 px-1 py-1 rounded bg-elevated border border-border text-[10px] font-bold"
                        >
                          {STANDARD_UAAP_SCHOOLS.map((s) => (
                            <option key={s.code} value={s.code}>
                              {s.code}
                            </option>
                          ))}
                        </select>
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
