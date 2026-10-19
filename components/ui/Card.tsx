import type { HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export function cardClasses({
  interactive = false,
  className,
}: {
  interactive?: boolean;
  className?: string;
} = {}) {
  return cn(
    "rounded-card border border-border/80 bg-surface shadow-card",
    interactive &&
      "transition-colors duration-150 ease-standard hover:border-border-strong hover:bg-surface-2/40",
    className
  );
}

export function Card({
  interactive = false,
  className,
  children,
  ...props
}: HTMLAttributes<HTMLDivElement> & { interactive?: boolean }) {
  return (
    <div className={cardClasses({ interactive, className })} {...props}>
      {children}
    </div>
  );
}
