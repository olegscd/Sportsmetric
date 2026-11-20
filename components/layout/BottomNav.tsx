"use client";

import { NAV_ITEMS } from "@/components/layout/nav-items";
import { useSportsData } from "@/context/SportsDataContext";
import { countLiveGames } from "@/lib/derivations";
import { cn } from "@/lib/utils";
import Link from "next/link";
import { usePathname } from "next/navigation";

const MOBILE_LABELS: Record<string, string> = {
  "/": "Matches",
  "/news": "News",
  "/standings": "Standings",
  "/uaap": "UAAP",
  "/international": "Intl",
  "/teams": "Teams",
  "/players": "Players",
};

export function BottomNav() {
  const pathname = usePathname();
  const { games } = useSportsData();
  const isAdmin = pathname.startsWith("/admin");

  const liveCount = countLiveGames(games);

  return (
    <nav
      aria-label="Main"
      className={cn(
        "fixed bottom-0 left-0 right-0 z-30 flex shrink-0 items-stretch border-t border-border/85 bg-surface/92 pb-[env(safe-area-inset-bottom)] shadow-raised backdrop-blur-xl md:hidden",
        isAdmin && "hidden"
      )}
    >
      {NAV_ITEMS.map(({ href, label, icon: Icon, isActive }) => {
        const active = isActive(pathname);
        const badgeCount = href === "/" ? liveCount : 0;
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            className="relative flex min-h-16 flex-1 flex-col items-center justify-center gap-1 px-1 py-2 transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
          >
            {active ? (
              <span
                aria-hidden="true"
                className="absolute top-0 h-0.5 w-8 rounded-full bg-primary shadow-[0_0_10px_rgba(239,68,68,0.85)]"
              />
            ) : null}
            <span
              className={cn(
                "relative flex h-7 w-11 items-center justify-center rounded-full transition-colors",
                active && "bg-primary/12"
              )}
            >
              <Icon
                size={20}
                aria-hidden="true"
                className={cn(active ? "text-primary" : "text-muted")}
              />
              {badgeCount ? (
                <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-live px-1 text-3xs font-bold leading-none text-white shadow-sm">
                  {badgeCount > 99 ? "99+" : badgeCount}
                </span>
              ) : null}
            </span>
            <span
              className={cn(
                "max-w-full truncate text-2xs leading-none",
                active ? "font-bold text-foreground" : "font-medium text-muted"
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
