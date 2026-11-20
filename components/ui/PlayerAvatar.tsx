"use client";

import { safeImageSource } from "@/lib/image-policy";
import { cn } from "@/lib/utils";
import type { Player } from "@/types/sports";
import Image from "next/image";
import { useId, useState } from "react";

const SIZE_CLASSES = {
  sm: "h-7 w-7 text-3xs",
  md: "h-11 w-11 text-xs",
  lg: "h-16 w-16 text-base",
  xl: "h-24 w-24 text-lg",
} as const;

const SIZE_PX = { sm: 28, md: 44, lg: 64, xl: 96 } as const;

function initialsOf(name: string): string {
  return name
    .split(" ")
    .filter(Boolean)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

interface PlayerAvatarProps {
  player: Pick<Player, "name" | "photoUrl">;
  accentColor: string;
  size?: keyof typeof SIZE_CLASSES;
  className?: string;
}

export function PlayerAvatar({ player, accentColor, size = "md", className }: PlayerAvatarProps) {
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  const uid = useId().replace(/:/g, "");

  const photoSrc = safeImageSource(player.photoUrl);
  const imageFailed = Boolean(photoSrc && failedUrl === photoSrc);
  const accent = accentColor || "#ef4444";

  if (photoSrc && !imageFailed) {
    return (
      <Image
        width={SIZE_PX[size]}
        height={SIZE_PX[size]}
        sizes={`${SIZE_PX[size]}px`}
        src={photoSrc}
        alt={player.name}
        onError={() => setFailedUrl(photoSrc)}
        className={cn(
          "shrink-0 rounded-full border-2 bg-surface object-cover shadow-md",
          SIZE_CLASSES[size],
          className
        )}
        style={{
          borderColor: accent,
          boxShadow: `0 0 18px -6px ${accent}`,
        }}
      />
    );
  }

  const initials = initialsOf(player.name) || "PL";
  const bgId = `pa-bg-${uid}`;

  return (
    <div
      className={cn(
        "relative flex shrink-0 select-none items-center justify-center overflow-hidden rounded-full border-2 bg-surface shadow-md",
        SIZE_CLASSES[size],
        className
      )}
      style={{
        borderColor: accent,
        boxShadow: `inset 0 1px 0 rgba(255,255,255,0.16), 0 0 16px -6px ${accent}`,
      }}
    >
      <svg viewBox="0 0 48 48" className="h-full w-full" aria-hidden="true">
        <defs>
          <radialGradient id={bgId} cx="50%" cy="22%" r="75%">
            <stop offset="0%" stopColor={accent} stopOpacity="0.45" />
            <stop offset="100%" stopColor="#090e1a" stopOpacity="1" />
          </radialGradient>
        </defs>
        <rect width="48" height="48" fill={`url(#${bgId})`} />
        {/* Stylized athletic jersey bust */}
        <circle cx="24" cy="17.5" r="7" fill="#e2e8f0" fillOpacity="0.22" />
        <path
          d="M9 46 C9.5 34 15.5 28.5 24 28.5 C32.5 28.5 38.5 34 39 46 Z"
          fill={accent}
          fillOpacity="0.42"
        />
        <path
          d="M17.5 29.2 L24 34.5 L30.5 29.2"
          fill="none"
          stroke="#ffffff"
          strokeOpacity="0.55"
          strokeWidth="1.6"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      <span className="font-display absolute inset-x-0 bottom-1 text-center font-extrabold leading-none tracking-tight text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.9)]">
        {initials}
      </span>
    </div>
  );
}
