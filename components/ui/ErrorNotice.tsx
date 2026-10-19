"use client";

import { cn } from "@/lib/utils";
import { RefreshCw } from "lucide-react";
import { Notice } from "@/components/ui/Notice";

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
    <Notice
      tone="error"
      title="Couldn't load this data"
      className={cn("sm:items-center", className)}
      action={
        onRetry ? (
          <button
            type="button"
            onClick={onRetry}
            className="inline-flex min-h-10 shrink-0 items-center gap-1.5 rounded-control border border-negative/30 bg-surface px-3 py-1.5 text-xs font-semibold text-foreground transition-colors hover:border-negative/50 hover:bg-negative/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
          >
            <RefreshCw size={13} aria-hidden="true" />
            Try again
          </button>
        ) : undefined
      }
    >
      {message}
    </Notice>
  );
}
