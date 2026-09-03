"use client";

import { useSportsData } from "@/context/SportsDataContext";
import { cn } from "@/lib/utils";
import { Award, Radio, Shield, Trophy, Users } from "lucide-react";
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

export function Sidebar() {
  const pathname = usePathname();
  const { games } = useSportsData();
  const liveCount = games.filter((g) => g.status === "LIVE").length;

  const navItems: NavItem[] = [
    {
      href: "/",
      label: "Match Center",
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
      href: "/uaap",
      label: "UAAP",
      icon: Award,
      isActive: (path) => path.startsWith("/uaap"),
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
    <aside className="hidden md:flex w-64 shrink-0 flex-col border-r border-border bg-surface p-4 min-h-screen">
      <Link href="/" className="flex items-center gap-2 mb-8 px-2 py-1">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/sportsmetric-wordmark.png"
          alt="Sportsmetric"
          className="h-7 w-auto object-contain"
        />
      </Link>

      <nav className="flex flex-col gap-1.5 flex-1">
        {navItems.map(({ href, label, icon: Icon, isActive, badgeCount }) => {
          const active = isActive(pathname);
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold transition-all",
                active
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "text-muted hover:bg-elevated hover:text-foreground"
              )}
            >
              <Icon size={20} />
              <span className="flex-1">{label}</span>
              {badgeCount ? (
                <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-live px-1.5 text-[10px] font-bold text-white shadow-sm">
                  {badgeCount}
                </span>
              ) : null}
            </Link>
          );
        })}
      </nav>

      <div className="mt-auto border-t border-border pt-4 px-2 text-xs text-muted">
        <p className="font-semibold text-foreground">Sportsmetric Desktop</p>
        <p className="text-[11px] mt-0.5">UAAP &bull; PBA &bull; PVL Analytics</p>
      </div>
    </aside>
  );
}
