"use client";

import { NAV_ITEMS } from "@/components/layout/nav-items";
import { useSportsData } from "@/context/SportsDataContext";
import { cn } from "@/lib/utils";
import Link from "next/link";
import { usePathname } from "next/navigation";

const MOBILE_LABELS: Record<string, string> = {
  "/": "Matches",
  "/standings": "Standings",
  "/uaap": "UAAP",
  "/teams": "Teams",
  "/players": "Players",
};

export function BottomNav() {
  const pathname = usePathname();
  const { games } = useSportsData();
  const isAdmin = pathname.startsWith("/admin");

  const liveCount = games.filter((g) => g.status === "LIVE").length;

  return (
    <nav className={cn("fixed bottom-0 left-0 right-0 z-30 mx-auto flex max-w-md shrink-0 items-stretch border-t border-border bg-surface/95 shadow-lg backdrop-blur-md md:hidden", isAdmin && "hidden")}>
      {NAV_ITEMS.map(({ href, label, icon: Icon, isActive }) => {
        const active = isActive(pathname);
        const badgeCount = href === "/" ? liveCount : 0;
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            className="flex flex-1 flex-col items-center gap-1 py-2.5 transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
          >
            <span className="relative">
              <Icon size={22} className={cn(active ? "text-primary" : "text-muted")} />
              {badgeCount ? (
                <span className="absolute -right-2 -top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-live px-1 text-[9px] font-bold text-white shadow-sm">
                  {badgeCount}
                </span>
              ) : null}
            </span>
            <span
              className={cn(
                "text-[11px]",
                active ? "font-bold text-primary" : "font-medium text-muted"
              )}
            >
              {MOBILE_LABELS[href] ?? label}
            </span>
          </Link>
        );
      })}
    </nav>
  );
}
