"use client";

import { NAV_ITEMS } from "@/components/layout/nav-items";
import { PAGE_SHELL } from "@/components/layout/page-shell";
import { useSportsData } from "@/context/SportsDataContext";
import { cn } from "@/lib/utils";
import Link from "next/link";
import { usePathname } from "next/navigation";

export function DesktopTopBar() {
  const pathname = usePathname();
  const { games } = useSportsData();
  const isAdmin = pathname.startsWith("/admin");
  const liveCount = games.filter((g) => g.status === "LIVE").length;

  if (isAdmin) return null;

  return (
    <header className="sticky top-0 z-40 hidden min-w-0 md:block">
      <div className="border-b border-border bg-surface">
        <div className={`${PAGE_SHELL} flex h-14 items-center`}>
          <Link href="/" className="flex shrink-0 items-center">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/sportsmetric-wordmark.png"
              alt="Sportsmetric"
              className="h-7 w-auto object-contain"
            />
          </Link>
        </div>
      </div>

      <div className="min-w-0 border-t border-border bg-elevated shadow-sm">
        <nav
          aria-label="Main"
          className={`${PAGE_SHELL} flex items-stretch gap-0 overflow-x-auto`}
        >
          {NAV_ITEMS.map(({ href, label, isActive }) => {
            const active = isActive(pathname);
            const showLive = href === "/" && liveCount > 0;

            return (
              <Link
                key={href}
                href={href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "relative flex shrink-0 items-center gap-2 px-4 py-3.5 text-sm font-semibold text-foreground/80 transition-colors hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-primary",
                  active && "text-foreground"
                )}
              >
                {label}
                {showLive ? (
                  <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-live px-1.5 text-[10px] font-bold text-white">
                    {liveCount}
                  </span>
                ) : null}
                {active ? (
                  <span
                    aria-hidden
                    className="absolute inset-x-2 bottom-0 h-0.5 rounded-full bg-primary"
                  />
                ) : null}
              </Link>
            );
          })}
        </nav>
      </div>
    </header>
  );
}
