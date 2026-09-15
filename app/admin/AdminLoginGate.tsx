"use client";

import { useActionState, useEffect } from "react";
import { Lock } from "lucide-react";
import { loginAdmin } from "./actions";

export function AdminLoginGate() {
  const [state, formAction, isPending] = useActionState(loginAdmin, {
    error: null,
    success: false,
  });

  useEffect(() => {
    if (state?.success) {
      window.location.assign("/admin");
    }
  }, [state?.success]);

  return (
    <div className="flex min-h-dvh items-center justify-center bg-bg px-4">
      <div className="w-full max-w-xs">
        <div className="rounded-2xl border border-border bg-surface p-6">
          <div className="mb-4 text-center">
            <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-primary/15 text-primary">
              <Lock size={18} aria-hidden="true" />
            </div>
            <p className="text-lg font-bold text-foreground">Admin Access</p>
            <p className="mt-1 text-xs text-muted">
              Enter the admin password to continue.
            </p>
          </div>

          <form action={formAction} className="flex flex-col gap-3">
            <input
              name="password"
              type="password"
              autoFocus
              required
              placeholder="Password"
              className="w-full rounded-xl border border-border bg-elevated px-3 py-2.5 text-sm text-foreground placeholder:text-muted focus:border-primary focus:outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
            />

            {state.error && (
              <p className="rounded-lg bg-live/10 px-3 py-2 text-xs font-medium text-live">
                {state.error}
              </p>
            )}

            <button
              type="submit"
              disabled={isPending}
              className="w-full rounded-xl bg-primary py-2.5 text-sm font-bold text-primary-foreground transition-colors hover:bg-primary/90 active:bg-primary/90 disabled:opacity-60"
            >
              {isPending ? "Verifying..." : "Enter Admin Panel"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
