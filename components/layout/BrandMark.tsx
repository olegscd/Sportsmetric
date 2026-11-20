import { cn } from "@/lib/utils";

/** Broadcast-inspired vector brand mark paired with crisp display typography. */
export function BrandMark({
  compact = false,
  className,
}: {
  compact?: boolean;
  className?: string;
}) {
  return (
    <span className={cn("inline-flex items-center gap-2.5 select-none", className)}>
      <span
        aria-hidden="true"
        className={cn(
          "relative flex shrink-0 items-center justify-center rounded-lg border border-primary/40 bg-gradient-to-br from-primary/25 via-primary/10 to-surface-2 shadow-[0_0_20px_-6px_rgba(239,68,68,0.55)]",
          compact ? "h-7 w-7" : "h-8 w-8"
        )}
      >
        <svg
          viewBox="0 0 24 24"
          className={compact ? "h-4 w-4" : "h-4.5 w-4.5"}
          fill="none"
          aria-hidden="true"
        >
          <rect x="3" y="13" width="4" height="8" rx="1" fill="currentColor" className="text-foreground/85" />
          <rect x="10" y="7" width="4" height="14" rx="1" fill="currentColor" className="text-foreground" />
          <rect x="17" y="3" width="4" height="18" rx="1" fill="currentColor" className="text-primary" />
        </svg>
      </span>
      <span
        className={cn(
          "font-display font-extrabold uppercase tracking-[0.06em] text-foreground",
          compact ? "text-lg leading-none" : "text-xl leading-none lg:text-[1.35rem]"
        )}
      >
        SPORTS<span className="text-primary">METRIC</span>
      </span>
    </span>
  );
}
