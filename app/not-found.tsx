import { buttonClasses } from "@/components/ui/Button";
import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex min-h-[60vh] items-center justify-center px-4 py-12">
      <div className="w-full max-w-md rounded-panel border border-border bg-surface p-6 text-center shadow-card">
        <p className="text-lg font-bold text-foreground">Not found</p>
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
