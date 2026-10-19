"use client";

import { useActionState, useEffect } from "react";
import Link from "next/link";
import { ArrowLeft, Lock } from "lucide-react";
import { loginAdmin } from "./actions";
import { Button } from "@/components/ui/Button";
import { Field, Input } from "@/components/ui/Field";
import { Notice } from "@/components/ui/Notice";

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
    <div className="flex min-h-dvh items-center justify-center bg-bg px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="rounded-panel border border-border bg-surface p-6 shadow-modal">
          <div className="mb-5 text-center">
            <div className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-full bg-primary/15 text-primary">
              <Lock size={18} aria-hidden="true" />
            </div>
            <p className="text-lg font-bold text-foreground">Admin Access</p>
            <p className="mt-1 text-xs text-muted">
              Enter the admin password to continue.
            </p>
          </div>

          <form action={formAction} className="flex flex-col gap-3">
            <Field label="Password">
              <Input
                name="password"
                type="password"
                autoFocus
                required
                autoComplete="current-password"
                placeholder="Password"
              />
            </Field>

            {state.error && (
              <Notice tone="error">
                <p className="text-xs font-medium">{state.error}</p>
              </Notice>
            )}

            <Button type="submit" size="lg" loading={isPending} className="w-full">
              Enter Admin Panel
            </Button>
          </form>
        </div>

        <Link
          href="/"
          className="mx-auto mt-4 inline-flex min-h-10 items-center justify-center gap-1.5 rounded-control px-3 text-xs font-semibold text-muted transition-colors hover:text-foreground"
        >
          <ArrowLeft size={14} aria-hidden="true" />
          Back to Sportsmetric
        </Link>
      </div>
    </div>
  );
}
