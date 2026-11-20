import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/utils";

export type StatTileTone = "default" | "primary" | "live" | "positive" | "negative" | "archive" | "info";

const toneClasses: Record<StatTileTone, string> = {
  default: "text-foreground",
  primary: "text-primary",
  live: "text-live",
  positive: "text-positive",
  negative: "text-negative",
  archive: "text-archive",
  info: "text-info",
};

const sizeClasses = {
  sm: "text-base",
  md: "text-2xl",
  lg: "text-3xl",
} as const;

export function StatTile({
  label,
  value,
  detail,
  tone = "default",
  badge,
  size = "md",
  className,
  ...props
}: HTMLAttributes<HTMLDivElement> & {
  label: ReactNode;
  value: ReactNode;
  detail?: ReactNode;
  tone?: StatTileTone;
  badge?: ReactNode;
  size?: keyof typeof sizeClasses;
}) {
  return (
    <div
      className={cn(
        "flex min-w-0 flex-col gap-1 rounded-card border border-border/80 bg-surface-2/85 p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]",
        className
      )}
      {...props}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="truncate text-2xs font-semibold uppercase tracking-wide text-muted">
          {label}
        </span>
        {badge}
      </div>
      <span
        className={cn(
          "font-display font-extrabold tabular-nums tracking-tight leading-none",
          sizeClasses[size],
          toneClasses[tone]
        )}
      >
        {value}
      </span>
      {detail ? <span className="truncate text-2xs text-muted">{detail}</span> : null}
    </div>
  );
}
