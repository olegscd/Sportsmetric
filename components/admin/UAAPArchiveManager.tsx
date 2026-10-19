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
import { Badge } from "@/components/ui/Badge";
import { useConfirm } from "@/components/ui/ConfirmDialog";
import { TableShell, Td, Th } from "@/components/ui/Table";
import {
  COLUMN_PRESETS,
  createEmptyTable,
  formatCellValue,
  makeDivisionKey,
  makeExtrasKey,
  normalizeChessMedalists,
  normalizeDivision,
  normalizeSeasonLabel,
  resolveCellValue,
  toNumberOrNull,
  type UAAPArchiveExtras,
  type UAAPColumn,
  type UAAPDivisionAwards,
  type UAAPRow,
  type UAAPTable,
} from "@/lib/uaap-schema";
import { extractStandingsFromReport } from "@/lib/uaap-import";
import { UAAP_SCHOOLS, getSchoolCode, getSchoolName, getSchoolTheme, matchSchoolCode } from "@/lib/uaap-schools";
import {
  ArrowDown,
  ArrowUp,
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
    <div className="overflow-hidden rounded-card border border-border bg-surface shadow-card">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex min-h-12 w-full items-center justify-between gap-3 p-4 text-left transition-colors hover:bg-elevated/40"
      >
        <span className="flex items-center gap-2">
          <span className="text-archive" aria-hidden="true">{icon}</span>
          <span className="text-sm font-bold text-foreground">{title}</span>
          {subtitle && <span className="hidden text-xs text-muted sm:inline">{subtitle}</span>}
        </span>
        <ChevronDown
          size={16}
          aria-hidden="true"
          className={cn("shrink-0 text-muted transition-transform", open && "rotate-180")}
        />
      </button>
      {open && <div className="px-4 pb-4 border-t border-border/60 pt-4">{children}</div>}
    </div>
  );
}

export function UAAPArchiveManager({ onToast }: { onToast: ToastFn }) {
  const [tables, setTables] = useState<UAAPTable[]>([]);
  const [extras, setExtras] = useState<UAAPArchiveExtras>({});
  const [divisionVersions, setDivisionVersions] = useState<Record<string, number>>({});
  const [archiveLoaded, setArchiveLoaded] = useState(false);
  const [customSeasons, setCustomSeasons] = useState<string[]>([]);

  const fetchLive = useCallback(async () => {
    try {
      const res = await fetch("/api/uaap/data", { cache: "no-store" });
      if (!res.ok) throw new Error("Could not load archive data.");
      const json = await res.json();
      if (Array.isArray(json.tables)) setTables(json.tables);
      if (json.extras) setExtras(json.extras);
      setDivisionVersions(json.divisionVersions ?? {});
      setArchiveLoaded(true);
    } catch (err) {
      onToast(err instanceof Error ? err.message : "Archive load failed.", "error");
    }
  }, [onToast]);

  useEffect(() => {
    // One-shot hydration of the admin editor from the live archive. This is a
    // synchronization effect (external data -> editor state), not derived
    // render state, so the setState-in-effect rule does not apply cleanly.
    // eslint-disable-next-line react-hooks/set-state-in-effect
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
  const confirm = useConfirm();

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
  const [extrasBaseline, setExtrasBaseline] = useState("");

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
    cloned.rows = cloned.rows.map((r) => ({
      ...r,
      team: getSchoolName(r.team),
    }));
    setDraft(cloned);
    setBaseline(JSON.stringify(cloned));

    const extrasKey = makeExtrasKey(sport, season);
    const awards = extras.awards?.[extrasKey]?.[normalizeDivision(division)] as
      | UAAPDivisionAwards
      | undefined;
    const nextMvp = { player: awards?.mvp?.player || "", school: awards?.mvp?.school || "FEU" };
    const nextRoy = {
      player: awards?.rookie_of_the_year?.player || "",
      school: awards?.rookie_of_the_year?.school || "FEU",
    };
    const nextMythical = Array.isArray(awards?.mythical_five)
      ? awards.mythical_five.map((entry) =>
          typeof entry === "string"
            ? { player: entry, school: "" }
            : {
                player: entry.player ?? entry.name ?? "",
                school: entry.school ?? "",
                ...(entry.position ? { position: entry.position } : {}),
              }
        )
      : [];
    setMvp(nextMvp);
    setRoy(nextRoy);
    setMythical(nextMythical);

    const medalists = normalizeChessMedalists(
      extras.chess_medalists?.[extrasKey]?.[normalizeDivision(division)]
    );
    const nextChess = medalists
      ? (Object.fromEntries(
          Object.entries(medalists).map(([board, list]) => [
            board,
            list.map((m) => ({ medal: m.medal ?? "gold", player: m.player, school: m.school })),
          ])
        ) as typeof chessBoards)
      : { "1": [], "2": [], "3": [], "4": [], "5": [], "6": [] };
    setChessBoards(nextChess);
    setExtrasBaseline(
      JSON.stringify({ mvp: nextMvp, roy: nextRoy, mythical: nextMythical, chessBoards: nextChess })
    );
  }, [season, sport, division, tables, extras]);

  useEffect(() => {
    // The draft is an editable copy of the selected division, so it has to be
    // re-seeded whenever the selection or the underlying archive data changes.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadDivision();
  }, [loadDivision]);

  const isDirty =
    (baseline !== "" && JSON.stringify(draft) !== baseline) ||
    (extrasBaseline !== "" &&
      JSON.stringify({ mvp, roy, mythical, chessBoards }) !== extrasBaseline);

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
      codes.map((code, idx) => ({
        rank: idx + 1,
        team: getSchoolName(code),
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
  const [importSeed, setImportSeed] = useState<string | undefined>(undefined);

  const handleSave = useCallback(async () => {
    if (!archiveLoaded || isSaving) return;
    if (draft.rows.length === 0) {
      onToast("Nothing to save — add at least one row.", "error");
      return;
    }

    setIsSaving(true);

    const normalizeSchoolVal = (s: string) => matchSchoolCode(s) || s.trim();
    const chessPayload =
      sport === "Chess"
        ? Object.fromEntries(
            Object.entries(chessBoards)
              .filter(([, list]) => list.length > 0)
              .map(([b, list]) => [
                b,
                list.map((m) => ({ ...m, school: normalizeSchoolVal(m.school) })),
              ])
          )
        : undefined;

    const normalizedDraft: UAAPTable = {
      ...draft,
      rows: draft.rows.map((r) => ({
        ...r,
        team: normalizeSchoolVal(r.team),
      })),
    };

    const res = await saveUAAPArchiveData({
      table: normalizedDraft,
      expectedVersion: divisionVersions[makeDivisionKey(draft.season, draft.sport, draft.division)] ?? 0,
      awards: {
        mvp: mvp.player.trim()
          ? { player: mvp.player.trim(), school: normalizeSchoolVal(mvp.school) }
          : null,
        rookie_of_the_year: roy.player.trim()
          ? { player: roy.player.trim(), school: normalizeSchoolVal(roy.school) }
          : null,
        mythical_five:
          mythical.filter((m) => m.player.trim()).length > 0
            ? mythical
                .filter((m) => m.player.trim())
                .map((m) => ({ ...m, school: normalizeSchoolVal(m.school) }))
            : null,
      },
      chess_medalists: sport === "Chess" ? chessPayload ?? {} : undefined,
    });

    setIsSaving(false);

    if (!res.success) {
      onToast(`Save failed: ${res.error}`, "error");
      return;
    }

    if (res.data) {
      setDivisionVersions(res.data.divisionVersions ?? {});
      setTables(res.data.tables);
      setExtras(res.data.extras);
    } else {
      fetchLive();
    }
    setBaseline(JSON.stringify(draft));
    setExtrasBaseline(JSON.stringify({ mvp, roy, mythical, chessBoards }));

    if (res.warning) {
      onToast(res.warning, "error");
    } else {
      onToast(
        `Saved ${season} ${sport} (${division}) — ${res.count} ${res.count === 1 ? "row" : "rows"}.`,
        "success"
      );
    }
  }, [draft, mvp, roy, mythical, chessBoards, sport, season, division, onToast, fetchLive, archiveLoaded, isSaving, divisionVersions]);

  const handleDelete = async () => {
    if (!archiveLoaded || isSaving) return;
    const confirmed = await confirm({
      title: `Delete all recorded standings for ${season} ${sport} (${division})?`,
      description: "This can't be undone.",
      confirmLabel: "Delete standings",
    });
    if (!confirmed) return;

    const res = await deleteUAAPArchiveDivision(season, sport, division, divisionVersions[makeDivisionKey(season, sport, division)] ?? 0);
    if (!res.success) {
      onToast(`Delete failed: ${res.error}`, "error");
      return;
    }
    if (res.data) {
      setDivisionVersions(res.data.divisionVersions ?? {});
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

  const switchTo = async (next: { season?: string; sport?: string; division?: string }) => {
    if (
      isDirty &&
      !(await confirm({
        title: "You have unsaved changes.",
        description: "Discard them and switch?",
        confirmLabel: "Discard changes",
      }))
    ) {
      return;
    }
    if (next.season !== undefined) setSeason(next.season);
    if (next.sport !== undefined) setSport(next.sport);
    if (next.division !== undefined) setDivision(normalizeDivision(next.division));
  };

  // -------------------------------------------------------------------------
  // OCR reference drawer
  // -------------------------------------------------------------------------

  const [showReport, setShowReport] = useState(false);
  const [report, setReport] = useState({ content: "", sourceFile: "", loading: false });

  // The report is fetched by openImportFromScan (the only action that opens
  // the drawer), so no separate effect is needed here.

  const openImportFromScan = async () => {
    setShowReport(true);
    setReport((r) => ({ ...r, loading: true }));
    const res = await getUAAPAnnualReportSnippet(season, sport);
    setReport({ content: res.content, sourceFile: res.sourceFile || "", loading: false });
    if (!res.content || res.content.startsWith("No report") || res.content.startsWith("Could not") || res.content === "Unauthorized." || res.content === "Invalid season identifier.") {
      onToast(res.content || "No annual report found for this season.", "error");
      return;
    }
    const extracted = extractStandingsFromReport(res.content, division);
    setImportSeed(extracted.paste);
    setShowImport(true);
    const awardBits = [
      extracted.awards.mvp ? "MVP" : null,
      extracted.awards.rookie_of_the_year ? "Rookie of the Year" : null,
    ].filter(Boolean);
    onToast(
      extracted.tableCount > 0
        ? `Pulled a ${extracted.delimiterLabel}${awardBits.length ? ` · found ${awardBits.join(" and ")}` : ""}. Confirm columns, then apply.`
        : "Opened the scan in bulk import — parse it and map the columns.",
      "success"
    );
  };

  const [newSeason, setNewSeason] = useState("");
  const [newDivision, setNewDivision] = useState("");

  return (
    <div className="space-y-5 max-w-6xl mx-auto pb-24">
      <datalist id={SCHOOL_DATALIST_ID}>
        {UAAP_SCHOOLS.map((s) => (
          <option key={s.code} value={s.name}>
            {s.code}
          </option>
        ))}
      </datalist>

      {/* Header */}
      <div className="flex flex-col justify-between gap-4 border-b border-border pb-4 sm:flex-row sm:items-center">
        <div>
          <h2 className="flex items-center gap-2 text-xl font-black text-foreground">
            <span className="rounded-control border border-archive/30 bg-archive/15 p-2 text-archive">
              <LayoutGrid size={18} aria-hidden="true" />
            </span>
            UAAP Historical Archive
          </h2>
          <p className="mt-1 text-xs text-muted">
            Each division defines its own columns, so a 1988 placement list and a 2003 win-loss table
            can both be recorded accurately.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {isDirty && (
            <Badge tone="archive">
              Unsaved
            </Badge>
          )}
          <a
            href={`/uaap?sport=${encodeURIComponent(sport)}&season=${encodeURIComponent(
              season
            )}&division=${encodeURIComponent(division)}`}
            target="_blank"
            rel="noreferrer"
            className="inline-flex min-h-10 items-center gap-1.5 rounded-control border border-border bg-surface px-3 text-xs font-semibold text-muted transition-colors hover:bg-elevated hover:text-foreground"
          >
            <span>Preview</span>
            <ExternalLink size={13} aria-hidden="true" />
          </a>
          <button
            type="button"
            onClick={handleSave}
            disabled={isSaving}
            className="inline-flex min-h-10 items-center gap-1.5 rounded-control bg-archive px-4 text-xs font-bold text-bg transition-colors hover:bg-archive/90 disabled:opacity-50"
          >
            <Save size={14} aria-hidden="true" />
            <span>{isSaving ? "Saving…" : "Save (Ctrl+S)"}</span>
          </button>
        </div>
      </div>

      {/* Selectors */}
      <div className="grid grid-cols-1 gap-4 rounded-card border border-border bg-surface p-5 shadow-card md:grid-cols-3">
        <div>
          <label htmlFor="uaap-season" className="mb-1.5 block text-2xs font-bold uppercase tracking-wider text-muted">
            Season
          </label>
          <div className="flex items-center gap-2">
            <select
              id="uaap-season"
              value={season}
              onChange={(e) => void switchTo({ season: e.target.value })}
              className="min-h-11 flex-1 rounded-control border border-border bg-elevated px-3 text-xs font-bold text-foreground focus:outline-none focus:ring-2 focus:ring-archive/50"
            >
              {seasons.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>
          <div className="mt-2 flex items-center gap-1.5">
            <input
              type="text"
              value={newSeason}
              aria-label="New season"
              onChange={(e) => setNewSeason(e.target.value)}
              placeholder="Add season, e.g. 2004-2005"
              className="min-h-10 flex-1 rounded-control border border-border bg-elevated px-2.5 text-2xs text-foreground placeholder:text-muted"
            />
            <button
              type="button"
              onClick={() => {
                const value = normalizeSeasonLabel(newSeason) ?? newSeason.trim();
                if (!value) return;
                if (!/^\d{4}-\d{4}$/.test(value)) {
                  onToast("Use a season like 2004-2005.", "error");
                  return;
                }
                setCustomSeasons((prev) => Array.from(new Set([...prev, value])));
                void switchTo({ season: value });
                setNewSeason("");
              }}
              className="inline-flex h-10 w-10 items-center justify-center rounded-control border border-border bg-elevated text-muted hover:text-foreground"
              aria-label="Add season"
            >
              <Plus size={14} aria-hidden="true" />
            </button>
          </div>
        </div>

        <div>
          <label htmlFor="uaap-sport" className="mb-1.5 block text-2xs font-bold uppercase tracking-wider text-muted">
            Sport
          </label>
          <select
            id="uaap-sport"
            value={sport}
            onChange={(e) => void switchTo({ sport: e.target.value })}
            className="min-h-11 w-full rounded-control border border-border bg-elevated px-3 text-xs font-bold text-foreground focus:outline-none focus:ring-2 focus:ring-archive/50"
          >
            {ALL_SPORTS.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>

        <div>
          <span id="uaap-division-label" className="mb-1.5 block text-2xs font-bold uppercase tracking-wider text-muted">
            Division
          </span>
          <div role="group" aria-labelledby="uaap-division-label" className="flex flex-wrap items-center gap-1.5">
            {divisions.map((div) => (
              <button
                key={div}
                type="button"
                aria-pressed={normalizeDivision(division) === normalizeDivision(div)}
                onClick={() => void switchTo({ division: div })}
                className={cn(
                  "min-h-10 rounded-control px-3 text-xs font-semibold transition-colors",
                  normalizeDivision(division) === normalizeDivision(div)
                    ? "bg-archive font-bold text-bg"
                    : "border border-border bg-elevated text-muted hover:text-foreground"
                )}
              >
                {div}
              </button>
            ))}
          </div>
          <div className="mt-2 flex items-center gap-1.5">
            <input
              type="text"
              value={newDivision}
              aria-label="New division"
              onChange={(e) => setNewDivision(e.target.value)}
              placeholder="Custom division"
              className="min-h-10 flex-1 rounded-control border border-border bg-elevated px-2.5 text-2xs text-foreground placeholder:text-muted"
            />
            <button
              type="button"
              onClick={() => {
                const value = newDivision.trim();
                if (!value) return;
                void switchTo({ division: value });
                setNewDivision("");
              }}
              className="inline-flex h-10 w-10 items-center justify-center rounded-control border border-border bg-elevated text-muted hover:text-foreground"
              aria-label="Add division"
            >
              <Plus size={14} aria-hidden="true" />
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
          onSelect={(s, sp, div) => void switchTo({ season: s, sport: sp, division: div ?? "Men's" })}
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
          key={importSeed ? `seed-${season}-${sport}-${division}` : "blank"}
          columns={draft.columns}
          division={division}
          initialText={importSeed}
          onClose={() => {
            setShowImport(false);
            setImportSeed(undefined);
          }}
          onExtractedAwards={(awards) => {
            if (awards.mvp) {
              setMvp({
                player: awards.mvp.player,
                school: getSchoolName(awards.mvp.school) || awards.mvp.school,
              });
            }
            if (awards.rookie_of_the_year) {
              setRoy({
                player: awards.rookie_of_the_year.player,
                school:
                  getSchoolName(awards.rookie_of_the_year.school) ||
                  awards.rookie_of_the_year.school,
              });
            }
            onToast("Filled awards from the pasted scan. Save when the table looks right.", "success");
          }}
          onApply={(rows, mode, newColumns) => {
            const displayRows = rows.map((r) => ({
              ...r,
              team: getSchoolName(r.team),
            }));
            setDraft((prev) => {
              const next = mode === "replace" ? displayRows : [...prev.rows, ...displayRows];
              return {
                ...prev,
                columns: newColumns ?? prev.columns,
                rows: next.map((r, i) => ({ ...r, rank: r.rank || i + 1 })),
              };
            });
            setShowImport(false);
            setImportSeed(undefined);
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
      <div className="space-y-4 rounded-card border border-border bg-surface p-4 shadow-card sm:p-5">
        <div className="flex flex-col justify-between gap-3 border-b border-border/60 pb-3 sm:flex-row sm:items-center">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-sm font-bold text-foreground">
              Standings ({draft.rows.length} {draft.rows.length === 1 ? "row" : "rows"})
            </h3>
            <Badge tone="neutral">
              {season} · {sport} · {normalizeDivision(division)}
            </Badge>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => {
                setImportSeed(undefined);
                setShowImport((v) => !v);
              }}
              className="inline-flex min-h-10 cursor-pointer items-center gap-1.5 rounded-control border border-border bg-surface-2 px-3 text-2xs font-semibold text-foreground transition-colors hover:bg-elevated"
            >
              <FileUp size={14} aria-hidden="true" />
              <span>Bulk import</span>
            </button>
            <button
              type="button"
              onClick={() => void openImportFromScan()}
              className="inline-flex min-h-10 cursor-pointer items-center gap-1.5 rounded-control border border-archive/30 bg-archive/15 px-3 text-2xs font-semibold text-archive transition-colors hover:bg-archive/20"
            >
              <Sparkles size={14} aria-hidden="true" />
              <span>Import from scan</span>
            </button>
            <button
              type="button"
              onClick={prefillStandardEight}
              className="inline-flex min-h-10 cursor-pointer items-center gap-1.5 rounded-control border border-border bg-surface-2 px-3 text-2xs font-semibold text-foreground transition-colors hover:bg-elevated"
            >
              + 8 standard schools
            </button>
            <button
              type="button"
              onClick={autoRank}
              className="inline-flex min-h-10 cursor-pointer items-center gap-1.5 rounded-control border border-border bg-surface-2 px-3 text-2xs font-semibold text-foreground transition-colors hover:bg-elevated"
            >
              <RotateCcw size={13} aria-hidden="true" />
              <span>Auto-rank</span>
            </button>
            <button
              type="button"
              aria-pressed={showReport}
              onClick={() => setShowReport((v) => !v)}
              className={cn(
                "inline-flex min-h-10 cursor-pointer items-center gap-1.5 rounded-control border px-3 text-2xs font-semibold transition-colors",
                showReport
                  ? "border-archive/40 bg-archive/15 text-archive"
                  : "border-border bg-surface-2 text-foreground hover:bg-elevated"
              )}
            >
              <BookOpen size={14} aria-hidden="true" />
              <span>Source scan</span>
            </button>
          </div>
        </div>

        {showReport && (
          <div className="space-y-2 rounded-card border border-border bg-surface-2/60 p-4">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/60 pb-2">
              <span className="flex items-center gap-2 text-xs font-bold text-foreground">
                <FileText size={14} className="text-archive" aria-hidden="true" />
                Annual report text — {season} {sport}
              </span>
              <div className="flex items-center gap-2">
                <span className="font-mono text-2xs text-muted">{report.sourceFile}</span>
                <button
                  type="button"
                  onClick={() => void openImportFromScan()}
                  disabled={report.loading || !report.content}
                  className="min-h-10 cursor-pointer rounded-control bg-archive px-3 text-2xs font-bold text-bg transition-colors hover:bg-archive/90 disabled:opacity-40"
                >
                  Extract table
                </button>
              </div>
            </div>
            {report.loading ? (
              <p className="py-6 text-center text-xs text-muted">Loading reference text…</p>
            ) : (
              <div className="max-h-60 overflow-y-auto whitespace-pre-wrap rounded-control bg-surface p-3 font-mono text-2xs leading-relaxed text-muted">
                {report.content || "No matching section found in the annual report for this sport."}
              </div>
            )}
          </div>
        )}

        <TableShell>
          <table className="w-full border-collapse text-left text-xs">
            <thead>
              <tr>
                <Th sticky className="w-14 px-2 text-center">Rank</Th>
                <Th className="sticky left-14 z-20 min-w-48 px-3">School</Th>
                {draft.columns.map((col) => (
                  <Th key={col.key} className="w-24 px-3 text-center">
                    {col.label}
                  </Th>
                ))}
                <Th className="min-w-56 px-3">Result / Notes</Th>
                <Th className="w-44 px-2 text-center">Row</Th>
              </tr>
            </thead>
            <tbody ref={gridRef} className="font-medium">
              {draft.rows.length === 0 ? (
                <tr>
                  <Td
                    colSpan={draft.columns.length + 4}
                    className="py-10 text-center text-muted"
                  >
                    <p>No rows yet for this division.</p>
                    <div className="mt-3 flex flex-wrap items-center justify-center gap-2">
                      <button
                        type="button"
                        onClick={() => void openImportFromScan()}
                        className="min-h-10 cursor-pointer rounded-control bg-archive px-3 text-xs font-bold text-bg transition-colors hover:bg-archive/90"
                      >
                        Import from annual report
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setImportSeed(undefined);
                          setShowImport(true);
                        }}
                        className="min-h-10 cursor-pointer rounded-control border border-border bg-surface-2 px-3 text-xs font-semibold text-foreground transition-colors hover:bg-elevated"
                      >
                        Paste a table
                      </button>
                      <button
                        type="button"
                        onClick={prefillStandardEight}
                        className="min-h-10 cursor-pointer rounded-control border border-border bg-surface-2 px-3 text-xs font-semibold text-foreground transition-colors hover:bg-elevated"
                      >
                        + 8 standard schools
                      </button>
                    </div>
                  </Td>
                </tr>
              ) : (
                draft.rows.map((row, idx) => {
                  const theme = getSchoolTheme(row.team);
                  const schoolCode = getSchoolCode(row.team);
                  return (
                    <tr key={idx} className="group transition-colors hover:bg-elevated/40">
                      <Td sticky className="w-14 bg-surface px-2 py-1.5 text-center">
                        <input
                          type="number"
                          value={row.rank}
                          onChange={(e) =>
                            updateRow(idx, { rank: parseInt(e.target.value, 10) || idx + 1 })
                          }
                          className="min-h-10 w-12 rounded-control border border-border bg-surface-2 px-1 text-center font-mono font-bold text-foreground focus:outline-none focus:ring-2 focus:ring-archive/40"
                          aria-label={`Rank for row ${idx + 1}`}
                        />
                      </Td>

                      <Td className="sticky left-14 z-10 min-w-48 bg-surface px-3 py-1.5">
                        <div className="flex items-center gap-2">
                          {schoolCode && (
                            <span
                              className={cn(
                                "shrink-0 rounded border px-2 py-0.5 text-2xs font-bold",
                                theme.bg,
                                theme.text
                              )}
                            >
                              {schoolCode}
                            </span>
                          )}
                          <div className="min-w-0 flex-1">
                            <input
                              type="text"
                              list={SCHOOL_DATALIST_ID}
                              value={row.team}
                              data-cell={`${idx}:team`}
                              onChange={(e) => updateRow(idx, { team: e.target.value })}
                              onBlur={() => {
                                const name = getSchoolName(row.team);
                                if (name && name !== row.team) {
                                  updateRow(idx, { team: name });
                                }
                              }}
                              onKeyDown={(e) => handleCellKeyDown(e, idx, "team")}
                              placeholder="School name (e.g. University of the Philippines)"
                              className="min-h-10 w-full rounded-control border border-border bg-surface-2 px-2.5 text-xs font-semibold text-foreground placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-archive/40"
                              aria-label={`School for row ${idx + 1}`}
                            />
                          </div>
                        </div>
                      </Td>

                      {draft.columns.map((col) => (
                        <Td key={col.key} className="px-3 py-1.5 text-center">
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
                              className="min-h-10 w-16 rounded-control border border-border bg-surface-2 px-1 text-center font-mono font-bold text-foreground focus:outline-none focus:ring-2 focus:ring-archive/40"
                              aria-label={`${col.label} for row ${idx + 1}`}
                            />
                          )}
                        </Td>
                      ))}

                      <Td className="min-w-56 px-3 py-1.5">
                        <input
                          type="text"
                          value={row.details || ""}
                          data-cell={`${idx}:details`}
                          onChange={(e) => updateRow(idx, { details: e.target.value })}
                          onKeyDown={(e) => handleCellKeyDown(e, idx, "details")}
                          placeholder="Champion, Runner-up, withdrew…"
                          className="min-h-10 w-full rounded-control border border-border bg-surface-2 px-2 text-xs text-foreground placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-archive/40"
                          aria-label={`Notes for row ${idx + 1}`}
                        />
                      </Td>

                      <Td className="w-44 px-2 py-1.5">
                        <div className="flex items-center justify-center gap-0.5">
                          <button
                            type="button"
                            onClick={() => moveRow(idx, -1)}
                            disabled={idx === 0}
                            className="inline-flex h-10 w-10 cursor-pointer items-center justify-center rounded-control text-muted transition-colors hover:bg-elevated hover:text-foreground disabled:opacity-30"
                            aria-label="Move row up"
                          >
                            <ArrowUp size={14} aria-hidden="true" />
                          </button>
                          <button
                            type="button"
                            onClick={() => moveRow(idx, 1)}
                            disabled={idx === draft.rows.length - 1}
                            className="inline-flex h-10 w-10 cursor-pointer items-center justify-center rounded-control text-muted transition-colors hover:bg-elevated hover:text-foreground disabled:opacity-30"
                            aria-label="Move row down"
                          >
                            <ArrowDown size={14} aria-hidden="true" />
                          </button>
                          <button
                            type="button"
                            onClick={() => duplicateRow(idx)}
                            className="inline-flex h-10 w-10 cursor-pointer items-center justify-center rounded-control text-muted transition-colors hover:bg-elevated hover:text-foreground"
                            aria-label="Duplicate row"
                          >
                            <Copy size={14} aria-hidden="true" />
                          </button>
                          <button
                            type="button"
                            onClick={() => deleteRow(idx)}
                            className="inline-flex h-10 w-10 cursor-pointer items-center justify-center rounded-control text-negative transition-colors hover:bg-negative/10"
                            aria-label="Delete row"
                          >
                            <Trash2 size={14} aria-hidden="true" />
                          </button>
                        </div>
                      </Td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </TableShell>

        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border/60 pt-2">
          <button
            type="button"
            onClick={() => addRow()}
            className="inline-flex min-h-10 cursor-pointer items-center gap-1.5 rounded-control border border-border bg-surface-2 px-3 text-xs font-bold text-foreground transition-colors hover:bg-elevated"
          >
            <Plus size={14} aria-hidden="true" />
            <span>Add row</span>
          </button>
          <span className="hidden text-2xs text-muted sm:inline">
            Press Enter to move down a column; Enter on the last row adds another.
          </span>
          {draft.rows.length > 0 && (
            <button
              type="button"
              onClick={handleDelete}
              className="inline-flex min-h-10 cursor-pointer items-center text-xs font-semibold text-negative hover:underline"
            >
              Delete this division
            </button>
          )}
        </div>
      </div>

      {/* Notes */}
      <div className="space-y-3 rounded-card border border-border bg-surface p-5 shadow-card">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div>
            <label htmlFor="uaap-stage" className="mb-1.5 block text-2xs font-bold uppercase tracking-wider text-muted">
              Stage label
            </label>
            <input
              id="uaap-stage"
              type="text"
              value={draft.stage}
              onChange={(e) => updateDraft({ stage: e.target.value })}
              placeholder="Final Standings"
              className="min-h-11 w-full rounded-control border border-border bg-surface-2 px-3 text-xs text-foreground placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-archive/40"
            />
          </div>
          <div>
            <label htmlFor="uaap-source" className="mb-1.5 block text-2xs font-bold uppercase tracking-wider text-muted">
              Source
            </label>
            <input
              id="uaap-source"
              type="text"
              value={draft.source_page}
              onChange={(e) => updateDraft({ source_page: e.target.value })}
              placeholder="e.g. UAAP 2003 annual report, p. 42"
              className="min-h-11 w-full rounded-control border border-border bg-surface-2 px-3 text-xs text-foreground placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-archive/40"
            />
          </div>
        </div>
        <div>
          <label htmlFor="uaap-note" className="mb-1.5 block text-2xs font-bold uppercase tracking-wider text-muted">
            Note shown above the public table
          </label>
          <input
            id="uaap-note"
            type="text"
            value={draft.note || ""}
            onChange={(e) => updateDraft({ note: e.target.value })}
            placeholder="e.g. Only the top four placements were printed in this year's report."
            className="min-h-11 w-full rounded-control border border-border bg-surface-2 px-3 text-xs text-foreground placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-archive/40"
          />
        </div>
      </div>

      {/* Awards */}
      <Section title="Awards & honors" icon={<Award size={16} />} subtitle={`${season} ${sport}`}>
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[
              { label: "Most Valuable Player", state: mvp, setState: setMvp, icon: <Crown size={13} aria-hidden="true" />, tone: "text-archive" },
              { label: "Rookie of the Year", state: roy, setState: setRoy, icon: <Sparkles size={13} aria-hidden="true" />, tone: "text-info" },
            ].map((award) => (
              <div
                key={award.label}
                className="space-y-2 rounded-card border border-border bg-surface-2/60 p-4"
              >
                <span
                  className={cn(
                    "flex items-center gap-1 text-2xs font-bold uppercase tracking-wider",
                    award.tone
                  )}
                >
                  {award.icon} {award.label}
                </span>
                <div className="flex flex-wrap items-center gap-2">
                  <input
                    type="text"
                    value={award.state.player}
                    onChange={(e) =>
                      award.setState({ ...award.state, player: e.target.value })
                    }
                    placeholder="Player full name"
                    aria-label={`${award.label} player`}
                    className="min-h-11 flex-1 rounded-control border border-border bg-surface px-3 text-xs text-foreground placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-archive/40"
                  />
                  <input
                    type="text"
                    list={SCHOOL_DATALIST_ID}
                    value={award.state.school}
                    onChange={(e) =>
                      award.setState({ ...award.state, school: e.target.value })
                    }
                    className="min-h-11 w-24 rounded-control border border-border bg-surface px-2 text-xs font-bold text-foreground focus:outline-none focus:ring-2 focus:ring-archive/40"
                    aria-label={`${award.label} school`}
                  />
                </div>
              </div>
            ))}
          </div>

          <div className="space-y-3 rounded-card border border-border bg-surface-2/60 p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-2xs font-bold uppercase tracking-wider text-foreground">
                Mythical selection ({mythical.length})
              </span>
              <button
                type="button"
                onClick={() => setMythical((prev) => [...prev, { player: "", school: "FEU" }])}
                className="inline-flex min-h-10 cursor-pointer items-center text-xs font-bold text-archive hover:underline"
              >
                + Add player
              </button>
            </div>
            <div className="space-y-2">
              {mythical.map((p, i) => (
                <div key={i} className="flex flex-wrap items-center gap-2">
                  <input
                    type="text"
                    value={p.player}
                    onChange={(e) =>
                      setMythical((prev) =>
                        prev.map((m, mi) => (mi === i ? { ...m, player: e.target.value } : m))
                      )
                    }
                    placeholder="Player name"
                    aria-label={`Mythical selection player ${i + 1}`}
                    className="min-h-11 min-w-0 flex-1 rounded-control border border-border bg-surface px-3 text-xs text-foreground placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-archive/40"
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
                    className="min-h-11 w-24 rounded-control border border-border bg-surface px-2 text-xs font-bold text-foreground focus:outline-none focus:ring-2 focus:ring-archive/40"
                    aria-label={`Mythical selection ${i + 1} school`}
                  />
                  <button
                    type="button"
                    onClick={() => setMythical((prev) => prev.filter((_, mi) => mi !== i))}
                    className="inline-flex h-10 w-10 cursor-pointer items-center justify-center rounded-control text-negative transition-colors hover:bg-negative/10"
                    aria-label="Remove player"
                  >
                    <Trash2 size={14} aria-hidden="true" />
                  </button>
                </div>
              ))}
            </div>
          </div>

          {sport === "Chess" && (
            <div className="space-y-3 rounded-card border border-border bg-surface-2/60 p-4">
              <h4 className="text-2xs font-bold uppercase tracking-wider text-archive">
                Board medalists
              </h4>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {["1", "2", "3", "4", "5", "6"].map((board) => (
                  <div key={board} className="space-y-2 rounded-control border border-border bg-surface p-3">
                    <span className="text-xs font-bold text-foreground">Board {board}</span>
                    {(["gold", "silver", "bronze"] as const).map((medal) => {
                      const existing = (chessBoards[board] || []).find((m) => m.medal === medal);
                      return (
                        <div key={medal} className="flex items-center gap-1.5 text-xs">
                          <Badge
                            tone={medal === "gold" ? "archive" : "neutral"}
                            size="sm"
                            className="w-12 justify-center"
                          >
                            {medal === "gold" ? "Gold" : medal === "silver" ? "Silver" : "Bronze"}
                          </Badge>
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
                            aria-label={`${medal} medalist for board ${board}`}
                            className="min-h-10 min-w-0 flex-1 rounded-control border border-border bg-surface-2 px-2 text-2xs text-foreground placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-archive/40"
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
                            className="min-h-10 w-16 rounded-control border border-border bg-surface-2 px-1 text-2xs font-bold text-foreground placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-archive/40"
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

      {isDirty && (
        <div className="pointer-events-none fixed inset-x-0 bottom-4 z-40 flex justify-center px-4">
          <div className="pointer-events-auto flex items-center gap-3 rounded-panel border border-archive/40 bg-surface px-4 py-2.5 shadow-raised">
            <span className="text-xs font-bold text-archive">Unsaved changes</span>
            <button
              type="button"
              onClick={() => void handleSave()}
              disabled={isSaving}
              className="inline-flex min-h-10 cursor-pointer items-center gap-1.5 rounded-control bg-archive px-3 text-xs font-bold text-bg transition-colors hover:bg-archive/90 disabled:opacity-50"
            >
              <Save size={13} aria-hidden="true" />
              {isSaving ? "Saving…" : "Save"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
