"use client";

import { cn } from "@/lib/utils";
import { CheckCircle2, XCircle, X } from "lucide-react";

export interface ToastState {
  message: string;
  tone: "success" | "error";
}

export type ToastFn = (message: string, tone?: ToastState["tone"]) => void;

export function Toast({ toast, onDismiss }: { toast: ToastState | null; onDismiss?: () => void }) {
  if (!toast) return null;

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-5 z-[60] flex justify-center px-4">
      <div
        role={toast.tone === "error" ? "alert" : "status"}
        className={cn(
          "pointer-events-auto flex max-w-lg items-center gap-3 rounded-card border bg-elevated px-4 py-3 text-sm font-medium shadow-raised",
          toast.tone === "success"
            ? "border-positive/40 text-positive"
            : "border-negative/40 text-negative"
        )}
      >
        {toast.tone === "success" ? <CheckCircle2 size={18} className="shrink-0" aria-hidden="true" /> : <XCircle size={18} className="shrink-0" aria-hidden="true" />}
        <span>{toast.message}</span>
        {onDismiss && <button type="button" onClick={onDismiss} aria-label="Dismiss notification" className="ml-2 inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-control text-muted transition-colors hover:bg-surface hover:text-foreground"><X size={16} aria-hidden="true" /></button>}
      </div>
    </div>
  );
}
