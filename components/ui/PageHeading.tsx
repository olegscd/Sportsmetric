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
    <div className="flex flex-wrap items-end justify-between gap-4 pb-2 pt-2 md:pt-5">
      <div className="min-w-0">
        <p className="eyebrow mb-2 text-primary">{eyebrow}</p>
        <h1 className="page-heading">{title}</h1>
        <p className="mt-2 max-w-xl text-sm leading-relaxed text-muted">{description}</p>
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}
