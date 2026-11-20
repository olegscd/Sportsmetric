import { buttonClasses } from "@/components/ui/Button";
import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex min-h-[60vh] items-center justify-center px-4 py-12">
      <div className="scoreboard-hero w-full max-w-md rounded-panel border border-border-strong/70 p-7 text-center shadow-modal">
        <p className="font-display text-2xl font-extrabold tracking-tight text-foreground">Not found</p>
        <p className="mt-1 text-sm text-muted">
          We couldn&apos;t find what you were looking for.
        </p>
        <Link
          href="/"
          className={buttonClasses({ variant: "primary", size: "md", className: "mt-5" })}
        >
          Back to Match Center
        </Link>
      </div>
    </div>
  );
}
