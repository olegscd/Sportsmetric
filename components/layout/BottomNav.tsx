"use client";

import { useSportsData } from "@/context/SportsDataContext";
import { cn } from "@/lib/utils";
import { Radio, Shield, Trophy, Users } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ComponentType } from "react";

interface NavItem {
  href: string;
  label: string;
  icon: ComponentType<{ size?: number; className?: string }>;
  isActive: (pathname: string) => boolean;
  badgeCount?: number;
}

export function BottomNav() {
  const pathname = usePathname();
  const { games } = useSportsData();
  const liveCount = games.filter((g) => g.status === "LIVE").length;

  const navItems: NavItem[] = [
    {
      href: "/",
      label: "Matches",
      icon: Radio,
      isActive: (path) => path === "/",
      badgeCount: liveCount,
    },
    {
      href: "/standings",
      label: "Standings",
      icon: Trophy,
      isActive: (path) => path.startsWith("/standings"),
    },
    {
      href: "/teams",
      label: "Teams",
      icon: Shield,
      isActive: (path) => path.startsWith("/teams"),
    },
    {
      href: "/players",
      label: "Players",
      icon: Users,
      isActive: (path) => path.startsWith("/players"),
    },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-30 mx-auto flex max-w-md shrink-0 items-stretch border-t border-border bg-surface/95 shadow-lg backdrop-blur-md">
      {navItems.map(({ href, label, icon: Icon, isActive, badgeCount }) => {
        const active = isActive(pathname);
        return (
          <Link
            key={href}
            href={href}
            scroll={false}
            className="flex flex-1 flex-col items-center gap-1 py-2.5 transition-colors"
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
              {label}
            </span>
          </Link>
        );
      })}
    </nav>
  );
}
