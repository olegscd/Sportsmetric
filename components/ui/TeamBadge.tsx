"use client";

import { cn } from "@/lib/utils";
import type { Team } from "@/types/sports";
import { useEffect, useState } from "react";

const SIZE_CLASSES = {
  sm: "h-7 w-7 text-[10px]",
  md: "h-10 w-10 text-xs",
  lg: "h-16 w-16 text-base",
} as const;

interface TeamBadgeProps {
  team: Pick<Team, "shortName" | "accentColor" | "logo">;
  size?: keyof typeof SIZE_CLASSES;
  className?: string;
}

export function TeamBadge({ team, size = "md", className }: TeamBadgeProps) {
  const [imageFailed, setImageFailed] = useState(false);

  useEffect(() => {
    setImageFailed(false);
  }, [team.logo]);

  const rawLogo = team.logo?.trim();
  let logoSrc: string | null = null;
  if (rawLogo) {
    if (
      rawLogo.startsWith("http://") ||
      rawLogo.startsWith("https://") ||
      rawLogo.startsWith("/") ||
      rawLogo.startsWith("data:")
    ) {
      logoSrc = rawLogo;
    } else if (rawLogo.includes(".")) {
      logoSrc = `https://${rawLogo}`;
    } else {
      logoSrc = `/${rawLogo}`;
    }
  }

  if (logoSrc && !imageFailed) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={logoSrc}
        alt={team.shortName}
        onError={() => setImageFailed(true)}
        className={cn(
          "shrink-0 rounded-full border-2 bg-surface object-cover",
          SIZE_CLASSES[size],
          className
        )}
        style={{ borderColor: team.accentColor }}
      />
    );
  }

  return (
    <div
      className={cn(
        "flex shrink-0 items-center justify-center rounded-full border-2 bg-surface font-bold tracking-tight",
        SIZE_CLASSES[size],
        className
      )}
      style={{ borderColor: team.accentColor, color: team.accentColor }}
    >
      {team.shortName}
    </div>
  );
}
