import type {
  HTMLAttributes,
  TdHTMLAttributes,
  ThHTMLAttributes,
} from "react";
import { cn } from "@/lib/utils";

export function TableShell({
  className,
  children,
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "h-scroll relative w-full overflow-x-auto rounded-card border border-border/80 bg-surface shadow-card",
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}

export function Th({
  numeric = false,
  sticky = false,
  className,
  children,
  ...props
}: ThHTMLAttributes<HTMLTableCellElement> & {
  numeric?: boolean;
  sticky?: boolean;
}) {
  return (
    <th
      scope="col"
      className={cn(
        "whitespace-nowrap border-b border-border bg-surface-2 px-3 py-2.5 text-2xs font-semibold uppercase tracking-wider text-muted",
        numeric && "text-right",
        sticky && "sticky left-0 z-20",
        className
      )}
      {...props}
    >
      {children}
    </th>
  );
}

export function Td({
  numeric = false,
  sticky = false,
  className,
  children,
  ...props
}: TdHTMLAttributes<HTMLTableCellElement> & {
  numeric?: boolean;
  sticky?: boolean;
}) {
  return (
    <td
      className={cn(
        "border-b border-border/40 px-3 py-2.5 text-sm text-foreground",
        numeric && "text-right tabular-nums",
        sticky && "sticky left-0 z-10 bg-surface",
        className
      )}
      {...props}
    >
      {children}
    </td>
  );
}
