"use client";

import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

export function FilterChip({
  selected,
  onClick,
  children,
}: {
  selected: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={cn(
        "inline-flex min-h-10 shrink-0 items-center gap-2 rounded-full border px-4 py-2 text-xs font-semibold transition-all duration-150 ease-standard focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary",
        selected
          ? "border-primary/65 bg-primary/15 text-foreground shadow-[0_0_0_1px_rgba(239,68,68,0.2),0_6px_16px_-10px_rgba(239,68,68,0.6)]"
          : "border-border/85 bg-surface/75 text-muted hover:border-border-strong hover:bg-elevated/70 hover:text-foreground"
      )}
    >
      {children}
    </button>
  );
}

export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  className,
}: {
  options: readonly { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
  className?: string;
}) {
  return (
    <div
      role="group"
      className={cn(
        "h-scroll flex items-center gap-1 overflow-x-auto rounded-control border border-border/90 bg-surface-2/95 p-1 shadow-inner",
        className
      )}
    >
      {options.map((option) => {
        const selected = value === option.value;
        return (
          <button
            key={option.value}
            type="button"
            aria-pressed={selected}
            onClick={() => onChange(option.value)}
            className={cn(
              "min-h-9 flex-1 whitespace-nowrap rounded-lg px-3 py-1.5 text-xs font-semibold transition-all duration-150 ease-standard focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary",
              selected
                ? "bg-elevated text-foreground shadow-sm ring-1 ring-border-strong/80"
                : "text-muted hover:text-foreground"
            )}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
