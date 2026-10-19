import { Badge } from "@/components/ui/Badge";
import { cn } from "@/lib/utils";
import {
  LEVEL_LABELS, competitionDateLabel, formatResultHeadline, sourceHost,
  type IntlCompetition, type IntlResult, type Medal,
} from "@/lib/international";
import { ExternalLink } from "lucide-react";

const MEDAL_CLASSES: Record<Medal, string> = {
  gold: "text-archive",
  silver: "text-muted",
  bronze: "text-[#d08b4f]",
};

export function ResultHeadline({ result, className }: { result: IntlResult; className?: string }) {
  return <span className={cn("font-bold tabular-nums", result.medal ? MEDAL_CLASSES[result.medal] : "text-foreground", className)}>
    {formatResultHeadline(result)}
  </span>;
}

export function LevelBadge({ competition }: { competition: IntlCompetition }) {
  return <Badge tone={competition.level === "olympics" || competition.level === "world_championship" ? "archive" : "outline"}>
    {LEVEL_LABELS[competition.level]}
  </Badge>;
}

export function SourceLink({ url, publisher, className }: { url: string; publisher?: string | null; className?: string }) {
  return <a href={url} target="_blank" rel="noopener noreferrer nofollow"
    className={cn("inline-flex min-h-8 items-center gap-1 text-xs font-semibold text-primary hover:underline", className)}>
    {publisher || sourceHost(url)}
    <ExternalLink size={11} aria-hidden="true" />
    <span className="sr-only">(opens in a new tab)</span>
  </a>;
}

export function CompetitionLine({ competition }: { competition: IntlCompetition }) {
  const date = competitionDateLabel(competition);
  return <span className="text-xs text-muted">
    {[competition.hostCountry, date].filter(Boolean).join(" · ")}
  </span>;
}
