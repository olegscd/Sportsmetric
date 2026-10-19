import type { ReactNode } from "react";

export function PageHeading({ title, description, action }: {
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4 pb-2 pt-2 md:pt-5">
      <div>
        <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.2em] text-primary">Sportsmetric / Explore</p>
        <h1 className="page-heading">{title}</h1>
        <p className="mt-2 max-w-xl text-sm leading-relaxed text-muted">{description}</p>
      </div>
      {action}
    </div>
  );
}
