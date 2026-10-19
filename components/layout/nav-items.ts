import { Award, Globe2, Newspaper, Radio, Shield, Trophy, Users } from "lucide-react";
import { INTERNATIONAL_LAUNCHED } from "@/lib/international";
import type { ComponentType } from "react";

export interface NavItem {
  href: string;
  label: string;
  icon: ComponentType<{ size?: number; className?: string }>;
  isActive: (pathname: string) => boolean;
}

export const NAV_ITEMS: NavItem[] = [
  {
    href: "/",
    label: "Match Center",
    icon: Radio,
    isActive: (path) => path === "/",
  },
  {
    href: "/news",
    label: "News",
    icon: Newspaper,
    isActive: (path) => path === "/news" || path.startsWith("/news/"),
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
  // Hidden until verified profiles are published (see lib/international.ts).
  ...(INTERNATIONAL_LAUNCHED ? [{
    href: "/international",
    label: "International",
    icon: Globe2,
    isActive: (path: string) => path.startsWith("/international") || path.startsWith("/athletes"),
  }] : []),
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
