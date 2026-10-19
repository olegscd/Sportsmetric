"use client";

import { cn } from "@/lib/utils";
import { Search, X } from "lucide-react";

export function SearchInput({
  value,
  onChange,
  placeholder = "Search…",
  label,
  className,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  label: string;
  className?: string;
}) {
  return (
    <div className={cn("relative min-w-0", className)}>
      <Search
        size={16}
        aria-hidden="true"
        className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted"
      />
      <input
        type="search"
        inputMode="search"
        aria-label={label}
        value={value}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
        className="min-h-11 w-full min-w-0 rounded-full border border-border bg-elevated pl-9 pr-11 text-base text-foreground placeholder:text-muted/70 transition-colors duration-150 ease-standard hover:border-border-strong focus:border-primary/70 focus:outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary sm:text-sm"
      />
      {value ? (
        <button
          type="button"
          onClick={() => onChange("")}
          aria-label="Clear search"
          className="absolute right-0.5 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full text-muted transition-colors hover:bg-surface-2 hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-primary"
        >
          <X size={15} aria-hidden="true" />
        </button>
      ) : null}
    </div>
  );
}
