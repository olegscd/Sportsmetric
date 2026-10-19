"use client";

import { cn } from "@/lib/utils";
import type { Player } from "@/types/sports";
import { useState } from "react";
import Image from "next/image";
import { safeImageSource } from "@/lib/image-policy";

const SIZE_CLASSES = {
  sm: "h-7 w-7 text-3xs",
  md: "h-10 w-10 text-xs",
  lg: "h-16 w-16 text-base",
  xl: "h-24 w-24 text-lg",
} as const;

const SIZE_PX = { sm: 28, md: 40, lg: 64, xl: 96 } as const;

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

  const photoSrc = safeImageSource(player.photoUrl);

  const imageFailed = Boolean(photoSrc && failedUrl === photoSrc);

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
          "shrink-0 rounded-full border-2 bg-surface object-cover",
          SIZE_CLASSES[size],
          className
        )}
        style={{ borderColor: accentColor }}
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
      style={{ borderColor: accentColor, color: accentColor }}
    >
      {initialsOf(player.name)}
    </div>
  );
}
