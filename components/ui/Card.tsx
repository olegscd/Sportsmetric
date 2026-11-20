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
    "rounded-card border border-border/90 bg-surface/95 shadow-card",
    interactive &&
      "transition-all duration-150 ease-standard hover:border-border-strong hover:bg-elevated/65 hover:shadow-raised",
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
