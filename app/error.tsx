"use client";

import { AlertTriangle, RefreshCw } from "lucide-react";
import Link from "next/link";
import { useEffect } from "react";

export default function ErrorPage({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  useEffect(() => {
    console.error("[Sportsmetric] Unhandled render error:", error);
  }, [error]);

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 px-6 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-live/15">
        <AlertTriangle size={22} className="text-live" aria-hidden="true" />
      </div>
      <div>
        <h1 className="text-lg font-bold text-foreground">Something went wrong</h1>
        <p className="mt-1 max-w-sm text-sm leading-relaxed text-muted">
          This page hit an unexpected error. Trying again usually resolves it.
        </p>
        {error.digest ? (
          <p className="mt-2 font-mono text-[11px] text-muted">Reference: {error.digest}</p>
        ) : null}
      </div>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => unstable_retry()}
          className="flex items-center gap-1.5 rounded-full bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
        >
          <RefreshCw size={15} aria-hidden="true" />
          Try again
        </button>
        <Link
          href="/"
          className="rounded-full border border-border px-4 py-2 text-sm font-semibold text-foreground transition-colors hover:bg-elevated focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
        >
          Match Center
        </Link>
      </div>
    </div>
  );
}
