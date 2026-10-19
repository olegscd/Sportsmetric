"use client";

import { NAV_ITEMS } from "@/components/layout/nav-items";
import { PAGE_SHELL } from "@/components/layout/page-shell";
import { useSportsData } from "@/context/SportsDataContext";
import { cn } from "@/lib/utils";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowUpRight, Settings2 } from "lucide-react";

export function DesktopTopBar() {
  const pathname = usePathname();
  const { games } = useSportsData();
  const isAdmin = pathname.startsWith("/admin");
  const liveCount = games.filter((g) => g.status === "LIVE").length;

  if (isAdmin) return null;

  return (
    <header className="sticky top-0 z-40 hidden min-w-0 border-b border-border bg-bg/95 backdrop-blur-xl md:block">
        <div className={`${PAGE_SHELL} flex h-20 items-center gap-8`}>
          <Link href="/" className="flex shrink-0 items-center">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/sportsmetric-wordmark.png"
              alt="Sportsmetric"
              className="h-7 w-auto object-contain lg:h-8"
            />
          </Link>
        <nav
          aria-label="Main"
          className="flex min-w-0 flex-1 items-center gap-1 overflow-x-auto"
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
                  "relative flex shrink-0 items-center gap-2 rounded-lg px-3 py-2.5 text-xs font-semibold text-muted transition-colors hover:bg-surface hover:text-foreground lg:text-sm",
                  active && "bg-elevated text-foreground"
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
                    className="absolute inset-x-3 -bottom-1 h-0.5 rounded-full bg-primary"
                  />
                ) : null}
              </Link>
            );
          })}
        </nav>
        <Link href="/admin" className="flex shrink-0 items-center gap-2 rounded-lg border border-border px-3 py-2 text-xs font-semibold text-muted transition-colors hover:border-primary/50 hover:text-foreground">
          <Settings2 size={14} aria-hidden="true" />
          <span className="hidden lg:inline">Workspace</span>
          <ArrowUpRight size={12} aria-hidden="true" />
        </Link>
      </div>
    </header>
  );
}
