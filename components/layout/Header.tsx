"use client";

import { ChevronLeft, Radio } from "lucide-react";
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
    <header className="sticky top-0 z-30 flex h-14 shrink-0 items-center gap-3 border-b border-border bg-bg/95 px-4 backdrop-blur">
      {isNested ? (
        <button
          type="button"
          onClick={() => router.back()}
          aria-label="Go back"
          className="-ml-2 flex h-9 w-9 items-center justify-center rounded-full text-foreground active:bg-surface"
        >
          <ChevronLeft size={22} />
        </button>
      ) : (
        <Link href="/" className="flex items-center gap-1.5">
          <Radio size={18} className="text-primary" />
          <span className="text-base font-bold tracking-tight text-foreground">
            Sportsmetric
          </span>
        </Link>
      )}

      {isNested ? (
        <span className="truncate text-base font-semibold text-foreground">
          {nestedTitle}
        </span>
      ) : (
        <span className="ml-auto text-sm font-medium text-muted">{title}</span>
      )}
    </header>
  );
}
