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
          "pointer-events-auto flex max-w-lg items-center gap-3 rounded-xl border bg-elevated px-4 py-3 text-sm font-medium shadow-xl",
          toast.tone === "success"
            ? "border-success/40 text-success"
            : "border-live/40 text-live"
        )}
      >
        {toast.tone === "success" ? <CheckCircle2 size={18} className="shrink-0" /> : <XCircle size={18} className="shrink-0" />}
        <span>{toast.message}</span>
        {onDismiss && <button type="button" onClick={onDismiss} aria-label="Dismiss notification" className="ml-2 rounded-lg p-1.5 text-muted hover:bg-surface"><X size={16} /></button>}
      </div>
    </div>
  );
}
