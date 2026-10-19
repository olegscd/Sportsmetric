import Link from "next/link";
import {
  CompetitionLine, LevelBadge, ResultHeadline, SourceLink,
} from "@/components/international/ResultParts";
import {
  REPRESENTATION_LABELS, athletePath,
  type IntlAthlete, type IntlCompetition, type IntlResult,
} from "@/lib/international";

function resultDateLabel(iso: string | null): string {
  if (!iso) return "Undated";
  return new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-PH", {
    day: "numeric", month: "short", year: "numeric", timeZone: "UTC",
  });
}

export function PlacementFeed({
  results,
  competitions,
  athletes,
}: {
  results: IntlResult[];
  competitions: Map<string, IntlCompetition>;
  athletes: Map<string, IntlAthlete>;
}) {
  return <ol className="list-none divide-y divide-border/60 overflow-hidden rounded-card border border-border/80 bg-surface shadow-card">
    {results.map(result => {
      const competition = competitions.get(result.competitionId);
      const athlete = athletes.get(result.athleteId);
      if (!competition || !athlete) return null;
      const date = result.resultDate ?? competition.endDate ?? competition.startDate;

      return <li key={result.id}
        className="grid gap-3 px-4 py-4 sm:grid-cols-[8rem_minmax(0,1fr)] lg:grid-cols-[8rem_minmax(0,1fr)_auto] lg:items-start">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 sm:flex-col sm:items-start">
          <time dateTime={date ?? undefined} className="text-xs font-semibold text-foreground">
            {resultDateLabel(date)}
          </time>
          <LevelBadge competition={competition} />
        </div>

        <div className="min-w-0 space-y-1">
          <p className="text-sm leading-snug text-foreground">
            <Link href={athletePath(athlete.id)} className="font-bold text-foreground hover:text-primary">
              {athlete.name}
            </Link>
            <span className="text-muted"> — </span>
            <ResultHeadline result={result} className="text-sm" />
          </p>
          <p className="text-sm text-foreground">
            {result.event}{result.scope ? <span className="text-muted"> · {result.scope}</span> : null}
          </p>
          <div className="flex flex-wrap items-center gap-x-1.5 text-xs text-muted">
            <span className="font-semibold text-foreground">
              {competition.name}{competition.season ? ` (${competition.season})` : ""}
            </span>
            <span aria-hidden="true">·</span>
            <CompetitionLine competition={competition} />
          </div>
          {result.notes ? <p className="text-xs leading-relaxed text-muted">{result.notes}</p> : null}
        </div>

        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 sm:col-span-2 lg:col-span-1 lg:flex-col lg:items-end lg:gap-1">
          <SourceLink url={result.sourceUrl} publisher={result.sourcePublisher} />
          <span className="text-2xs text-muted">
            {REPRESENTATION_LABELS[result.representation]}: {result.represented}
          </span>
        </div>
      </li>;
    })}
  </ol>;
}
