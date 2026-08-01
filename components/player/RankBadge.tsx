import { cn } from "@/lib/utils";
import type { RankBadge as RankBadgeType } from "@/types/sports";
import { Award } from "lucide-react";

export function RankBadge({
  badge,
  compact = false,
}: {
  badge: RankBadgeType;
  compact?: boolean;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border border-primary/40 bg-primary/10 font-semibold text-primary",
        compact ? "px-1.5 py-0.5 text-[10px]" : "px-2.5 py-1 text-xs"
      )}
    >
      <Award size={compact ? 10 : 12} />
      {badge.label}
    </span>
  );
}
