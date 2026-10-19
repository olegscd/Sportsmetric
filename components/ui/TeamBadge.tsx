"use client";

import { cn } from "@/lib/utils";
import type { Team } from "@/types/sports";
import { useState } from "react";
import Image from "next/image";
import { safeImageSource } from "@/lib/image-policy";

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
  const [failedUrl, setFailedUrl] = useState<string | null>(null);

  const logoSrc = safeImageSource(team.logo);

  const imageFailed = Boolean(logoSrc && failedUrl === logoSrc);

  if (logoSrc && !imageFailed) {
    return (
      <Image
        width={64}
        height={64}
        sizes="64px"
        src={logoSrc}
        alt={team.shortName}
        onError={() => setFailedUrl(logoSrc)}
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
