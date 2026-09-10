"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
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
        <span className="text-[11px] font-bold uppercase tracking-wider text-muted">
          Start from a preset
        </span>
        <div className="flex flex-wrap gap-2">
          {COLUMN_PRESETS.map((preset) => (
            <button
              key={preset.id}
              type="button"
              onClick={() => applyPreset(preset.columns)}
              title={preset.description}
              className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-elevated border border-border text-foreground hover:border-amber-500/50 hover:text-amber-400 transition-colors cursor-pointer"
            >
              {preset.label}
            </button>
          ))}
        </div>
        <p className="text-[11px] text-muted">
          Presets replace the current columns. Any entered values for columns that still exist are
          kept.
        </p>
      </div>

      <div className="space-y-2">
        <span className="text-[11px] font-bold uppercase tracking-wider text-muted">
          Stat columns ({columns.length})
        </span>

        {columns.length === 0 ? (
          <div className="p-4 rounded-xl bg-elevated/40 border border-dashed border-border text-xs text-muted">
            No stat columns. The table will show rank, school, and a result note only — which is the
            right shape for seasons that recorded placements without numbers.
          </div>
        ) : (
          <div className="space-y-2">
            {columns.map((col, idx) => (
              <div
                key={col.key}
                className="flex flex-wrap items-center gap-2 p-2.5 rounded-xl bg-elevated/40 border border-border"
              >
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => moveColumn(idx, -1)}
                    disabled={idx === 0}
                    className="p-1 rounded text-muted hover:text-foreground disabled:opacity-30 cursor-pointer"
                    aria-label={`Move ${col.label} left`}
                  >
                    <ArrowLeft size={13} />
                  </button>
                  <button
                    type="button"
                    onClick={() => moveColumn(idx, 1)}
                    disabled={idx === columns.length - 1}
                    className="p-1 rounded text-muted hover:text-foreground disabled:opacity-30 cursor-pointer"
                    aria-label={`Move ${col.label} right`}
                  >
                    <ArrowRight size={13} />
                  </button>
                </div>

                <input
                  type="text"
                  value={col.label}
                  onChange={(e) => updateColumn(idx, { label: e.target.value })}
                  className="w-28 px-2 py-1 rounded-lg text-xs font-semibold bg-surface border border-border text-foreground"
                  aria-label="Column label"
                />

                {col.derived ? (
                  <span className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-semibold bg-amber-500/15 text-amber-400 border border-amber-500/30">
                    <Calculator size={12} />
                    Auto from W and L
                  </span>
                ) : (
                  <select
                    value={col.type}
                    onChange={(e) => updateColumn(idx, { type: e.target.value as UAAPColumnType })}
                    className="px-2 py-1 rounded-lg text-xs bg-surface border border-border text-foreground"
                    aria-label="Column type"
                  >
                    {Object.entries(TYPE_LABELS).map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                )}

                <code className="text-[10px] text-muted font-mono px-1.5 py-0.5 rounded bg-surface border border-border">
                  {col.key}
                </code>

                <button
                  type="button"
                  onClick={() => removeColumn(idx)}
                  className="ml-auto p-1.5 rounded-lg text-rose-400 hover:bg-rose-500/10 cursor-pointer"
                  aria-label={`Remove ${col.label}`}
                >
                  <Trash2 size={13} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="flex flex-wrap items-end gap-2 pt-2 border-t border-border/60">
        <div>
          <label className="text-[11px] font-bold uppercase tracking-wider text-muted block mb-1">
            Add a column
          </label>
          <input
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
            className="w-52 px-3 py-1.5 rounded-xl text-xs bg-elevated border border-border text-foreground placeholder:text-muted"
          />
        </div>

        <select
          value={newType}
          onChange={(e) => setNewType(e.target.value as UAAPColumnType)}
          className="px-2.5 py-1.5 rounded-xl text-xs bg-elevated border border-border text-foreground"
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
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-elevated border border-border text-foreground hover:bg-elevated/70 disabled:opacity-40 cursor-pointer"
        >
          <Plus size={14} />
          <span>Add</span>
        </button>

        {hasWinLoss && !hasWinPct && (
          <button
            type="button"
            onClick={() => onChange([...columns, { ...WIN_PCT_COLUMN }])}
            className={cn(
              "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold cursor-pointer",
              "bg-amber-500/15 text-amber-400 border border-amber-500/30 hover:bg-amber-500/25"
            )}
          >
            <Calculator size={14} />
            <span>Add auto win %</span>
          </button>
        )}
      </div>
    </div>
  );
}
