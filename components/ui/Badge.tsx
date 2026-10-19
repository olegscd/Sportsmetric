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
  neutral: "border-border bg-elevated text-muted",
  primary: "border-primary/30 bg-primary/15 text-primary",
  live: "border-live/40 bg-live/15 text-live",
  success: "border-positive/30 bg-positive/15 text-positive",
  negative: "border-negative/30 bg-negative/15 text-negative",
  archive: "border-archive/30 bg-archive/15 text-archive",
  info: "border-info/30 bg-info/15 text-info",
  outline: "border-border bg-transparent text-muted",
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
