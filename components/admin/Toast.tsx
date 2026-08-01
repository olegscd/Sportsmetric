"use client";

import { cn } from "@/lib/utils";
import { CheckCircle2, XCircle } from "lucide-react";

export interface ToastState {
  message: string;
  tone: "success" | "error";
}

export type ToastFn = (message: string, tone?: ToastState["tone"]) => void;

export function Toast({ toast }: { toast: ToastState | null }) {
  if (!toast) return null;

  return (
    <div className="pointer-events-none fixed inset-x-0 top-3 z-[60] flex justify-center px-4">
      <div
        className={cn(
          "pointer-events-auto flex items-center gap-2 rounded-full border px-4 py-2 text-xs font-semibold shadow-lg",
          toast.tone === "success"
            ? "border-success/30 bg-success/15 text-success"
            : "border-live/30 bg-live/15 text-live"
        )}
      >
        {toast.tone === "success" ? <CheckCircle2 size={14} /> : <XCircle size={14} />}
        {toast.message}
      </div>
    </div>
  );
}
