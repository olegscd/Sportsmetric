import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

/**
 * Shared "nothing here" panel. Keeps the wording outward-facing -- several of
 * these previously told visitors to go add data in the admin dashboard.
 */
export function EmptyState({
  icon,
  title,
  description,
  action,
  className,
}: {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-3 rounded-card border border-dashed border-border bg-surface/50 px-6 py-10 text-center",
        className
      )}
    >
      {icon ? (
        <div className="flex h-11 w-11 items-center justify-center rounded-full border border-border bg-elevated/60 text-muted">
          {icon}
        </div>
      ) : null}
      <p className="text-sm font-semibold text-foreground">{title}</p>
      {description ? (
        <p className="max-w-sm text-xs leading-relaxed text-muted">{description}</p>
      ) : null}
      {action ? <div className="mt-1">{action}</div> : null}
    </div>
  );
}
