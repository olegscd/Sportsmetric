import { cn } from "@/lib/utils";

/** Multi-layered vector arena crest + telemetry pulse brand mark. */
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
          "relative flex shrink-0 items-center justify-center overflow-hidden rounded-xl border border-primary/50 bg-gradient-to-br from-primary/30 via-elevated to-surface-2 shadow-[0_0_24px_-6px_rgba(239,68,68,0.65)]",
          compact ? "h-8 w-8" : "h-9 w-9"
        )}
      >
        <svg
          viewBox="0 0 28 28"
          className={compact ? "h-5 w-5" : "h-5.5 w-5.5"}
          fill="none"
          aria-hidden="true"
        >
          {/* Arena crest frame */}
          <path
            d="M14 2.5 L24 7 V15 C24 20.4 19.6 24.3 14 25.8 C8.4 24.3 4 20.4 4 15 V7 Z"
            stroke="rgba(255,255,255,0.22)"
            strokeWidth="1.2"
            fill="rgba(8,12,22,0.72)"
          />
          {/* Court telemetry bars */}
          <rect x="7.5" y="15" width="3" height="6" rx="0.9" fill="#94a3b8" />
          <rect x="12.5" y="10.5" width="3" height="10.5" rx="0.9" fill="#f8fafc" />
          <rect x="17.5" y="6.8" width="3" height="14.2" rx="0.9" fill="#ef4444" />
          <circle cx="19" cy="5" r="1.15" fill="#fb7185" />
        </svg>
      </span>
      <span className="flex flex-col">
        <span
          className={cn(
            "font-display font-extrabold uppercase tracking-[0.06em] text-foreground",
            compact ? "text-lg leading-none" : "text-xl leading-none lg:text-[1.35rem]"
          )}
        >
          SPORTS<span className="text-primary">METRIC</span>
        </span>
        {!compact ? (
          <span className="mt-0.5 hidden text-[9px] font-bold uppercase tracking-[0.22em] text-muted/85 lg:block">
            PH Sports Telemetry
          </span>
        ) : null}
      </span>
    </span>
  );
}
