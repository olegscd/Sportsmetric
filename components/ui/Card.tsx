import type { HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

/**
 * `translucent` is the Match Center depth surface: a frosted gradient with a
 * hairline white border instead of the solid panel. `cn` does not merge
 * Tailwind classes, so it replaces the solid border/background/shadow rather
 * than layering on top of them.
 */
export const TRANSLUCENT_SURFACE = "rounded-card border border-white/[0.1] translucent-card";
const TRANSLUCENT_HOVER =
  "transition-all duration-150 ease-standard hover:border-white/25 hover:shadow-[inset_0_1px_0_rgba(255,255,255,0.16),0_22px_40px_-20px_rgba(0,0,0,0.96)]";

export function cardClasses({
  interactive = false,
  translucent = false,
  className,
}: {
  interactive?: boolean;
  translucent?: boolean;
  className?: string;
} = {}) {
  if (translucent) return cn(TRANSLUCENT_SURFACE, interactive && TRANSLUCENT_HOVER, className);
  return cn(
    "rounded-card border border-border/90 bg-surface/95 shadow-card",
    interactive &&
      "transition-all duration-150 ease-standard hover:border-border-strong hover:bg-elevated/65 hover:shadow-raised",
    className
  );
}

export function Card({
  interactive = false,
  translucent = false,
  className,
  children,
  ...props
}: HTMLAttributes<HTMLDivElement> & { interactive?: boolean; translucent?: boolean }) {
  return (
    <div className={cardClasses({ interactive, translucent, className })} {...props}>
      {children}
    </div>
  );
}
