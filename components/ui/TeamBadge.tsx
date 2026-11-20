"use client";

import { safeImageSource } from "@/lib/image-policy";
import { cn } from "@/lib/utils";
import type { Team } from "@/types/sports";
import Image from "next/image";
import { useState } from "react";

const SIZE_CLASSES = {
  sm: "h-8 w-8 rounded-lg text-[10px]",
  md: "h-11 w-11 rounded-xl text-xs",
  lg: "h-16 w-16 rounded-2xl text-base",
} as const;

interface TeamBadgeProps {
  team: Pick<Team, "shortName" | "accentColor" | "logo"> &
    Partial<Pick<Team, "league">>;
  size?: keyof typeof SIZE_CLASSES;
  className?: string;
}

export function TeamBadge({ team, size = "md", className }: TeamBadgeProps) {
  const [failedUrl, setFailedUrl] = useState<string | null>(null);

  const logoSrc = safeImageSource(team.logo);
  const imageFailed = Boolean(logoSrc && failedUrl === logoSrc);
  const accent = team.accentColor || "#ef4444";

  if (logoSrc && !imageFailed) {
    return (
      <span
        className={cn(
          "relative inline-flex shrink-0 items-center justify-center overflow-hidden bg-surface/85 p-0.5 shadow-sm",
          SIZE_CLASSES[size],
          className
        )}
        style={{
          border: `1.5px solid ${accent}88`,
          boxShadow: `inset 0 1px 0 rgba(255,255,255,0.12), 0 6px 14px -8px ${accent}`,
        }}
      >
        <Image
          width={64}
          height={64}
          sizes="64px"
          src={logoSrc}
          alt={team.shortName}
          onError={() => setFailedUrl(logoSrc)}
          className="h-full w-full rounded-[inherit] object-contain"
        />
      </span>
    );
  }

  const code = (team.shortName || "TM").toUpperCase().slice(0, 5);

  return (
    <span
      className={cn(
        "font-display relative inline-flex shrink-0 select-none items-center justify-center overflow-hidden font-black uppercase tracking-tight text-white backdrop-blur-sm",
        SIZE_CLASSES[size],
        className
      )}
      style={{
        background: `linear-gradient(145deg, ${accent}38, ${accent}14)`,
        border: `1.5px solid ${accent}88`,
        boxShadow: `inset 0 1px 0 rgba(255,255,255,0.18), 0 8px 18px -10px ${accent}`,
      }}
    >
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 h-[2px] opacity-80"
        style={{ backgroundColor: accent }}
      />
      <span className="px-0.5 leading-none drop-shadow-[0_1px_2px_rgba(0,0,0,0.65)]">
        {code}
      </span>
    </span>
  );
}
