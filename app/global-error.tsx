"use client";

import "./globals.css";
import { buttonClasses } from "@/components/ui/Button";

export default function GlobalError({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  return (
    // global-error replaces the root layout, so it must supply html and body.
    <html lang="en">
      <body className="flex min-h-dvh items-center justify-center bg-bg px-6 text-center">
        <div className="w-full max-w-md rounded-panel border border-border bg-surface p-6 shadow-card">
          <h1 className="text-lg font-bold text-foreground">Sportsmetric hit an error</h1>
          <p className="mt-1 text-sm leading-relaxed text-muted">
            The application failed to render. Reload to try again.
          </p>
          {error.digest ? (
            <p className="mt-2 font-mono text-2xs text-muted">Reference: {error.digest}</p>
          ) : null}
          <button
            type="button"
            onClick={() => unstable_retry()}
            className={buttonClasses({ variant: "primary", size: "md", className: "mt-5" })}
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}
