"use client";

import { cn } from "@/lib/utils";
import { AlertTriangle, RefreshCw } from "lucide-react";

/**
 * Surfaces a data-loading failure. The context has always tracked an `error`
 * string, but nothing on the public site rendered it -- a failed fetch looked
 * identical to "no games today".
 */
export function ErrorNotice({
  message,
  onRetry,
  className,
}: {
  message: string;
  onRetry?: () => void;
  className?: string;
}) {
  return (
    <div
      role="alert"
      className={cn(
        "flex flex-col items-start gap-3 rounded-2xl border border-live/40 bg-live/10 px-4 py-4 sm:flex-row sm:items-center",
        className
      )}
    >
      <AlertTriangle size={18} className="shrink-0 text-live" aria-hidden="true" />
      <div className="flex-1">
        <p className="text-sm font-semibold text-foreground">Couldn&apos;t load this data</p>
        <p className="mt-0.5 text-xs leading-relaxed text-muted">{message}</p>
      </div>
      {onRetry ? (
        <button
          type="button"
          onClick={onRetry}
          className="flex shrink-0 items-center gap-1.5 rounded-full border border-border bg-surface px-3 py-1.5 text-xs font-semibold text-foreground transition-colors hover:bg-elevated focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
        >
          <RefreshCw size={13} aria-hidden="true" />
          Try again
        </button>
      ) : null}
    </div>
  );
}
