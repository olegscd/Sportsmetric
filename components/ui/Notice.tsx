import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/utils";

export type NoticeTone = "error" | "warning" | "info" | "success";

const toneClasses: Record<NoticeTone, string> = {
  error: "border-negative/35 bg-negative/10 text-negative",
  warning: "border-archive/35 bg-archive/10 text-archive",
  info: "border-info/35 bg-info/10 text-info",
  success: "border-positive/35 bg-positive/10 text-positive",
};

export function Notice({
  tone,
  title,
  action,
  className,
  children,
  ...props
}: HTMLAttributes<HTMLDivElement> & {
  tone: NoticeTone;
  title?: string;
  action?: ReactNode;
}) {
  const isAlert = tone === "error" || tone === "warning";

  return (
    <div
      role={isAlert ? "alert" : "status"}
      className={cn(
        "flex flex-wrap items-start gap-3 rounded-card border px-4 py-3 text-sm",
        toneClasses[tone],
        className
      )}
      {...props}
    >
      <div className="min-w-0 flex-1">
        {title ? <p className="font-bold">{title}</p> : null}
        {children ? (
          <div className={cn("leading-relaxed", title && "mt-0.5 text-foreground/80")}>
            {children}
          </div>
        ) : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}
