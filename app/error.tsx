"use client";

import { Button, buttonClasses } from "@/components/ui/Button";
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
    <div className="flex min-h-[60vh] items-center justify-center px-4 py-12">
      <div className="scoreboard-hero w-full max-w-md rounded-panel border border-border-strong/70 p-7 text-center shadow-modal">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full border border-negative/30 bg-negative/15">
          <AlertTriangle size={22} className="text-negative" aria-hidden="true" />
        </div>
        <h1 className="font-display mt-4 text-2xl font-extrabold tracking-tight text-foreground">Something went wrong</h1>
        <p className="mt-1 text-sm leading-relaxed text-muted">
          This page hit an unexpected error. Trying again usually resolves it.
        </p>
        {error.digest ? (
          <p className="mt-2 font-mono text-2xs text-muted">Reference: {error.digest}</p>
        ) : null}
        <div className="mt-5 flex flex-col justify-center gap-2 sm:flex-row">
          <Button onClick={() => unstable_retry()}>
            <RefreshCw size={15} aria-hidden="true" />
            Try again
          </Button>
          <Link href="/" className={buttonClasses({ variant: "outline", size: "md" })}>
            Match Center
          </Link>
        </div>
      </div>
    </div>
  );
}
