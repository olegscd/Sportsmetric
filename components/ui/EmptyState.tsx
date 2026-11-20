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
        "flex flex-col items-center justify-center gap-3 rounded-card border border-dashed border-border/90 bg-surface/65 px-6 py-12 text-center shadow-card",
        className
      )}
    >
      {icon ? (
        <div className="flex h-12 w-12 items-center justify-center rounded-full border border-border-strong/70 bg-elevated/80 text-muted shadow-inner">
          {icon}
        </div>
      ) : null}
      <p className="text-sm font-bold text-foreground">{title}</p>
      {description ? (
        <p className="max-w-sm text-xs leading-relaxed text-muted">{description}</p>
      ) : null}
      {action ? <div className="mt-1">{action}</div> : null}
    </div>
  );
}
