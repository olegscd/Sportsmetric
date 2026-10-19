import { Badge } from "@/components/ui/Badge";
import type { RankBadge as RankBadgeType } from "@/types/sports";
import { Award } from "lucide-react";

export function RankBadge({
  badge,
  index = 1,
  compact = false,
}: {
  badge: RankBadgeType;
  index?: number;
  compact?: boolean;
}) {
  return (
    <Badge
      tone={index === 0 ? "archive" : "neutral"}
      size={compact ? "sm" : "md"}
      icon={<Award size={compact ? 10 : 12} aria-hidden="true" />}
    >
      {badge.label}
    </Badge>
  );
}
