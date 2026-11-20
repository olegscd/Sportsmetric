"use client";

import { safeImageSource } from "@/lib/image-policy";
import { cn } from "@/lib/utils";
import type { League, Team } from "@/types/sports";
import Image from "next/image";
import { useId, useState } from "react";

const SIZE_CLASSES = {
  sm: "h-8 w-8 text-[9px]",
  md: "h-11 w-11 text-[11px]",
  lg: "h-16 w-16 text-sm",
} as const;

interface TeamBadgeProps {
  team: Pick<Team, "shortName" | "accentColor" | "logo"> &
    Partial<Pick<Team, "league">>;
  size?: keyof typeof SIZE_CLASSES;
  className?: string;
}

function crestShapePath(league?: League): string {
  if (league === "PVL") {
    // Sleek athletic hexagon crest
    return "M20 2.5 L35.5 10 V27.5 L20 37.5 L4.5 27.5 V10 Z";
  }
  if (league === "PBA") {
    // Pro chamfered diamond shield
    return "M8 4 H32 L36 12 L33.5 27.5 L20 37.5 L6.5 27.5 L4 12 Z";
  }
  // Classic collegiate varsity shield
  return "M6 5.5 Q20 2 34 5.5 V22.5 C34 30.2 27.2 35.2 20 37.8 C12.8 35.2 6 30.2 6 22.5 Z";
}

function crestFontSize(code: string): number {
  const len = code.trim().length;
  if (len <= 2) return 11.5;
  if (len === 3) return 9.8;
  if (len === 4) return 8.2;
  return 6.9;
}

export function TeamBadge({ team, size = "md", className }: TeamBadgeProps) {
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  const uid = useId().replace(/:/g, "");

  const logoSrc = safeImageSource(team.logo);
  const imageFailed = Boolean(logoSrc && failedUrl === logoSrc);
  const accent = team.accentColor || "#ef4444";

  if (logoSrc && !imageFailed) {
    return (
      <span
        className={cn(
          "relative inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full border-2 bg-white/95 p-0.5 shadow-md",
          SIZE_CLASSES[size],
          className
        )}
        style={{
          borderColor: accent,
          boxShadow: `0 0 0 1px rgba(255,255,255,0.16), 0 6px 16px -6px ${accent}`,
        }}
      >
        <Image
          width={64}
          height={64}
          sizes="64px"
          src={logoSrc}
          alt={team.shortName}
          onError={() => setFailedUrl(logoSrc)}
          className="h-full w-full object-contain"
        />
      </span>
    );
  }

  const code = (team.shortName || "TM").toUpperCase().slice(0, 5);
  const shieldPath = crestShapePath(team.league);
  const gradId = `tb-g-${uid}`;
  const sheenId = `tb-s-${uid}`;
  const clipId = `tb-c-${uid}`;

  return (
    <span
      className={cn(
        "relative inline-flex shrink-0 select-none items-center justify-center drop-shadow-sm",
        SIZE_CLASSES[size],
        className
      )}
      style={{
        filter: `drop-shadow(0 4px 10px ${accent}40)`,
      }}
    >
      <svg viewBox="0 0 40 40" className="h-full w-full" aria-hidden="true">
        <defs>
          <linearGradient id={gradId} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor={accent} stopOpacity="0.95" />
            <stop offset="55%" stopColor="#131d31" />
            <stop offset="100%" stopColor="#070b14" />
          </linearGradient>
          <linearGradient id={sheenId} x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#ffffff" stopOpacity="0.32" />
            <stop offset="48%" stopColor="#ffffff" stopOpacity="0" />
          </linearGradient>
          <clipPath id={clipId}>
            <path d={shieldPath} />
          </clipPath>
        </defs>

        <path d={shieldPath} fill={`url(#${gradId})`} />

        <g clipPath={`url(#${clipId})`}>
          {/* Diagonal athletic ribbon */}
          <path d="M-2 29 L28 -2 H38 L4 35 Z" fill={accent} fillOpacity="0.34" />
          <path d="M12 42 L42 12 V20 L20 42 Z" fill="#ffffff" fillOpacity="0.09" />
          <path d={shieldPath} fill={`url(#${sheenId})`} />
        </g>

        {/* Metallic rim */}
        <path
          d={shieldPath}
          fill="none"
          stroke={accent}
          strokeWidth="2"
          strokeLinejoin="round"
        />
        <path
          d={shieldPath}
          fill="none"
          stroke="#ffffff"
          strokeOpacity="0.32"
          strokeWidth="0.75"
          strokeLinejoin="round"
        />

        {/* Apex pip */}
        <circle cx="20" cy="8.2" r="1.25" fill="#ffffff" fillOpacity="0.75" />

        <text
          x="20"
          y="22.5"
          textAnchor="middle"
          dominantBaseline="central"
          fill="#ffffff"
          fontSize={crestFontSize(code)}
          fontWeight="900"
          letterSpacing="-0.02em"
          fontFamily="var(--font-display), system-ui, sans-serif"
        >
          {code}
        </text>
      </svg>
    </span>
  );
}
