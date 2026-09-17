import { Award, Radio, Shield, Trophy, Users } from "lucide-react";
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
