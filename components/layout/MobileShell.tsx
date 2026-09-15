"use client";

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

export function MobileShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const isAdmin = pathname.startsWith("/admin");

  return (
    <div
      className={`relative mx-auto flex min-h-dvh w-full max-w-7xl flex-col bg-bg ${
        isAdmin ? "" : "pb-16 md:pb-0"
      }`}
    >
      {children}
    </div>
  );
}
