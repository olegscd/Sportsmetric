import type { ReactNode } from "react";

export function PageHeading({
  title,
  description,
  action,
  eyebrow = "Sportsmetric / Explore",
}: {
  title: string;
  description: string;
  action?: ReactNode;
  eyebrow?: string;
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4 pb-2 pt-1 md:pt-4">
      <div className="min-w-0">
        <p className="eyebrow mb-2.5 flex items-center gap-2 text-primary">
          <span className="h-1.5 w-1.5 rounded-full bg-primary shadow-[0_0_8px_rgba(239,68,68,0.8)]" aria-hidden="true" />
          {eyebrow}
        </p>
        <h1 className="page-heading text-foreground">{title}</h1>
        <p className="mt-2.5 max-w-2xl text-sm leading-relaxed text-muted">{description}</p>
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}
