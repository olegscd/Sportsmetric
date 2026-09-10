"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import type { ToastFn } from "@/components/admin/Toast";
import {
  saveUAAPArchiveData,
  deleteUAAPArchiveDivision,
  getUAAPAnnualReportSnippet,
} from "@/app/admin/actions";
import { ColumnEditor } from "@/components/admin/uaap/ColumnEditor";
import { BulkImportPanel } from "@/components/admin/uaap/BulkImportPanel";
import { CoveragePanel } from "@/components/admin/uaap/CoveragePanel";
import {
  COLUMN_PRESETS,
  createEmptyTable,
  formatCellValue,
  legacyRecordsToTables,
  makeDivisionKey,
  makeExtrasKey,
  normalizeChessMedalists,
  normalizeDivision,
  resolveCellValue,
  toNumberOrNull,
  type LegacyStandingRecord,
  type UAAPArchiveExtras,
  type UAAPColumn,
  type UAAPRow,
  type UAAPTable,
} from "@/lib/uaap-schema";
import { UAAP_SCHOOLS, getSchoolTheme, matchSchoolCode } from "@/lib/uaap-schools";
import standingsData from "@/data/uaap_standings.json";
import archiveExtrasData from "@/data/uaap_archive_extras.json";
import {
  Award,
  BookOpen,
  ChevronDown,
  Columns3,
  Copy,
  Crown,
  ExternalLink,
  FileText,
  FileUp,
  LayoutGrid,
  Plus,
  RotateCcw,
  Save,
  Sparkles,
  Trash2,
} from "lucide-react";

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

const BASE_DIVISIONS = ["Men's", "Women's", "Juniors"];

const FALLBACK_SEASONS = [
  "2003-2004",
  "2000-2001",
  "1999-2000",
  "1998-1999",
  "1989-1990",
  "1988-1989",
  "1987-1988",
];

const SCHOOL_DATALIST_ID = "uaap-school-codes";

function Section({
  title,
  icon,
  subtitle,
  defaultOpen = false,
  children,
}: {
  title: string;
  icon: React.ReactNode;
  subtitle?: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="rounded-2xl bg-surface border border-border shadow-sm overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between gap-3 p-4 text-left cursor-pointer hover:bg-elevated/40 transition-colors"
      >
        <span className="flex items-center gap-2">
          <span className="text-amber-400">{icon}</span>
          <span className="text-sm font-bold text-foreground">{title}</span>
          {subtitle && <span className="text-xs text-muted hidden sm:inline">{subtitle}</span>}
        </span>
        <ChevronDown
          size={16}
          className={cn("text-muted transition-transform shrink-0", open && "rotate-180")}
        />
      </button>
      {open && <div className="px-4 pb-4 border-t border-border/60 pt-4">{children}</div>}
    </div>
  );
}

export function UAAPArchiveManager({ onToast }: { onToast: ToastFn }) {
  const [tables, setTables] = useState<UAAPTable[]>(() =>
    legacyRecordsToTables(standingsData as LegacyStandingRecord[])
  );
  const [extras, setExtras] = useState<UAAPArchiveExtras>(archiveExtrasData as UAAPArchiveExtras);
  const [customSeasons, setCustomSeasons] = useState<string[]>([]);

  const fetchLive = useCallback(async () => {
    try {
      const res = await fetch("/api/uaap/data", { cache: "no-store" });
      if (!res.ok) return;
      const json = await res.json();
      if (Array.isArray(json.tables)) setTables(json.tables);
      if (json.extras) setExtras(json.extras);
    } catch (err) {
      console.warn("[UAAPArchiveManager] Live fetch failed, using bundled data:", err);
    }
  }, []);

  useEffect(() => {
    fetchLive();
  }, [fetchLive]);

  const seasons = useMemo(() => {
    const set = new Set<string>([
      ...tables.map((t) => t.season),
      ...FALLBACK_SEASONS,
      ...customSeasons,
    ]);
    return Array.from(set).filter(Boolean).sort().reverse();
  }, [tables, customSeasons]);

  const [season, setSeason] = useState<string>(FALLBACK_SEASONS[0]);
  const [sport, setSport] = useState<string>("Basketball");
  const [division, setDivision] = useState<string>("Men's");

  const divisions = useMemo(() => {
    const fromData = tables
      .filter((t) => t.season === season && t.sport.toLowerCase() === sport.toLowerCase())
      .map((t) => t.division);
    return Array.from(new Set([...BASE_DIVISIONS, ...fromData]));
  }, [tables, season, sport]);

  // -------------------------------------------------------------------------
  // Draft table
  // -------------------------------------------------------------------------

  const [draft, setDraft] = useState<UAAPTable>(() =>
    createEmptyTable(FALLBACK_SEASONS[0], "Basketball", "Men's", COLUMN_PRESETS[0].columns)
  );
  const [baseline, setBaseline] = useState<string>("");

  const [mvp, setMvp] = useState({ player: "", school: "FEU" });
  const [roy, setRoy] = useState({ player: "", school: "FEU" });
  const [mythical, setMythical] = useState<
    Array<{ player: string; school: string; position?: string }>
  >([]);
  const [chessBoards, setChessBoards] = useState<
    Record<string, Array<{ medal: "gold" | "silver" | "bronze"; player: string; school: string }>>
  >({});

  const loadDivision = useCallback(() => {
    const key = makeDivisionKey(season, sport, division);
    const existing = tables.find(
      (t) => makeDivisionKey(t.season, t.sport, t.division) === key
    );

    const table =
      existing ??
      createEmptyTable(
        season,
        sport,
        division,
        sport === "General Championship" || sport === "Chess"
          ? COLUMN_PRESETS[1].columns
          : COLUMN_PRESETS[0].columns
      );

    const cloned: UAAPTable = JSON.parse(JSON.stringify(table));
    setDraft(cloned);
    setBaseline(JSON.stringify(cloned));

    const extrasKey = makeExtrasKey(sport, season);
    const awards = extras.awards?.[extrasKey]?.[normalizeDivision(division)];
    setMvp({ player: awards?.mvp?.player || "", school: awards?.mvp?.school || "FEU" });
    setRoy({
      player: awards?.rookie_of_the_year?.player || "",
      school: awards?.rookie_of_the_year?.school || "FEU",
    });
    setMythical(Array.isArray(awards?.mythical_five) ? awards.mythical_five : []);

    const medalists = normalizeChessMedalists(
      extras.chess_medalists?.[extrasKey]?.[normalizeDivision(division)]
    );
    setChessBoards(
      medalists
        ? (Object.fromEntries(
            Object.entries(medalists).map(([board, list]) => [
              board,
              list.map((m) => ({ medal: m.medal ?? "gold", player: m.player, school: m.school })),
            ])
          ) as typeof chessBoards)
        : { "1": [], "2": [], "3": [], "4": [], "5": [], "6": [] }
    );
  }, [season, sport, division, tables, extras]);

  useEffect(() => {
    loadDivision();
  }, [loadDivision]);

  const isDirty = baseline !== "" && JSON.stringify(draft) !== baseline;

  const enterableColumns = useMemo(
    () => draft.columns.filter((c) => !c.derived),
    [draft.columns]
  );

  // -------------------------------------------------------------------------
  // Row helpers
  // -------------------------------------------------------------------------

  const updateDraft = (patch: Partial<UAAPTable>) => setDraft((prev) => ({ ...prev, ...patch }));

  const setRows = (rows: UAAPRow[]) => updateDraft({ rows });

  const updateRow = (idx: number, patch: Partial<UAAPRow>) => {
    setDraft((prev) => ({
      ...prev,
      rows: prev.rows.map((row, i) => (i === idx ? { ...row, ...patch } : row)),
    }));
  };

  const updateCell = (idx: number, key: string, raw: string) => {
    setDraft((prev) => ({
      ...prev,
      rows: prev.rows.map((row, i) => {
        if (i !== idx) return row;
        const column = prev.columns.find((c) => c.key === key);
        const value = column?.type === "text" ? raw : raw === "" ? null : raw;
        return { ...row, values: { ...row.values, [key]: value } };
      }),
    }));
  };

  const addRow = (team = "") => {
    setDraft((prev) => ({
      ...prev,
      rows: [...prev.rows, { rank: prev.rows.length + 1, team, values: {}, details: null }],
    }));
  };

  const duplicateRow = (idx: number) => {
    setDraft((prev) => {
      const copy: UAAPRow = JSON.parse(JSON.stringify(prev.rows[idx]));
      const rows = [...prev.rows];
      rows.splice(idx + 1, 0, copy);
      return { ...prev, rows: rows.map((r, i) => ({ ...r, rank: i + 1 })) };
    });
  };

  const deleteRow = (idx: number) => {
    setDraft((prev) => ({
      ...prev,
      rows: prev.rows.filter((_, i) => i !== idx).map((r, i) => ({ ...r, rank: i + 1 })),
    }));
  };

  const moveRow = (idx: number, dir: -1 | 1) => {
    setDraft((prev) => {
      const target = idx + dir;
      if (target < 0 || target >= prev.rows.length) return prev;
      const rows = [...prev.rows];
      [rows[idx], rows[target]] = [rows[target], rows[idx]];
      return { ...prev, rows: rows.map((r, i) => ({ ...r, rank: i + 1 })) };
    });
  };

  const prefillStandardEight = () => {
    const codes = ["UST", "DLSU", "FEU", "ADMU", "UP", "UE", "AdU", "NU"];
    setRows(
      codes.map((team, idx) => ({
        rank: idx + 1,
        team,
        values: {},
        details: idx === 0 ? "Champion" : idx === 1 ? "Runner-up" : null,
      }))
    );
    onToast("Added the eight standard UAAP schools.", "success");
  };

  const autoRank = () => {
    const sortKey =
      enterableColumns.find((c) => c.key === "points")?.key ||
      enterableColumns.find((c) => c.key === "wins")?.key ||
      enterableColumns[0]?.key;

    if (!sortKey) {
      onToast("Add a stat column first so rows can be ranked.", "error");
      return;
    }

    setDraft((prev) => {
      const sorted = [...prev.rows].sort((a, b) => {
        const av = toNumberOrNull(a.values[sortKey]) ?? -Infinity;
        const bv = toNumberOrNull(b.values[sortKey]) ?? -Infinity;
        if (bv !== av) return bv - av;
        const al = toNumberOrNull(a.values.losses) ?? 0;
        const bl = toNumberOrNull(b.values.losses) ?? 0;
        return al - bl;
      });
      return { ...prev, rows: sorted.map((r, i) => ({ ...r, rank: i + 1 })) };
    });

    const label = draft.columns.find((c) => c.key === sortKey)?.label ?? sortKey;
    onToast(`Ranked rows by ${label}.`, "success");
  };

  // Keyboard flow: Enter walks down a column and appends a row at the bottom.
  const gridRef = useRef<HTMLTableSectionElement>(null);

  const handleCellKeyDown = (
    e: React.KeyboardEvent<HTMLInputElement>,
    rowIdx: number,
    field: string
  ) => {
    if (e.key !== "Enter") return;
    e.preventDefault();

    const isLast = rowIdx === draft.rows.length - 1;
    if (isLast) {
      addRow();
      requestAnimationFrame(() => {
        gridRef.current
          ?.querySelector<HTMLInputElement>(`[data-cell="${rowIdx + 1}:${field}"]`)
          ?.focus();
      });
      return;
    }

    gridRef.current
      ?.querySelector<HTMLInputElement>(`[data-cell="${rowIdx + 1}:${field}"]`)
      ?.focus();
  };

  /** Keeps values for columns that survive an edit, drops the rest. */
  const handleColumnsChange = (columns: UAAPColumn[]) => {
    const keptKeys = new Set(columns.filter((c) => !c.derived).map((c) => c.key));
    setDraft((prev) => ({
      ...prev,
      columns,
      rows: prev.rows.map((row) => ({
        ...row,
        values: Object.fromEntries(
          Object.entries(row.values).filter(([key]) => keptKeys.has(key))
        ),
      })),
    }));
  };

  // -------------------------------------------------------------------------
  // Persistence
  // -------------------------------------------------------------------------

  const [isSaving, setIsSaving] = useState(false);
  const [showImport, setShowImport] = useState(false);

  const handleSave = useCallback(async () => {
    if (draft.rows.length === 0) {
      onToast("Nothing to save — add at least one row.", "error");
      return;
    }

    setIsSaving(true);

    const hasAwards = mvp.player.trim() || roy.player.trim() || mythical.length > 0;
    const chessPayload =
      sport === "Chess"
        ? Object.fromEntries(Object.entries(chessBoards).filter(([, list]) => list.length > 0))
        : null;

    const res = await saveUAAPArchiveData({
      table: draft,
      awards: hasAwards
        ? {
            mvp: mvp.player.trim() ? { ...mvp, player: mvp.player.trim() } : null,
            rookie_of_the_year: roy.player.trim() ? { ...roy, player: roy.player.trim() } : null,
            mythical_five: mythical.length > 0 ? mythical : null,
          }
        : null,
      chess_medalists: chessPayload && Object.keys(chessPayload).length > 0 ? chessPayload : null,
    });

    setIsSaving(false);

    if (!res.success) {
      onToast(`Save failed: ${res.error}`, "error");
      return;
    }

    if (res.data) {
      setTables(res.data.tables);
      setExtras(res.data.extras);
    } else {
      fetchLive();
    }
    setBaseline(JSON.stringify(draft));

    if (res.warning) {
      onToast(res.warning, "error");
    } else {
      onToast(
        `Saved ${season} ${sport} (${division}) — ${res.count} ${res.count === 1 ? "row" : "rows"}.`,
        "success"
      );
    }
  }, [draft, mvp, roy, mythical, chessBoards, sport, season, division, onToast, fetchLive]);

  const handleDelete = async () => {
    if (!confirm(`Delete all recorded standings for ${season} ${sport} (${division})?`)) return;

    const res = await deleteUAAPArchiveDivision(season, sport, division);
    if (!res.success) {
      onToast(`Delete failed: ${res.error}`, "error");
      return;
    }
    if (res.data) {
      setTables(res.data.tables);
      setExtras(res.data.extras);
    }
    onToast(res.warning || `Deleted ${season} ${sport} (${division}).`, res.warning ? "error" : "success");
  };

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") {
        e.preventDefault();
        handleSave();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [handleSave]);

  // -------------------------------------------------------------------------
  // Navigation guard
  // -------------------------------------------------------------------------

  const switchTo = (next: { season?: string; sport?: string; division?: string }) => {
    if (isDirty && !confirm("You have unsaved changes. Discard them and switch?")) return;
    if (next.season !== undefined) setSeason(next.season);
    if (next.sport !== undefined) setSport(next.sport);
    if (next.division !== undefined) setDivision(normalizeDivision(next.division));
  };

  // -------------------------------------------------------------------------
  // OCR reference drawer
  // -------------------------------------------------------------------------

  const [showReport, setShowReport] = useState(false);
  const [report, setReport] = useState({ content: "", sourceFile: "", loading: false });

  useEffect(() => {
    if (!showReport) return;
    setReport((r) => ({ ...r, loading: true }));
    getUAAPAnnualReportSnippet(season, sport).then((res) => {
      setReport({ content: res.content, sourceFile: res.sourceFile || "", loading: false });
    });
  }, [showReport, season, sport]);

  const [newSeason, setNewSeason] = useState("");
  const [newDivision, setNewDivision] = useState("");

  return (
    <div className="space-y-5 max-w-6xl mx-auto pb-24">
      <datalist id={SCHOOL_DATALIST_ID}>
        {UAAP_SCHOOLS.map((s) => (
          <option key={s.code} value={s.code}>
            {s.name}
          </option>
        ))}
      </datalist>

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border pb-4">
        <div>
          <h2 className="text-xl font-black text-foreground flex items-center gap-2">
            <span className="p-2 rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/30">
              <LayoutGrid size={18} />
            </span>
            UAAP Historical Archive
          </h2>
          <p className="text-xs text-muted mt-1">
            Each division defines its own columns, so a 1988 placement list and a 2003 win-loss table
            can both be recorded accurately.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          {isDirty && (
            <span className="text-[11px] font-bold text-amber-400 px-2 py-1 rounded-lg bg-amber-500/10 border border-amber-500/30">
              Unsaved
            </span>
          )}
          <a
            href={`/uaap?sport=${encodeURIComponent(sport)}&season=${encodeURIComponent(
              season
            )}&division=${encodeURIComponent(division)}`}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-surface border border-border text-muted hover:text-foreground hover:bg-elevated transition-colors"
          >
            <span>Preview</span>
            <ExternalLink size={13} />
          </a>
          <button
            type="button"
            onClick={handleSave}
            disabled={isSaving}
            className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-xl text-xs font-bold bg-amber-500 text-slate-950 hover:bg-amber-400 active:scale-95 transition-all shadow-sm cursor-pointer disabled:opacity-50"
          >
            <Save size={14} />
            <span>{isSaving ? "Saving…" : "Save (Ctrl+S)"}</span>
          </button>
        </div>
      </div>

      {/* Selectors */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-5 rounded-2xl bg-surface border border-border shadow-sm">
        <div>
          <label className="text-[11px] font-bold uppercase tracking-wider text-muted block mb-1.5">
            Season
          </label>
          <div className="flex items-center gap-2">
            <select
              value={season}
              onChange={(e) => switchTo({ season: e.target.value })}
              className="flex-1 px-3 py-2 rounded-xl text-xs font-bold bg-elevated border border-border text-foreground focus:outline-none focus:ring-2 focus:ring-amber-500/50"
            >
              {seasons.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>
          <div className="flex items-center gap-1.5 mt-2">
            <input
              type="text"
              value={newSeason}
              onChange={(e) => setNewSeason(e.target.value)}
              placeholder="Add season, e.g. 2004-2005"
              className="flex-1 px-2.5 py-1 rounded-lg text-[11px] bg-elevated border border-border text-foreground placeholder:text-muted"
            />
            <button
              type="button"
              onClick={() => {
                const value = newSeason.trim();
                if (!value) return;
                setCustomSeasons((prev) => Array.from(new Set([...prev, value])));
                switchTo({ season: value });
                setNewSeason("");
              }}
              className="p-1.5 rounded-lg bg-elevated border border-border text-muted hover:text-foreground cursor-pointer"
              aria-label="Add season"
            >
              <Plus size={13} />
            </button>
          </div>
        </div>

        <div>
          <label className="text-[11px] font-bold uppercase tracking-wider text-muted block mb-1.5">
            Sport
          </label>
          <select
            value={sport}
            onChange={(e) => switchTo({ sport: e.target.value })}
            className="w-full px-3 py-2 rounded-xl text-xs font-bold bg-elevated border border-border text-foreground focus:outline-none focus:ring-2 focus:ring-amber-500/50"
          >
            {ALL_SPORTS.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="text-[11px] font-bold uppercase tracking-wider text-muted block mb-1.5">
            Division
          </label>
          <div className="flex flex-wrap items-center gap-1.5">
            {divisions.map((div) => (
              <button
                key={div}
                type="button"
                onClick={() => switchTo({ division: div })}
                className={cn(
                  "px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer",
                  normalizeDivision(division) === normalizeDivision(div)
                    ? "bg-amber-500 text-slate-950 font-bold shadow-sm"
                    : "bg-elevated border border-border text-muted hover:text-foreground"
                )}
              >
                {div}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-1.5 mt-2">
            <input
              type="text"
              value={newDivision}
              onChange={(e) => setNewDivision(e.target.value)}
              placeholder="Custom division"
              className="flex-1 px-2.5 py-1 rounded-lg text-[11px] bg-elevated border border-border text-foreground placeholder:text-muted"
            />
            <button
              type="button"
              onClick={() => {
                const value = newDivision.trim();
                if (!value) return;
                switchTo({ division: value });
                setNewDivision("");
              }}
              className="p-1.5 rounded-lg bg-elevated border border-border text-muted hover:text-foreground cursor-pointer"
              aria-label="Add division"
            >
              <Plus size={13} />
            </button>
          </div>
        </div>
      </div>

      <Section
        title="Coverage map"
        subtitle="Find the gaps"
        icon={<LayoutGrid size={16} />}
      >
        <CoveragePanel
          tables={tables}
          seasons={seasons}
          sports={ALL_SPORTS}
          activeSeason={season}
          activeSport={sport}
          onSelect={(s, sp, div) => switchTo({ season: s, sport: sp, division: div ?? "Men's" })}
        />
      </Section>

      <Section
        title="Columns"
        subtitle={
          draft.columns.length === 0
            ? "Placement only"
            : draft.columns.map((c) => c.label).join(" · ")
        }
        icon={<Columns3 size={16} />}
      >
        <ColumnEditor columns={draft.columns} onChange={handleColumnsChange} />
      </Section>

      {showImport && (
        <BulkImportPanel
          columns={draft.columns}
          onClose={() => setShowImport(false)}
          onApply={(rows, mode, newColumns) => {
            setDraft((prev) => {
              const next = mode === "replace" ? rows : [...prev.rows, ...rows];
              return {
                ...prev,
                columns: newColumns ?? prev.columns,
                rows: next.map((r, i) => ({ ...r, rank: r.rank || i + 1 })),
              };
            });
            setShowImport(false);
            onToast(
              `Loaded ${rows.length} ${rows.length === 1 ? "row" : "rows"}${
                newColumns ? " and updated columns" : ""
              } into the editor.`,
              "success"
            );
          }}
        />
      )}

      {/* Standings editor */}
      <div className="p-5 rounded-3xl bg-surface border border-border shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border/60 pb-3">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-bold text-foreground">
              Standings ({draft.rows.length} {draft.rows.length === 1 ? "row" : "rows"})
            </h3>
            <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-elevated text-muted">
              {season} · {sport} · {normalizeDivision(division)}
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setShowImport((v) => !v)}
              className="px-2.5 py-1 rounded-lg text-xs font-medium bg-elevated border border-border text-foreground hover:bg-elevated/80 inline-flex items-center gap-1 cursor-pointer"
            >
              <FileUp size={13} />
              <span>Bulk import</span>
            </button>
            <button
              type="button"
              onClick={prefillStandardEight}
              className="px-2.5 py-1 rounded-lg text-xs font-medium bg-elevated border border-border text-foreground hover:bg-elevated/80 cursor-pointer"
            >
              + 8 standard schools
            </button>
            <button
              type="button"
              onClick={autoRank}
              className="px-2.5 py-1 rounded-lg text-xs font-medium bg-elevated border border-border text-foreground hover:bg-elevated/80 inline-flex items-center gap-1 cursor-pointer"
            >
              <RotateCcw size={12} />
              <span>Auto-rank</span>
            </button>
            <button
              type="button"
              onClick={() => setShowReport((v) => !v)}
              className={cn(
                "px-2.5 py-1 rounded-lg text-xs font-medium border inline-flex items-center gap-1 cursor-pointer transition-colors",
                showReport
                  ? "bg-amber-500/20 text-amber-400 border-amber-500/40"
                  : "bg-elevated border-border text-foreground hover:bg-elevated/80"
              )}
            >
              <BookOpen size={13} />
              <span>Source scan</span>
            </button>
          </div>
        </div>

        {showReport && (
          <div className="rounded-2xl bg-elevated/40 border border-border p-4 space-y-2">
            <div className="flex items-center justify-between border-b border-border/60 pb-2">
              <span className="flex items-center gap-2 text-xs font-bold text-foreground">
                <FileText size={14} className="text-amber-400" />
                Annual report text — {season} {sport}
              </span>
              <span className="text-[11px] font-mono text-muted">{report.sourceFile}</span>
            </div>
            {report.loading ? (
              <p className="py-6 text-center text-xs text-muted">Loading reference text…</p>
            ) : (
              <div className="max-h-60 overflow-y-auto font-mono text-[11px] bg-surface p-3 rounded-xl text-muted leading-relaxed whitespace-pre-wrap">
                {report.content || "No matching section found in the annual report for this sport."}
              </div>
            )}
          </div>
        )}

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-border bg-elevated/40 text-[10px] font-bold uppercase tracking-wider text-muted">
                <th className="py-2.5 px-3 w-14 text-center">Rank</th>
                <th className="py-2.5 px-3 w-48">School</th>
                {draft.columns.map((col) => (
                  <th key={col.key} className="py-2.5 px-3 w-24 text-center">
                    {col.label}
                  </th>
                ))}
                <th className="py-2.5 px-3">Result / Notes</th>
                <th className="py-2.5 px-3 w-24 text-center">Row</th>
              </tr>
            </thead>
            <tbody ref={gridRef} className="divide-y divide-border/60 font-medium">
              {draft.rows.length === 0 ? (
                <tr>
                  <td
                    colSpan={draft.columns.length + 4}
                    className="py-10 text-center text-muted"
                  >
                    No rows yet. Use “Bulk import”, “+ 8 standard schools”, or add rows one at a
                    time.
                  </td>
                </tr>
              ) : (
                draft.rows.map((row, idx) => {
                  const theme = getSchoolTheme(row.team);
                  return (
                    <tr key={idx} className="hover:bg-elevated/40 transition-colors">
                      <td className="py-2 px-3 text-center">
                        <input
                          type="number"
                          value={row.rank}
                          onChange={(e) =>
                            updateRow(idx, { rank: parseInt(e.target.value, 10) || idx + 1 })
                          }
                          className="w-12 text-center px-1 py-1 rounded bg-elevated border border-border text-foreground font-bold font-mono"
                          aria-label={`Rank for row ${idx + 1}`}
                        />
                      </td>

                      <td className="py-2 px-3">
                        <div className="flex items-center gap-2">
                          {row.team && (
                            <span
                              className={cn(
                                "px-2 py-0.5 rounded border text-[11px] font-bold shrink-0",
                                theme.bg,
                                theme.text
                              )}
                            >
                              {row.team}
                            </span>
                          )}
                          <div className="flex-1 min-w-0">
                            <input
                              type="text"
                              list={SCHOOL_DATALIST_ID}
                              value={row.team}
                              data-cell={`${idx}:team`}
                              onChange={(e) => updateRow(idx, { team: e.target.value })}
                              onBlur={() => {
                                const matched = matchSchoolCode(row.team);
                                if (matched && matched !== row.team) {
                                  updateRow(idx, { team: matched });
                                }
                              }}
                              onKeyDown={(e) => handleCellKeyDown(e, idx, "team")}
                              placeholder="School code (e.g. UP)"
                              className="w-full px-2 py-1 rounded bg-elevated border border-border text-foreground text-xs font-semibold"
                              aria-label={`School for row ${idx + 1}`}
                            />
                            {theme.name && theme.name !== row.team && (
                              <div
                                className="text-[10px] text-muted truncate mt-0.5"
                                title={theme.name}
                              >
                                {theme.name}
                              </div>
                            )}
                          </div>
                        </div>
                      </td>

                      {draft.columns.map((col) => (
                        <td key={col.key} className="py-2 px-3 text-center">
                          {col.derived ? (
                            <span className="font-mono text-xs text-muted">
                              {formatCellValue(row, col)}
                            </span>
                          ) : (
                            <input
                              type={col.type === "text" ? "text" : "number"}
                              step={col.type === "decimal" ? "any" : undefined}
                              value={(resolveCellValue(row, col) as string | number) ?? ""}
                              data-cell={`${idx}:${col.key}`}
                              onChange={(e) => updateCell(idx, col.key, e.target.value)}
                              onKeyDown={(e) => handleCellKeyDown(e, idx, col.key)}
                              className="w-16 text-center px-1 py-1 rounded bg-elevated border border-border text-foreground font-bold font-mono"
                              aria-label={`${col.label} for row ${idx + 1}`}
                            />
                          )}
                        </td>
                      ))}

                      <td className="py-2 px-3">
                        <input
                          type="text"
                          value={row.details || ""}
                          data-cell={`${idx}:details`}
                          onChange={(e) => updateRow(idx, { details: e.target.value })}
                          onKeyDown={(e) => handleCellKeyDown(e, idx, "details")}
                          placeholder="Champion, Runner-up, withdrew…"
                          className="w-full px-2 py-1 rounded bg-elevated border border-border text-foreground text-xs"
                          aria-label={`Notes for row ${idx + 1}`}
                        />
                      </td>

                      <td className="py-2 px-3">
                        <div className="flex items-center justify-center gap-0.5">
                          <button
                            type="button"
                            onClick={() => moveRow(idx, -1)}
                            disabled={idx === 0}
                            className="p-1 rounded text-muted hover:text-foreground disabled:opacity-30 cursor-pointer"
                            aria-label="Move row up"
                          >
                            ↑
                          </button>
                          <button
                            type="button"
                            onClick={() => moveRow(idx, 1)}
                            disabled={idx === draft.rows.length - 1}
                            className="p-1 rounded text-muted hover:text-foreground disabled:opacity-30 cursor-pointer"
                            aria-label="Move row down"
                          >
                            ↓
                          </button>
                          <button
                            type="button"
                            onClick={() => duplicateRow(idx)}
                            className="p-1 rounded text-muted hover:text-foreground cursor-pointer"
                            aria-label="Duplicate row"
                          >
                            <Copy size={12} />
                          </button>
                          <button
                            type="button"
                            onClick={() => deleteRow(idx)}
                            className="p-1 rounded text-rose-400 hover:bg-rose-500/10 cursor-pointer"
                            aria-label="Delete row"
                          >
                            <Trash2 size={12} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        <div className="flex items-center justify-between pt-2 border-t border-border/60">
          <button
            type="button"
            onClick={() => addRow()}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-elevated border border-border text-foreground hover:bg-elevated/80 cursor-pointer"
          >
            <Plus size={14} />
            <span>Add row</span>
          </button>
          <span className="text-[11px] text-muted hidden sm:inline">
            Press Enter to move down a column; Enter on the last row adds another.
          </span>
          {draft.rows.length > 0 && (
            <button
              type="button"
              onClick={handleDelete}
              className="text-xs text-rose-400 hover:underline cursor-pointer"
            >
              Delete this division
            </button>
          )}
        </div>
      </div>

      {/* Notes */}
      <div className="p-5 rounded-2xl bg-surface border border-border shadow-sm space-y-3">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="text-[11px] font-bold uppercase tracking-wider text-muted block mb-1.5">
              Stage label
            </label>
            <input
              type="text"
              value={draft.stage}
              onChange={(e) => updateDraft({ stage: e.target.value })}
              placeholder="Final Standings"
              className="w-full px-3 py-1.5 rounded-xl text-xs bg-elevated border border-border text-foreground"
            />
          </div>
          <div>
            <label className="text-[11px] font-bold uppercase tracking-wider text-muted block mb-1.5">
              Source
            </label>
            <input
              type="text"
              value={draft.source_page}
              onChange={(e) => updateDraft({ source_page: e.target.value })}
              className="w-full px-3 py-1.5 rounded-xl text-xs bg-elevated border border-border text-foreground"
            />
          </div>
        </div>
        <div>
          <label className="text-[11px] font-bold uppercase tracking-wider text-muted block mb-1.5">
            Note shown above the public table
          </label>
          <input
            type="text"
            value={draft.note || ""}
            onChange={(e) => updateDraft({ note: e.target.value })}
            placeholder="e.g. Only the top four placements were printed in this year's report."
            className="w-full px-3 py-1.5 rounded-xl text-xs bg-elevated border border-border text-foreground placeholder:text-muted"
          />
        </div>
      </div>

      {/* Awards */}
      <Section title="Awards & honors" icon={<Award size={16} />} subtitle={`${season} ${sport}`}>
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[
              { label: "Most Valuable Player", state: mvp, setState: setMvp, icon: <Crown size={13} />, tone: "text-amber-400" },
              { label: "Rookie of the Year", state: roy, setState: setRoy, icon: <Sparkles size={13} />, tone: "text-sky-400" },
            ].map((award) => (
              <div
                key={award.label}
                className="p-4 rounded-2xl bg-elevated/40 border border-border space-y-2"
              >
                <span
                  className={cn(
                    "text-[11px] font-bold uppercase tracking-wider flex items-center gap-1",
                    award.tone
                  )}
                >
                  {award.icon} {award.label}
                </span>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={award.state.player}
                    onChange={(e) =>
                      award.setState({ ...award.state, player: e.target.value })
                    }
                    placeholder="Player full name"
                    className="flex-1 px-3 py-1.5 rounded-xl text-xs bg-surface border border-border text-foreground"
                  />
                  <input
                    type="text"
                    list={SCHOOL_DATALIST_ID}
                    value={award.state.school}
                    onChange={(e) =>
                      award.setState({ ...award.state, school: e.target.value })
                    }
                    className="w-24 px-2 py-1.5 rounded-xl text-xs font-bold bg-surface border border-border text-foreground"
                    aria-label={`${award.label} school`}
                  />
                </div>
              </div>
            ))}
          </div>

          <div className="p-4 rounded-2xl bg-elevated/40 border border-border space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-foreground">
                Mythical selection ({mythical.length})
              </span>
              <button
                type="button"
                onClick={() => setMythical((prev) => [...prev, { player: "", school: "FEU" }])}
                className="text-xs font-bold text-amber-400 hover:underline cursor-pointer"
              >
                + Add player
              </button>
            </div>
            <div className="space-y-2">
              {mythical.map((p, i) => (
                <div key={i} className="flex items-center gap-2">
                  <input
                    type="text"
                    value={p.player}
                    onChange={(e) =>
                      setMythical((prev) =>
                        prev.map((m, mi) => (mi === i ? { ...m, player: e.target.value } : m))
                      )
                    }
                    placeholder="Player name"
                    className="flex-1 px-3 py-1.5 rounded-xl text-xs bg-surface border border-border text-foreground"
                  />
                  <input
                    type="text"
                    list={SCHOOL_DATALIST_ID}
                    value={p.school}
                    onChange={(e) =>
                      setMythical((prev) =>
                        prev.map((m, mi) => (mi === i ? { ...m, school: e.target.value } : m))
                      )
                    }
                    className="w-24 px-2 py-1.5 rounded-xl text-xs font-bold bg-surface border border-border text-foreground"
                    aria-label="Mythical selection school"
                  />
                  <button
                    type="button"
                    onClick={() => setMythical((prev) => prev.filter((_, mi) => mi !== i))}
                    className="p-1 rounded text-rose-400 hover:bg-rose-500/10 cursor-pointer"
                    aria-label="Remove player"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              ))}
            </div>
          </div>

          {sport === "Chess" && (
            <div className="p-4 rounded-2xl bg-elevated/40 border border-border space-y-3">
              <h4 className="text-xs font-bold uppercase tracking-wider text-amber-400">
                Board medalists
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {["1", "2", "3", "4", "5", "6"].map((board) => (
                  <div key={board} className="p-3 rounded-xl bg-surface border border-border space-y-2">
                    <span className="text-xs font-bold text-foreground">Board {board}</span>
                    {(["gold", "silver", "bronze"] as const).map((medal) => {
                      const existing = (chessBoards[board] || []).find((m) => m.medal === medal);
                      const emoji = medal === "gold" ? "🥇" : medal === "silver" ? "🥈" : "🥉";
                      return (
                        <div key={medal} className="flex items-center gap-1.5 text-xs">
                          <span>{emoji}</span>
                          <input
                            type="text"
                            value={existing?.player || ""}
                            onChange={(e) => {
                              const value = e.target.value;
                              setChessBoards((prev) => {
                                const list = [...(prev[board] || [])].filter(
                                  (m) => m.medal !== medal
                                );
                                if (value.trim()) {
                                  list.push({
                                    medal,
                                    player: value.trim(),
                                    school: existing?.school || "UST",
                                  });
                                }
                                return { ...prev, [board]: list };
                              });
                            }}
                            placeholder={`${medal} medalist`}
                            className="flex-1 min-w-0 px-2 py-1 rounded bg-elevated border border-border text-[11px]"
                          />
                          <input
                            type="text"
                            list={SCHOOL_DATALIST_ID}
                            value={existing?.school || ""}
                            onChange={(e) => {
                              const school = e.target.value;
                              setChessBoards((prev) => ({
                                ...prev,
                                [board]: (prev[board] || []).map((m) =>
                                  m.medal === medal ? { ...m, school } : m
                                ),
                              }));
                            }}
                            placeholder="School"
                            className="w-16 px-1 py-1 rounded bg-elevated border border-border text-[10px] font-bold"
                            aria-label={`${medal} medalist school for board ${board}`}
                          />
                        </div>
                      );
                    })}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </Section>
    </div>
  );
}
