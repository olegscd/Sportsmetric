"use client";

import { cn } from "@/lib/utils";
import { ChevronLeft } from "lucide-react";

import Link from "next/link";
import { usePathname } from "next/navigation";

const ROUTE_TITLES: Record<string, string> = {
  "/": "Match Center",
  "/standings": "Standings",
  "/teams": "Teams",
  "/players": "Players",
  "/uaap": "UAAP Archive",
};

function parentPath(pathname: string): string {
  if (pathname.startsWith("/players/")) return "/players";
  if (pathname.startsWith("/teams/")) return "/teams";
  return "/";
}

function nestedTitle(pathname: string): string {
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
        "relative z-30 flex h-14 shrink-0 items-center gap-3 border-b border-border bg-surface px-4 shadow-sm md:hidden",
        isAdmin && "hidden"
      )}
    >
      {isNested ? (
        <Link
          href={parentPath(pathname)}
          aria-label="Go back"
          className="-ml-2 flex h-9 w-9 items-center justify-center rounded-full text-foreground transition-colors hover:bg-elevated focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
        >
          <ChevronLeft size={22} />
        </Link>
      ) : (
        <Link href="/" className="flex items-center gap-1.5">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/sportsmetric-wordmark.png"
            alt="Sportsmetric"
            className="h-6 w-auto object-contain"
          />
        </Link>
      )}

      <span className={`truncate text-base font-bold text-foreground ${isNested ? "" : "ml-auto text-sm text-muted"}`}>
        {label}
      </span>
    </header>
  );
}
