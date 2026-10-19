import { buttonClasses } from "@/components/ui/Button";
import { cardClasses } from "@/components/ui/Card";
import { Field as SharedField, controlClasses } from "@/components/ui/Field";
import type { ReactNode } from "react";

/**
 * Admin compatibility layer: re-exports the public design-system primitives
 * under the names the admin panels already use, so the workspace picks up the
 * refined scoreboard styling without touching every import.
 */
export const inputClass = controlClasses;

export const selectClass = controlClasses;

export const labelClass =
  "mb-1.5 block text-2xs font-semibold uppercase tracking-wide text-muted";

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return <SharedField label={label}>{children}</SharedField>;
}

export function SectionCard({
  title,
  action,
  children,
}: {
  title?: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className={cardClasses({ className: "flex min-w-0 flex-col gap-4 p-4 md:p-5" })}>
      {(title || action) && (
        <div className="flex items-center justify-between gap-2 border-b border-border/50 pb-2">
          {title ? <h3 className="text-sm font-bold text-foreground">{title}</h3> : <div />}
          {action}
        </div>
      )}
      {children}
    </section>
  );
}

export const primaryButtonClass = buttonClasses({ variant: "primary", size: "md" });

export const ghostButtonClass = buttonClasses({ variant: "outline", size: "sm" });

export const dangerButtonClass = buttonClasses({ variant: "danger", size: "sm" });
