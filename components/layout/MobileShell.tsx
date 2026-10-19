"use client";

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

export function MobileShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const isAdmin = pathname.startsWith("/admin");

  return (
    <div
      className={`relative flex min-h-dvh w-full min-w-0 flex-col bg-bg ${
        isAdmin ? "" : "pb-[calc(4rem+env(safe-area-inset-bottom))] md:pb-0"
      }`}
    >
      {children}
    </div>
  );
}
