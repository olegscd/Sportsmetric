"use client";

import { cn } from "@/lib/utils";
import type { Player } from "@/types/sports";
import { useEffect, useState } from "react";

const SIZE_CLASSES = {
  sm: "h-7 w-7 text-[10px]",
  md: "h-10 w-10 text-xs",
  lg: "h-16 w-16 text-base",
} as const;

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
  const [imageFailed, setImageFailed] = useState(false);

  useEffect(() => {
    setImageFailed(false);
  }, [player.photoUrl]);

  const rawPhoto = player.photoUrl?.trim();
  let photoSrc: string | null = null;
  if (rawPhoto) {
    if (
      rawPhoto.startsWith("http://") ||
      rawPhoto.startsWith("https://") ||
      rawPhoto.startsWith("/") ||
      rawPhoto.startsWith("data:")
    ) {
      photoSrc = rawPhoto;
    } else if (rawPhoto.includes(".")) {
      photoSrc = `https://${rawPhoto}`;
    } else {
      photoSrc = `/${rawPhoto}`;
    }
  }

  if (photoSrc && !imageFailed) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={photoSrc}
        alt={player.name}
        onError={() => setImageFailed(true)}
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
