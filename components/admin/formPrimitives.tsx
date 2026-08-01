import type { ReactNode } from "react";

export const inputClass =
  "w-full rounded-lg border border-border bg-elevated px-3 py-2 text-sm text-foreground placeholder:text-muted focus:border-primary focus:outline-none";

export const selectClass = `${inputClass} appearance-none`;

export const labelClass =
  "mb-1 block text-[11px] font-semibold uppercase tracking-wide text-muted";

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className={labelClass}>{label}</span>
      {children}
    </label>
  );
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
    <div className="flex flex-col gap-3 rounded-2xl border border-border bg-surface p-4">
      {(title || action) && (
        <div className="flex items-center justify-between gap-2 border-b border-border/50 pb-2">
          {title ? <p className="text-sm font-bold text-foreground">{title}</p> : <div />}
          {action}
        </div>
      )}
      {children}
    </div>
  );
}

export const primaryButtonClass =
  "w-full rounded-xl bg-primary py-2.5 text-sm font-bold text-primary-foreground active:opacity-80";

export const ghostButtonClass =
  "rounded-full border border-border px-2.5 py-1 text-[11px] font-semibold text-foreground active:bg-elevated";

export const dangerButtonClass =
  "rounded-full border border-live/30 px-2.5 py-1 text-[11px] font-semibold text-live active:bg-live/10";
