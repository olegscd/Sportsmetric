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
  sm: "text-sm",
  md: "text-xl",
  lg: "text-2xl",
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
        "flex min-w-0 flex-col gap-1 rounded-card border border-border/70 bg-elevated/60 p-3",
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
          "font-extrabold tabular-nums tracking-tight",
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
