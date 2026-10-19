"use client";

import { cn } from "@/lib/utils";
import { ChevronLeft, Settings2 } from "lucide-react";

import Link from "next/link";
import { usePathname } from "next/navigation";

const ROUTE_TITLES: Record<string, string> = {
  "/": "Match Center",
  "/news": "News",
  "/standings": "Standings",
  "/teams": "Teams",
  "/players": "Players",
  "/uaap": "UAAP Archive",
};

function parentPath(pathname: string): string {
  if (pathname.startsWith("/news/")) return "/news";
  if (pathname.startsWith("/players/")) return "/players";
  if (pathname.startsWith("/teams/")) return "/teams";
  return "/";
}

function nestedTitle(pathname: string): string {
  if (pathname.startsWith("/news/")) return "News";
  if (pathname.startsWith("/players/")) return "Player";
  if (pathname.startsWith("/teams/")) return "Team";
  return "";
}

export function Header() {
  const pathname = usePathname();

  const isAdmin = pathname.startsWith("/admin");
  const title = ROUTE_TITLES[pathname];
  const isNested = title === undefined && !isAdmin;
  const label = isNested ? nestedTitle(pathname) : title;

  return (
    <header
      className={cn(
        "relative z-30 flex h-14 shrink-0 items-center gap-2 border-b border-border bg-surface px-3 shadow-sm md:hidden",
        isAdmin && "hidden"
      )}
    >
      {isNested ? (
        <Link
          href={parentPath(pathname)}
          aria-label="Go back"
          className="-ml-1 flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-foreground transition-colors hover:bg-elevated focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
        >
          <ChevronLeft size={22} aria-hidden="true" />
        </Link>
      ) : (
        <Link href="/" className="flex shrink-0 items-center gap-1.5">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/sportsmetric-wordmark.png"
            alt="Sportsmetric"
            className="h-6 w-auto object-contain"
          />
        </Link>
      )}

      <span
        className={cn(
          "min-w-0 flex-1 truncate text-base font-bold text-foreground",
          !isNested && "text-sm font-semibold text-muted"
        )}
      >
        {label}
      </span>
      <Link
        href="/admin"
        aria-label="Admin workspace"
        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-control border border-border text-muted transition-colors hover:border-border-strong hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
      >
        <Settings2 size={16} aria-hidden="true" />
      </Link>
    </header>
  );
}
