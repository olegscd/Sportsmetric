"use client";

import { NAV_ITEMS } from "@/components/layout/nav-items";
import { PAGE_SHELL } from "@/components/layout/page-shell";
import { Badge } from "@/components/ui/Badge";
import { useSportsData } from "@/context/SportsDataContext";
import { countLiveGames } from "@/lib/derivations";
import { cn } from "@/lib/utils";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowUpRight, Settings2 } from "lucide-react";

export function DesktopTopBar() {
  const pathname = usePathname();
  const { games } = useSportsData();
  const isAdmin = pathname.startsWith("/admin");
  const liveCount = countLiveGames(games);

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
          className="h-scroll flex min-w-0 flex-1 items-center gap-1 overflow-x-auto"
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
                  "relative flex min-h-11 shrink-0 items-center gap-2 rounded-control px-3 py-2.5 text-xs font-semibold text-muted transition-colors duration-150 ease-standard hover:bg-surface hover:text-foreground lg:text-sm",
                  active && "bg-elevated text-foreground"
                )}
              >
                {label}
                {showLive ? (
                  <Badge
                    tone="live"
                    size="sm"
                    className="min-w-5 justify-center px-1.5 py-0 normal-case tracking-normal"
                  >
                    {liveCount > 99 ? "99+" : liveCount}
                  </Badge>
                ) : null}
                {active ? (
                  <span
                    aria-hidden="true"
                    className="absolute inset-x-3 -bottom-1 h-0.5 rounded-full bg-primary"
                  />
                ) : null}
              </Link>
            );
          })}
        </nav>
        <Link
          href="/admin"
          className="flex min-h-11 shrink-0 items-center gap-2 rounded-control border border-border px-3 py-2 text-xs font-semibold text-muted transition-colors duration-150 ease-standard hover:border-border-strong hover:text-foreground"
        >
          <Settings2 size={14} aria-hidden="true" />
          <span className="hidden lg:inline">Workspace</span>
          <ArrowUpRight size={12} aria-hidden="true" />
        </Link>
      </div>
    </header>
  );
}
