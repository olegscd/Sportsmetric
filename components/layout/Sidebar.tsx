"use client";

import { useSportsData } from "@/context/SportsDataContext";
import { cn } from "@/lib/utils";
import { Award, ChevronDown, Radio, Shield, Trophy, Users } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import type { ComponentType } from "react";

interface NavItem {
  href: string;
  label: string;
  icon: ComponentType<{ size?: number; className?: string }>;
  isActive: (pathname: string) => boolean;
  badgeCount?: number;
}

const UAAP_SPORTS = [
  "All",
  "Basketball",
  "Volleyball",
  "Badminton",
  "Table Tennis",
  "Tae Kwon Do",
  "Judo",
  "Baseball",
  "Softball",
  "Football",
  "Fencing",
  "Chess",
];

const UAAP_DIVISIONS = ["All", "Men's", "Women's", "Juniors", "Girls"];

function UAAPSubNav() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const currentSport = searchParams.get("sport") || "All";
  const currentDivision = searchParams.get("division") || "All";

  function handleSportChange(sport: string) {
    const p = new URLSearchParams(searchParams.toString());
    if (sport === "All") p.delete("sport");
    else p.set("sport", sport);
    router.push(`/uaap?${p.toString()}`);
  }

  function handleDivisionChange(div: string) {
    const p = new URLSearchParams(searchParams.toString());
    if (div === "All") p.delete("division");
    else p.set("division", div);
    router.push(`/uaap?${p.toString()}`);
  }

  return (
    <div className="ml-4 pl-3 border-l-2 border-amber-500/30 py-2 space-y-3 animate-in fade-in slide-in-from-top-1 duration-200">
      {/* Sport Selector */}
      <div className="space-y-1">
        <label className="text-[10px] font-bold uppercase tracking-wider text-amber-400">
          Sport
        </label>
        <select
          value={currentSport}
          onChange={(e) => handleSportChange(e.target.value)}
          className="w-full bg-elevated border border-border text-foreground text-xs rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-amber-500"
        >
          {UAAP_SPORTS.map((s) => (
            <option key={s} value={s}>
              {s === "All" ? "All Sports" : s}
            </option>
          ))}
        </select>
      </div>

      {/* Division Selector */}
      <div className="space-y-1">
        <label className="text-[10px] font-bold uppercase tracking-wider text-amber-400">
          Division
        </label>
        <div className="grid grid-cols-2 gap-1">
          {UAAP_DIVISIONS.map((d) => {
            const active = currentDivision.toLowerCase() === d.toLowerCase();
            return (
              <button
                key={d}
                type="button"
                onClick={() => handleDivisionChange(d)}
                className={cn(
                  "px-2 py-1 rounded text-[11px] font-medium text-left transition-colors truncate",
                  active
                    ? "bg-amber-500/20 text-amber-300 font-semibold border border-amber-500/40"
                    : "text-muted hover:bg-elevated hover:text-foreground"
                )}
              >
                {d}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export function Sidebar() {
  const pathname = usePathname();
  const { games } = useSportsData();
  const liveCount = games.filter((g) => g.status === "LIVE").length;
  const [uaapExpanded, setUaapExpanded] = useState(true);

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
      label: "UAAP Archive",
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
          const isUaapItem = href === "/uaap";

          return (
            <div key={href} className="flex flex-col">
              <div className="flex items-center">
                <Link
                  href={href}
                  className={cn(
                    "flex flex-1 items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold transition-all",
                    active
                      ? "bg-primary text-primary-foreground shadow-sm"
                      : "text-muted hover:bg-elevated hover:text-foreground"
                  )}
                >
                  <Icon size={20} className={isUaapItem && active ? "text-amber-400" : undefined} />
                  <span className="flex-1">{label}</span>
                  {badgeCount ? (
                    <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-live px-1.5 text-[10px] font-bold text-white shadow-sm">
                      {badgeCount}
                    </span>
                  ) : null}
                </Link>

                {isUaapItem && (
                  <button
                    type="button"
                    onClick={() => setUaapExpanded(!uaapExpanded)}
                    className="p-2 text-muted hover:text-foreground rounded-lg ml-1"
                    title={uaapExpanded ? "Collapse UAAP menu" : "Expand UAAP menu"}
                  >
                    <ChevronDown
                      size={16}
                      className={cn("transition-transform", !uaapExpanded && "-rotate-90")}
                    />
                  </button>
                )}
              </div>

              {/* Expandable UAAP Sport & Division Selection in Sidebar */}
              {isUaapItem && uaapExpanded && (
                <Suspense fallback={<div className="text-[10px] text-muted p-2">Loading...</div>}>
                  <UAAPSubNav />
                </Suspense>
              )}
            </div>
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
