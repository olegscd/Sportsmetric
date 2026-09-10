"use client";

import { useEffect, useMemo, useState } from "react";
import { cn } from "@/lib/utils";
import { ArrowRight, FileUp, Sparkles, X } from "lucide-react";
import {
  applyImport,
  guessTargets,
  parsePastedTable,
  type ImportTarget,
  type ParsedGrid,
} from "@/lib/uaap-import";
import {
  COLUMN_PRESETS,
  type UAAPColumn,
  type UAAPColumnPreset,
  type UAAPRow,
} from "@/lib/uaap-schema";
import { getSchoolName } from "@/lib/uaap-schools";

const PLACEHOLDER = `Paste rows from a spreadsheet, CSV, or typed-out scan. For example:

1  FEU   12-2  Champion
2  UST   11-3  Runner-up
3  UP     8-6`;

export function BulkImportPanel({
  columns,
  onApply,
  onClose,
}: {
  columns: UAAPColumn[];
  onApply: (rows: UAAPRow[], mode: "replace" | "append", newColumns?: UAAPColumn[]) => void;
  onClose: () => void;
}) {
  const [text, setText] = useState("");
  const [grid, setGrid] = useState<ParsedGrid | null>(null);
  const [activeColumns, setActiveColumns] = useState<UAAPColumn[]>(columns);
  const [detectedPreset, setDetectedPreset] = useState<UAAPColumnPreset | null>(null);
  const [targets, setTargets] = useState<ImportTarget[]>([]);
  const [mode, setMode] = useState<"replace" | "append">("replace");

  useEffect(() => {
    setActiveColumns(columns);
    setDetectedPreset(null);
  }, [columns]);

  const enterableColumns = useMemo(
    () => activeColumns.filter((c) => !c.derived),
    [activeColumns]
  );

  const targetOptions = useMemo(() => {
    const base = [
      { value: "ignore", label: "Skip this column" },
      { value: "rank", label: "Rank" },
      { value: "team", label: "School" },
      { value: "record", label: "Record (W-L in one cell)" },
      { value: "details", label: "Result / Notes" },
    ];
    return [
      ...base,
      ...enterableColumns.map((c) => ({ value: `column:${c.key}`, label: c.label })),
    ];
  }, [enterableColumns]);

  const handleParse = () => {
    const parsed = parsePastedTable(text);
    if (parsed.rows.length === 0) {
      setGrid(null);
      setTargets([]);
      setDetectedPreset(null);
      return;
    }

    let colsToUse = activeColumns;
    let foundPreset: UAAPColumnPreset | null = null;

    // If current columns are empty (e.g. Placement only), detect if pasted headers match a preset
    if (colsToUse.length === 0 && parsed.headers) {
      const headerStrs = parsed.headers.map((h) => h.toLowerCase().trim());
      const hasW = headerStrs.some((h) => /^(w|wins)$/i.test(h));
      const hasL = headerStrs.some((h) => /^(l|losses)$/i.test(h));
      const hasPts = headerStrs.some((h) => /^(pts|points)$/i.test(h));
      const hasMedals = headerStrs.some((h) => /^(gold|silver|bronze)$/i.test(h));

      if (hasW && hasL && hasPts) {
        foundPreset = COLUMN_PRESETS.find((p) => p.id === "win-loss-points") ?? null;
      } else if (hasW && hasL) {
        foundPreset = COLUMN_PRESETS.find((p) => p.id === "win-loss") ?? null;
      } else if (hasPts) {
        foundPreset = COLUMN_PRESETS.find((p) => p.id === "points") ?? null;
      } else if (hasMedals) {
        foundPreset = COLUMN_PRESETS.find((p) => p.id === "medals") ?? null;
      }

      if (foundPreset) {
        colsToUse = foundPreset.columns.map((c) => ({ ...c }));
        setActiveColumns(colsToUse);
        setDetectedPreset(foundPreset);
      }
    }

    setGrid(parsed);
    setTargets(guessTargets(parsed, colsToUse));
  };

  const previewRows = useMemo(() => {
    if (!grid) return [];
    return applyImport(grid, targets, activeColumns);
  }, [grid, targets, activeColumns]);

  const setTarget = (idx: number, value: string) => {
    setTargets((prev) =>
      prev.map((t, i) => {
        if (i !== idx) return t;
        if (value.startsWith("column:")) {
          return { kind: "column", columnKey: value.slice("column:".length) };
        }
        return { kind: value as ImportTarget["kind"] };
      })
    );
  };

  const targetToValue = (target: ImportTarget) =>
    target.kind === "column" && target.columnKey ? `column:${target.columnKey}` : target.kind;

  return (
    <div className="p-5 rounded-2xl bg-surface border border-amber-500/30 shadow-md space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <FileUp size={16} className="text-amber-400" />
          <h4 className="text-xs font-bold uppercase tracking-wider text-foreground">
            Bulk import
          </h4>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="p-1 rounded-lg text-muted hover:text-foreground cursor-pointer"
          aria-label="Close bulk import"
        >
          <X size={15} />
        </button>
      </div>

      <textarea
        rows={6}
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder={PLACEHOLDER}
        className="w-full p-3 rounded-xl text-xs font-mono bg-elevated border border-border text-foreground placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-amber-500/50"
      />

      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={handleParse}
          disabled={!text.trim()}
          className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-xl text-xs font-bold bg-amber-500 text-slate-950 hover:bg-amber-400 disabled:opacity-40 cursor-pointer"
        >
          <Sparkles size={14} />
          <span>Parse</span>
        </button>
        {grid && (
          <span className="text-[11px] text-muted">
            Read {grid.rows.length} {grid.rows.length === 1 ? "row" : "rows"}, {grid.delimiterLabel}
            {grid.headers ? ", header row detected" : ""}.
          </span>
        )}
      </div>

      {grid && (
        <>
          {detectedPreset && (
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-xs">
              <div className="flex items-center gap-2 text-amber-400 font-medium">
                <Sparkles size={15} className="shrink-0" />
                <span>
                  Detected stats headers. Auto-applied <strong>{detectedPreset.label}</strong> columns for this table.
                </span>
              </div>
              <button
                type="button"
                onClick={() => {
                  setActiveColumns(columns);
                  setDetectedPreset(null);
                  if (grid) setTargets(guessTargets(grid, columns));
                }}
                className="text-[11px] underline text-muted hover:text-foreground cursor-pointer shrink-0"
              >
                Revert to original columns
              </button>
            </div>
          )}

          <div className="space-y-2">
            <span className="text-[11px] font-bold uppercase tracking-wider text-muted">
              Confirm what each column is
            </span>
            <div className="overflow-x-auto">
              <table className="text-left text-xs border-collapse">
                <tbody>
                  <tr>
                    {targets.map((target, idx) => (
                      <td key={idx} className="p-1 align-top">
                        <select
                          value={targetToValue(target)}
                          onChange={(e) => setTarget(idx, e.target.value)}
                          className={cn(
                            "w-full min-w-[9rem] px-2 py-1 rounded-lg text-[11px] font-semibold border",
                            target.kind === "ignore"
                              ? "bg-elevated/40 border-border text-muted"
                              : "bg-elevated border-amber-500/40 text-foreground"
                          )}
                          aria-label={`Mapping for column ${idx + 1}`}
                        >
                          {targetOptions.map((opt) => (
                            <option key={opt.value} value={opt.value}>
                              {opt.label}
                            </option>
                          ))}
                        </select>
                      </td>
                    ))}
                  </tr>
                  {grid.headers && (
                    <tr className="text-[10px] uppercase tracking-wider text-muted">
                      {grid.headers.map((header, idx) => (
                        <td key={idx} className="px-2 py-1 truncate max-w-[10rem]">
                          {header}
                        </td>
                      ))}
                    </tr>
                  )}
                  {grid.rows.slice(0, 4).map((cells, rowIdx) => (
                    <tr key={rowIdx} className="text-muted font-mono text-[11px]">
                      {cells.map((cell, colIdx) => (
                        <td key={colIdx} className="px-2 py-0.5 truncate max-w-[10rem]">
                          {cell || "—"}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="space-y-2">
            <span className="text-[11px] font-bold uppercase tracking-wider text-muted">
              Preview ({previewRows.length} {previewRows.length === 1 ? "row" : "rows"})
            </span>
            <div className="max-h-48 overflow-y-auto rounded-xl border border-border">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="sticky top-0 bg-elevated">
                  <tr className="text-[10px] font-bold uppercase tracking-wider text-muted">
                    <th className="py-1.5 px-2 w-12 text-center">Rank</th>
                    <th className="py-1.5 px-2">School</th>
                    {enterableColumns.map((col) => (
                      <th key={col.key} className="py-1.5 px-2 text-center">
                        {col.label}
                      </th>
                    ))}
                    <th className="py-1.5 px-2">Notes</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {previewRows.map((row, idx) => (
                    <tr key={idx}>
                      <td className="py-1 px-2 text-center font-mono">{row.rank}</td>
                      <td className="py-1 px-2 font-bold text-foreground">
                        {getSchoolName(row.team) || "—"}
                      </td>
                      {enterableColumns.map((col) => (
                        <td key={col.key} className="py-1 px-2 text-center font-mono">
                          {row.values[col.key] ?? "—"}
                        </td>
                      ))}
                      <td className="py-1 px-2 text-muted truncate max-w-[12rem]">
                        {row.details || "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-border/60">
            <div className="flex items-center gap-1.5 p-1 rounded-xl bg-elevated border border-border">
              {(["replace", "append"] as const).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setMode(m)}
                  className={cn(
                    "px-3 py-1 rounded-lg text-xs font-semibold transition-colors cursor-pointer",
                    mode === m
                      ? "bg-amber-500 text-slate-950"
                      : "text-muted hover:text-foreground"
                  )}
                >
                  {m === "replace" ? "Replace table" : "Add to table"}
                </button>
              ))}
            </div>

            <button
              type="button"
              onClick={() =>
                onApply(
                  previewRows,
                  mode,
                  activeColumns !== columns ? activeColumns : undefined
                )
              }
              disabled={previewRows.length === 0}
              className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-xl text-xs font-bold bg-amber-500 text-slate-950 hover:bg-amber-400 disabled:opacity-40 cursor-pointer"
            >
              <span>Apply to editor</span>
              <ArrowRight size={14} />
            </button>
          </div>

          <p className="text-[11px] text-muted">
            Nothing is saved yet — rows land in the editor below where you can correct them before
            saving.
          </p>
        </>
      )}
    </div>
  );
}
