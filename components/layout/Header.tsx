"use client";

import { ChevronLeft } from "lucide-react";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

const ROUTE_TITLES: Record<string, string> = {
  "/": "Match Center",
  "/standings": "Standings",
  "/teams": "Teams",
  "/players": "Players",
  "/admin": "Admin",
};

const NESTED_ROUTE_TITLES: { prefix: string; label: string }[] = [
  { prefix: "/players/", label: "Player" },
  { prefix: "/teams/", label: "Team" },
];

export function Header() {
  const pathname = usePathname();
  const router = useRouter();

  const title = ROUTE_TITLES[pathname];
  const isNested = title === undefined;
  const nestedTitle =
    NESTED_ROUTE_TITLES.find(({ prefix }) => pathname.startsWith(prefix))?.label ?? "";

  return (
    <header className="relative z-30 flex h-14 shrink-0 items-center gap-3 border-b border-border bg-surface px-4 shadow-sm">
      {isNested ? (
        <button
          type="button"
          onClick={() => router.back()}
          aria-label="Go back"
          className="-ml-2 flex h-9 w-9 items-center justify-center rounded-full text-foreground active:bg-elevated"
        >
          <ChevronLeft size={22} />
        </button>
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

      {isNested ? (
        <span className="truncate text-base font-bold text-foreground">
          {nestedTitle}
        </span>
      ) : (
        <span className="ml-auto text-sm font-bold text-muted">{title}</span>
      )}
    </header>
  );
}
