import type { ReactNode } from "react";

export function MobileShell({ children }: { children: ReactNode }) {
  return (
    <div className="relative mx-auto flex min-h-dvh w-full max-w-7xl flex-col bg-bg pb-16 md:pb-0">
      {children}
    </div>
  );
}
