"use client";

import "./globals.css";

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
        <div className="flex flex-col items-center gap-4">
          <h1 className="text-lg font-bold text-foreground">Sportsmetric hit an error</h1>
          <p className="max-w-sm text-sm leading-relaxed text-muted">
            The application failed to render. Reload to try again.
          </p>
          {error.digest ? (
            <p className="font-mono text-[11px] text-muted">Reference: {error.digest}</p>
          ) : null}
          <button
            type="button"
            onClick={() => unstable_retry()}
            className="rounded-full bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground"
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}
