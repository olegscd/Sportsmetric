"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/Badge";
import { ArrowLeft, ArrowRight, Calculator, Plus, Trash2 } from "lucide-react";
import {
  COLUMN_PRESETS,
  WIN_PCT_COLUMN,
  slugifyColumnKey,
  type UAAPColumn,
  type UAAPColumnType,
} from "@/lib/uaap-schema";

const TYPE_LABELS: Record<UAAPColumnType, string> = {
  number: "Number",
  decimal: "Decimal",
  text: "Text",
};

export function ColumnEditor({
  columns,
  onChange,
}: {
  columns: UAAPColumn[];
  onChange: (columns: UAAPColumn[]) => void;
}) {
  const [newLabel, setNewLabel] = useState("");
  const [newType, setNewType] = useState<UAAPColumnType>("number");

  const applyPreset = (presetColumns: UAAPColumn[]) => {
    onChange(presetColumns.map((c) => ({ ...c })));
  };

  const addColumn = () => {
    const label = newLabel.trim();
    if (!label) return;
    const key = slugifyColumnKey(label, columns.map((c) => c.key));
    onChange([...columns, { key, label, type: newType }]);
    setNewLabel("");
  };

  const updateColumn = (idx: number, patch: Partial<UAAPColumn>) => {
    onChange(columns.map((col, i) => (i === idx ? { ...col, ...patch } : col)));
  };

  const removeColumn = (idx: number) => {
    onChange(columns.filter((_, i) => i !== idx));
  };

  const moveColumn = (idx: number, dir: -1 | 1) => {
    const target = idx + dir;
    if (target < 0 || target >= columns.length) return;
    const next = [...columns];
    [next[idx], next[target]] = [next[target], next[idx]];
    onChange(next);
  };

  const hasWinLoss =
    columns.some((c) => c.key === "wins") && columns.some((c) => c.key === "losses");
  const hasWinPct = columns.some((c) => c.derived?.kind === "winPct");

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <span className="text-2xs font-bold uppercase tracking-wider text-muted">
          Start from a preset
        </span>
        <div className="flex flex-wrap gap-2">
          {COLUMN_PRESETS.map((preset) => (
            <button
              key={preset.id}
              type="button"
              onClick={() => applyPreset(preset.columns)}
              title={preset.description}
              className="min-h-10 cursor-pointer rounded-control border border-border bg-surface-2 px-3 text-2xs font-semibold text-foreground transition-colors hover:border-archive/50 hover:text-archive"
            >
              {preset.label}
            </button>
          ))}
        </div>
        <p className="text-2xs text-muted">
          Presets replace the current columns. Any entered values for columns that still exist are
          kept.
        </p>
      </div>

      <div className="space-y-2">
        <span className="text-2xs font-bold uppercase tracking-wider text-muted">
          Stat columns ({columns.length})
        </span>

        {columns.length === 0 ? (
          <div className="rounded-control border border-dashed border-border bg-surface-2/60 p-4 text-xs text-muted">
            No stat columns. The table will show rank, school, and a result note only — which is the
            right shape for seasons that recorded placements without numbers.
          </div>
        ) : (
          <div className="space-y-2">
            {columns.map((col, idx) => (
              <div
                key={col.key}
                className="flex flex-wrap items-center gap-2 rounded-control border border-border bg-surface-2/60 p-2.5"
              >
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => moveColumn(idx, -1)}
                    disabled={idx === 0}
                    className="inline-flex h-10 w-10 cursor-pointer items-center justify-center rounded-control text-muted transition-colors hover:bg-elevated hover:text-foreground disabled:opacity-30"
                    aria-label={`Move ${col.label} left`}
                  >
                    <ArrowLeft size={14} aria-hidden="true" />
                  </button>
                  <button
                    type="button"
                    onClick={() => moveColumn(idx, 1)}
                    disabled={idx === columns.length - 1}
                    className="inline-flex h-10 w-10 cursor-pointer items-center justify-center rounded-control text-muted transition-colors hover:bg-elevated hover:text-foreground disabled:opacity-30"
                    aria-label={`Move ${col.label} right`}
                  >
                    <ArrowRight size={14} aria-hidden="true" />
                  </button>
                </div>

                <input
                  type="text"
                  value={col.label}
                  onChange={(e) => updateColumn(idx, { label: e.target.value })}
                  className="min-h-10 w-32 rounded-control border border-border bg-surface px-2 text-xs font-semibold text-foreground focus:outline-none focus:ring-2 focus:ring-archive/40"
                  aria-label="Column label"
                />

                {col.derived ? (
                  <Badge tone="archive" size="sm" icon={<Calculator size={12} aria-hidden="true" />}>
                    Auto from W and L
                  </Badge>
                ) : (
                  <select
                    value={col.type}
                    onChange={(e) => updateColumn(idx, { type: e.target.value as UAAPColumnType })}
                    className="min-h-10 rounded-control border border-border bg-surface px-2 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-archive/40"
                    aria-label="Column type"
                  >
                    {Object.entries(TYPE_LABELS).map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                )}

                <code className="rounded border border-border bg-surface px-1.5 py-0.5 font-mono text-3xs text-muted">
                  {col.key}
                </code>

                <button
                  type="button"
                  onClick={() => removeColumn(idx)}
                  className="ml-auto inline-flex h-10 w-10 cursor-pointer items-center justify-center rounded-control text-negative transition-colors hover:bg-negative/10"
                  aria-label={`Remove ${col.label}`}
                >
                  <Trash2 size={14} aria-hidden="true" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="flex flex-wrap items-end gap-2 border-t border-border/60 pt-2">
        <div>
          <label htmlFor="uaap-new-column" className="mb-1 block text-2xs font-bold uppercase tracking-wider text-muted">
            Add a column
          </label>
          <input
            id="uaap-new-column"
            type="text"
            value={newLabel}
            onChange={(e) => setNewLabel(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                addColumn();
              }
            }}
            placeholder="e.g. Sets Won, Goal Diff, Time"
            className="min-h-11 w-52 rounded-control border border-border bg-surface-2 px-3 text-xs text-foreground placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-archive/40"
          />
        </div>

        <select
          value={newType}
          onChange={(e) => setNewType(e.target.value as UAAPColumnType)}
          className="min-h-11 rounded-control border border-border bg-surface-2 px-2.5 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-archive/40"
          aria-label="New column type"
        >
          {Object.entries(TYPE_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>

        <button
          type="button"
          onClick={addColumn}
          disabled={!newLabel.trim()}
          className="inline-flex min-h-11 cursor-pointer items-center gap-1.5 rounded-control border border-border bg-surface-2 px-3 text-xs font-bold text-foreground transition-colors hover:bg-elevated disabled:opacity-40"
        >
          <Plus size={14} aria-hidden="true" />
          <span>Add</span>
        </button>

        {hasWinLoss && !hasWinPct && (
          <button
            type="button"
            onClick={() => onChange([...columns, { ...WIN_PCT_COLUMN }])}
            className={cn(
              "inline-flex min-h-11 cursor-pointer items-center gap-1.5 rounded-control px-3 text-xs font-bold",
              "border border-archive/30 bg-archive/15 text-archive transition-colors hover:bg-archive/25"
            )}
          >
            <Calculator size={14} aria-hidden="true" />
            <span>Add auto win %</span>
          </button>
        )}
      </div>
    </div>
  );
}
