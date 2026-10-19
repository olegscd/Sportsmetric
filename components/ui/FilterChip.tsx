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
        "min-h-11 shrink-0 rounded-full border px-4 py-2 text-xs font-semibold transition-colors duration-150 ease-standard focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary",
        selected
          ? "border-primary/60 bg-primary/15 text-foreground shadow-sm"
          : "border-border bg-surface/40 text-muted hover:border-primary/40 hover:text-foreground"
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
        "h-scroll flex items-center gap-1 overflow-x-auto rounded-control border border-border bg-surface-2 p-1",
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
              "min-h-10 flex-1 whitespace-nowrap rounded-lg px-3 py-2 text-xs font-semibold transition-colors duration-150 ease-standard focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary",
              selected
                ? "bg-elevated text-foreground shadow-sm ring-1 ring-border-strong"
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
