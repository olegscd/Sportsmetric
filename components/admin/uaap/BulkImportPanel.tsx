"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { Notice } from "@/components/ui/Notice";
import { TableShell } from "@/components/ui/Table";
import { ArrowRight, FileUp, Sparkles, X } from "lucide-react";
import {
  applyImport,
  detectColumnPreset,
  extractAwardsFromText,
  extractStandingsFromReport,
  guessTargets,
  parsePastedTable,
  parsePlacementLabel,
  unmatchedSchoolLabels,
  type ExtractedAwards,
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

const PLACEHOLDER = `Paste a spreadsheet, CSV, or the annual-report scan for this division. For example:

1  FEU   12-2  Champion
2  UST   11-3  Runner-up
3  UP     8-6`;

function looksLikeReportScan(text: string): boolean {
  const lines = text.split(/\r?\n/).length;
  return (
    lines > 6 &&
    (/FINAL STANDING/i.test(text) ||
      /Most Valuable Player/i.test(text) ||
      (text.includes("|") && text.includes("---")))
  );
}

export function BulkImportPanel({
  columns,
  division,
  initialText,
  onApply,
  onClose,
  onExtractedAwards,
}: {
  columns: UAAPColumn[];
  division?: string;
  initialText?: string;
  onApply: (rows: UAAPRow[], mode: "replace" | "append", newColumns?: UAAPColumn[]) => void;
  onClose: () => void;
  onExtractedAwards?: (awards: ExtractedAwards) => void;
}) {
  const [text, setText] = useState(initialText ?? "");
  const [grid, setGrid] = useState<ParsedGrid | null>(null);
  const [activeColumns, setActiveColumns] = useState<UAAPColumn[]>(columns);
  const [detectedPreset, setDetectedPreset] = useState<UAAPColumnPreset | null>(null);
  const [targets, setTargets] = useState<ImportTarget[]>([]);
  const [mode, setMode] = useState<"replace" | "append">("replace");
  const [extractedAwards, setExtractedAwards] = useState<ExtractedAwards | null>(null);
  const [extractNote, setExtractNote] = useState<string>("");
  const fileRef = useRef<HTMLInputElement>(null);
  const seeded = useRef(false);

  /* eslint-disable react-hooks/set-state-in-effect -- the editable column
     buffer intentionally mirrors the `columns` prop when the parent replaces
     the selected division. */
  useEffect(() => {
    setActiveColumns(columns);
    setDetectedPreset(null);
  }, [columns]);
  /* eslint-enable react-hooks/set-state-in-effect */

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

  const runParse = (raw: string) => {
    const source = raw.trim();
    if (!source) {
      setGrid(null);
      setTargets([]);
      setDetectedPreset(null);
      setExtractedAwards(null);
      setExtractNote("");
      return;
    }

    let toParse = source;
    let awards = extractAwardsFromText(source);
    let note = "";

    if (looksLikeReportScan(source)) {
      const extracted = extractStandingsFromReport(source, division);
      toParse = extracted.paste;
      awards = extracted.awards;
      const bits = [extracted.delimiterLabel];
      if (extracted.usedDivisionSlice) bits.push(`limited to ${division}`);
      if (extracted.tableCount > 1) bits.push(`${extracted.tableCount} tables in the scan`);
      note = bits.join(" · ");
    }

    const parsed = parsePastedTable(toParse);
    if (parsed.rows.length === 0) {
      setGrid(null);
      setTargets([]);
      setDetectedPreset(null);
      setExtractedAwards(awards.mvp || awards.rookie_of_the_year ? awards : null);
      setExtractNote(note);
      return;
    }

    let colsToUse = activeColumns;
    let foundPreset = detectColumnPreset(parsed.headers);
    const looksLikePlacement =
      parsed.rows.length > 0 &&
      parsed.rows.every((row) => row.some((cell) => parsePlacementLabel(cell)));
    if (!foundPreset && looksLikePlacement) {
      foundPreset = COLUMN_PRESETS.find((p) => p.id === "placement") ?? null;
    }
    const missingPresetColumns =
      foundPreset &&
      foundPreset.columns.some(
        (col) => !col.derived && !colsToUse.some((existing) => existing.key === col.key)
      );

    if (
      foundPreset &&
      (colsToUse.length === 0 || missingPresetColumns || foundPreset.id === "placement")
    ) {
      colsToUse = foundPreset.columns.map((c) => ({ ...c }));
      setActiveColumns(colsToUse);
      setDetectedPreset(foundPreset);
    }

    setGrid(parsed);
    setTargets(guessTargets(parsed, colsToUse));
    setExtractedAwards(awards.mvp || awards.rookie_of_the_year ? awards : null);
    setExtractNote(note || parsed.delimiterLabel);
  };

  /* eslint-disable react-hooks/set-state-in-effect -- one-time hydration of
     the paste buffer from the `initialText` prop. */
  useEffect(() => {
    if (seeded.current) return;
    if (!initialText?.trim()) return;
    seeded.current = true;
    setText(initialText);
    runParse(initialText);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialText]);
  /* eslint-enable react-hooks/set-state-in-effect */

  const previewRows = useMemo(() => {
    if (!grid) return [];
    return applyImport(grid, targets, activeColumns);
  }, [grid, targets, activeColumns]);

  const unmatched = useMemo(() => unmatchedSchoolLabels(previewRows), [previewRows]);

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

  const handleFile = async (file: File) => {
    const raw = await file.text();
    setText(raw);
    runParse(raw);
  };

  return (
    <div className="space-y-4 rounded-card border border-archive/30 bg-surface p-4 shadow-card sm:p-5">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <FileUp size={16} className="text-archive" aria-hidden="true" />
          <h4 className="text-2xs font-bold uppercase tracking-wider text-foreground">
            Bulk import
          </h4>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="inline-flex h-10 w-10 cursor-pointer items-center justify-center rounded-control text-muted transition-colors hover:bg-elevated hover:text-foreground"
          aria-label="Close bulk import"
        >
          <X size={16} aria-hidden="true" />
        </button>
      </div>

      <div className="space-y-1.5">
        <label htmlFor="bulk-import-rows" className="sr-only">
          Bulk import rows
        </label>
        <textarea
          id="bulk-import-rows"
          rows={6}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onPaste={(e) => {
            const pasted = e.clipboardData.getData("text");
            if (!pasted.trim()) return;
            requestAnimationFrame(() => runParse(pasted));
          }}
          onDrop={(e) => {
            const file = e.dataTransfer.files?.[0];
            if (!file) return;
            e.preventDefault();
            void handleFile(file);
          }}
          placeholder={PLACEHOLDER}
          className="w-full rounded-control border border-border bg-surface-2 p-3 font-mono text-xs text-foreground placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-archive/40"
        />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => runParse(text)}
          disabled={!text.trim()}
          className="inline-flex min-h-11 cursor-pointer items-center gap-1.5 rounded-control bg-archive px-4 text-xs font-bold text-bg transition-colors hover:bg-archive/90 disabled:opacity-40"
        >
          <Sparkles size={14} aria-hidden="true" />
          <span>Parse</span>
        </button>
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          className="inline-flex min-h-11 cursor-pointer items-center gap-1.5 rounded-control border border-border bg-surface-2 px-3 text-xs font-semibold text-foreground transition-colors hover:bg-elevated"
        >
          <FileUp size={14} aria-hidden="true" />
          <span>Upload CSV / MD</span>
        </button>
        <input
          ref={fileRef}
          type="file"
          accept=".csv,.tsv,.txt,.md"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) void handleFile(file);
            e.target.value = "";
          }}
        />
        {grid && (
          <span className="text-2xs text-muted">
            Read {grid.rows.length} {grid.rows.length === 1 ? "row" : "rows"}
            {extractNote ? ` · ${extractNote}` : ` · ${grid.delimiterLabel}`}
            {grid.headers ? " · header row detected" : ""}.
          </span>
        )}
      </div>

      {extractedAwards && onExtractedAwards && (
        <Notice
          tone="info"
          action={
            <button
              type="button"
              onClick={() => onExtractedAwards(extractedAwards)}
              className="inline-flex min-h-10 cursor-pointer items-center text-2xs font-bold text-info hover:underline"
            >
              Fill awards fields
            </button>
          }
        >
          <p className="text-xs">
            Found{" "}
            {[
              extractedAwards.mvp ? `MVP ${extractedAwards.mvp.player}` : null,
              extractedAwards.rookie_of_the_year
                ? `Rookie ${extractedAwards.rookie_of_the_year.player}`
                : null,
            ]
              .filter(Boolean)
              .join(" · ")}
            .
          </p>
        </Notice>
      )}

      {grid && (
        <>
          {detectedPreset && (
            <div className="flex flex-col justify-between gap-2 rounded-control border border-archive/30 bg-archive/10 p-3 text-xs sm:flex-row sm:items-center">
              <div className="flex items-center gap-2 font-medium text-archive">
                <Sparkles size={15} className="shrink-0" aria-hidden="true" />
                <span>
                  Detected stats headers. Auto-applied <strong>{detectedPreset.label}</strong> columns
                  for this table.
                </span>
              </div>
              <button
                type="button"
                onClick={() => {
                  setActiveColumns(columns);
                  setDetectedPreset(null);
                  if (grid) setTargets(guessTargets(grid, columns));
                }}
                className="inline-flex min-h-10 shrink-0 cursor-pointer items-center text-2xs text-muted underline hover:text-foreground"
              >
                Revert to original columns
              </button>
            </div>
          )}

          <div className="space-y-2">
            <span className="text-2xs font-bold uppercase tracking-wider text-muted">
              Confirm what each column is
            </span>
            <div className="h-scroll overflow-x-auto">
              <table className="border-collapse text-left text-xs">
                <tbody>
                  <tr>
                    {targets.map((target, idx) => (
                      <td key={idx} className="align-top p-1">
                        <select
                          value={targetToValue(target)}
                          onChange={(e) => setTarget(idx, e.target.value)}
                          className={cn(
                            "min-h-10 w-full min-w-36 rounded-control border px-2 text-2xs font-semibold",
                            target.kind === "ignore"
                              ? "border-border bg-surface-2/60 text-muted"
                              : "border-archive/40 bg-surface-2 text-foreground"
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
                    <tr className="text-3xs uppercase tracking-wider text-muted">
                      {grid.headers.map((header, idx) => (
                        <td key={idx} className="max-w-40 truncate px-2 py-1">
                          {header}
                        </td>
                      ))}
                    </tr>
                  )}
                  {grid.rows.slice(0, 4).map((cells, rowIdx) => (
                    <tr key={rowIdx} className="font-mono text-2xs text-muted">
                      {cells.map((cell, colIdx) => (
                        <td key={colIdx} className="max-w-40 truncate px-2 py-0.5">
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
            <span className="text-2xs font-bold uppercase tracking-wider text-muted">
              Preview ({previewRows.length} {previewRows.length === 1 ? "row" : "rows"})
            </span>
            {unmatched.length > 0 && (
              <p className="text-2xs text-archive">
                Unrecognised school
                {unmatched.length === 1 ? "" : "s"}: {unmatched.join(", ")}. Fix the mapping or the
                name before saving.
              </p>
            )}
            <TableShell className="max-h-48 overflow-y-auto">
              <table className="w-full border-collapse text-left text-xs">
                <thead className="sticky top-0 z-10 bg-surface-2">
                  <tr>
                    <th scope="col" className="w-12 px-2 py-2 text-center text-2xs font-semibold uppercase tracking-wider text-muted">Rank</th>
                    <th scope="col" className="px-2 py-2 text-2xs font-semibold uppercase tracking-wider text-muted">School</th>
                    {enterableColumns.map((col) => (
                      <th key={col.key} scope="col" className="px-2 py-2 text-center text-2xs font-semibold uppercase tracking-wider text-muted">
                        {col.label}
                      </th>
                    ))}
                    <th scope="col" className="px-2 py-2 text-2xs font-semibold uppercase tracking-wider text-muted">Notes</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {previewRows.map((row, idx) => (
                    <tr key={idx}>
                      <td className="px-2 py-1.5 text-center font-mono">{row.rank}</td>
                      <td className="px-2 py-1.5 font-bold text-foreground">
                        {getSchoolName(row.team) || "—"}
                      </td>
                      {enterableColumns.map((col) => (
                        <td key={col.key} className="px-2 py-1.5 text-center font-mono">
                          {row.values[col.key] ?? "—"}
                        </td>
                      ))}
                      <td className="max-w-48 truncate px-2 py-1.5 text-muted">
                        {row.details || "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </TableShell>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border/60 pt-2">
            <div className="flex items-center gap-1.5 rounded-control border border-border bg-surface-2 p-1">
              {(["replace", "append"] as const).map((m) => (
                <button
                  key={m}
                  type="button"
                  aria-pressed={mode === m}
                  onClick={() => setMode(m)}
                  className={cn(
                    "min-h-10 cursor-pointer rounded-control px-3 text-xs font-semibold transition-colors",
                    mode === m
                      ? "bg-archive text-bg"
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
              className="inline-flex min-h-11 cursor-pointer items-center gap-1.5 rounded-control bg-archive px-4 text-xs font-bold text-bg transition-colors hover:bg-archive/90 disabled:opacity-40"
            >
              <span>Apply to editor</span>
              <ArrowRight size={14} aria-hidden="true" />
            </button>
          </div>

          <p className="text-2xs text-muted">
            Nothing is saved yet — rows land in the editor below where you can correct them before
            saving.
          </p>
        </>
      )}
    </div>
  );
}
