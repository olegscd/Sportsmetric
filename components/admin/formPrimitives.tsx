import type { ReactNode } from "react";

export const inputClass =
  "min-h-11 w-full min-w-0 rounded-xl border border-border bg-bg/70 px-3 py-2.5 text-sm text-foreground placeholder:text-muted/70 transition-colors focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/15 disabled:cursor-not-allowed disabled:opacity-60 aria-[invalid=true]:border-live";

export const selectClass = inputClass;

export const labelClass =
  "mb-1.5 block text-xs font-medium text-muted";

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
    <section className="flex min-w-0 flex-col gap-4 rounded-2xl border border-border bg-surface p-4 md:p-5">
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

export const primaryButtonClass =
  "inline-flex items-center justify-center gap-1.5 rounded-xl bg-primary px-4 py-2.5 text-sm font-bold text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:cursor-not-allowed disabled:opacity-60 active:opacity-90";

export const ghostButtonClass =
  "inline-flex items-center justify-center rounded-full border border-border px-2.5 py-1 text-[11px] font-semibold text-foreground transition-colors hover:bg-elevated focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:cursor-not-allowed disabled:opacity-50";

export const dangerButtonClass =
  "inline-flex items-center justify-center rounded-full border border-live/30 px-2.5 py-1 text-[11px] font-semibold text-live transition-colors hover:bg-live/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-live disabled:cursor-not-allowed disabled:opacity-50";
