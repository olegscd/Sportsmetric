import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/utils";

export type BadgeTone =
  | "neutral"
  | "primary"
  | "live"
  | "success"
  | "negative"
  | "archive"
  | "info"
  | "outline";

const toneClasses: Record<BadgeTone, string> = {
  neutral: "border-border bg-elevated/90 text-muted",
  primary: "border-primary/35 bg-primary/15 text-primary",
  live: "border-live/45 bg-live/15 text-live shadow-[0_0_12px_-4px_rgba(251,113,133,0.45)]",
  success: "border-positive/35 bg-positive/12 text-positive",
  negative: "border-negative/35 bg-negative/12 text-negative",
  archive: "border-archive/35 bg-archive/12 text-archive",
  info: "border-info/35 bg-info/12 text-info",
  outline: "border-border/90 bg-surface-2/70 text-muted",
};

const sizeClasses = {
  sm: "px-2 py-0.5 text-3xs",
  md: "px-2.5 py-1 text-2xs",
} as const;

export function Badge({
  tone = "neutral",
  size = "sm",
  dot = false,
  icon,
  className,
  children,
  ...props
}: HTMLAttributes<HTMLSpanElement> & {
  tone?: BadgeTone;
  size?: keyof typeof sizeClasses;
  dot?: boolean;
  icon?: ReactNode;
}) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center gap-1.5 rounded-full border font-bold uppercase tracking-wide",
        toneClasses[tone],
        sizeClasses[size],
        className
      )}
      {...props}
    >
      {dot ? (
        <span
          className={cn(
            "h-1.5 w-1.5 rounded-full bg-current",
            tone === "live" && "animate-live-pulse"
          )}
          aria-hidden="true"
        />
      ) : null}
      {icon}
      {children}
    </span>
  );
}
