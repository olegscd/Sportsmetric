"use client";

import { BrandMark } from "@/components/layout/BrandMark";
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
  "/about": "About",
  "/international": "International",
};

function parentPath(pathname: string): string {
  if (pathname.startsWith("/news/")) return "/news";
  if (pathname.startsWith("/players/")) return "/players";
  if (pathname.startsWith("/teams/")) return "/teams";
  if (pathname.startsWith("/athletes/")) return "/international";
  return "/";
}

function nestedTitle(pathname: string): string {
  if (pathname.startsWith("/news/")) return "News";
  if (pathname.startsWith("/players/")) return "Player";
  if (pathname.startsWith("/teams/")) return "Team";
  if (pathname.startsWith("/athletes/")) return "Athlete";
  if (pathname.startsWith("/leagues/")) return pathname.slice("/leagues/".length).toUpperCase();
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
        "relative z-30 flex h-14 shrink-0 items-center gap-2.5 border-b border-border/80 bg-surface/90 px-3 backdrop-blur-xl md:hidden",
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
        <Link href="/" aria-label="Sportsmetric Home" className="flex shrink-0 items-center">
          <BrandMark compact />
        </Link>
      )}

      <span
        className={cn(
          "min-w-0 flex-1 truncate",
          isNested
            ? "text-base font-bold text-foreground"
            : "border-l border-border/80 pl-2.5 text-xs font-semibold uppercase tracking-wider text-muted"
        )}
      >
        {label}
      </span>
      <Link
        href="/admin"
        aria-label="Admin workspace"
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-control border border-border/90 bg-surface/80 text-muted transition-colors hover:border-border-strong hover:bg-elevated hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
      >
        <Settings2 size={16} aria-hidden="true" />
      </Link>
    </header>
  );
}
