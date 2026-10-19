import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { PlayerAvatar } from "@/components/ui/PlayerAvatar";
import { CompetitionLine, MedalGrid, MedalStrip, ResultHeadline } from "@/components/international/ResultParts";
import { athletePath, type AthletePerformance, type IntlCompetition } from "@/lib/international";
import { cn } from "@/lib/utils";

const RANK_ACCENT = ["var(--color-archive)", "var(--color-muted)", "#d08b4f"] as const;
const RANK_BADGE = [
  "border-archive/60 bg-archive/15 text-archive",
  "border-border-strong bg-elevated text-muted",
  "border-[#d08b4f]/60 bg-[#d08b4f]/15 text-[#d08b4f]",
] as const;
const RANK_BORDER = ["border-archive/45", "border-border-strong", "border-[#d08b4f]/45"] as const;

export function AthleteSpotlightCard({
  performance,
  rank,
  competitions,
}: {
  performance: AthletePerformance;
  rank: number;
  competitions: Map<string, IntlCompetition>;
}) {
  const { athlete, medals, results, bestResult, medalPoints } = performance;
  const bestCompetition = bestResult ? competitions.get(bestResult.competitionId) : undefined;
  const resultLabel = `${results.length} result${results.length === 1 ? "" : "s"}`;
  const photoAttribution = athlete.photoUrl && athlete.photoCredit && athlete.photoLicense
    ? { credit: athlete.photoCredit, license: athlete.photoLicense, source: athlete.photoSourceUrl }
    : null;

  return <li className="flex min-w-0 flex-col gap-1.5">
    <Link href={athletePath(athlete.id)}
      className={cn("group relative flex min-w-0 flex-1 flex-col gap-3 overflow-hidden rounded-card border bg-surface p-4 shadow-card transition-colors hover:bg-surface-2/40 hover:border-border-strong",
        RANK_BORDER[rank - 1] ?? "border-border/80")}>
      <ChevronRight size={16} aria-hidden="true"
        className="absolute right-4 top-4 text-muted transition-transform group-hover:translate-x-0.5 group-hover:text-primary" />

      <div className="flex items-start gap-3 pr-6">
        <div className="relative shrink-0">
          <PlayerAvatar player={photoAttribution ? athlete : { name: athlete.name, photoUrl: null }}
            size="lg" accentColor={RANK_ACCENT[rank - 1] ?? "var(--color-border-strong)"} />
          <span aria-hidden="true"
            className={cn("absolute -left-1.5 -top-1.5 flex h-5 min-w-5 items-center justify-center rounded-full border px-1 text-3xs font-black tabular-nums",
              RANK_BADGE[rank - 1] ?? "border-border bg-elevated text-foreground")}>
            {rank}
          </span>
          <span className="sr-only">Rank {rank}. </span>
        </div>
        <span className="min-w-0 flex-1 pt-0.5">
          <span className="block truncate text-base font-bold text-foreground transition-colors group-hover:text-primary">
            {athlete.name}
          </span>
          <span className="mt-0.5 block truncate text-2xs font-semibold uppercase tracking-wide text-muted">
            {athlete.sports.join(" · ") || "International"}
          </span>
        </span>
      </div>

      <MedalGrid medals={medals} />

      {bestResult && bestCompetition ? <div className="mt-auto rounded-control border border-border/60 bg-elevated/40 px-3 py-2">
        <span className="text-2xs font-semibold uppercase tracking-wide text-muted">Top result</span>
        <p className="mt-1 text-sm leading-snug text-foreground">
          <ResultHeadline result={bestResult} /> <span className="font-normal text-muted">· {bestResult.event}</span>
        </p>
        <p className="mt-0.5 text-2xs text-muted">
          {bestCompetition.name}{bestCompetition.season ? ` (${bestCompetition.season})` : ""}
        </p>
        <CompetitionLine competition={bestCompetition} />
      </div> : <p className="mt-auto text-xs text-muted">No published results yet.</p>}

      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 border-t border-border/60 pt-2 text-2xs">
        <span className="font-semibold text-muted">{resultLabel} · {medalPoints} medal pts</span>
        <span className="font-bold text-primary">View profile</span>
      </div>
    </Link>
    {photoAttribution && <p className="px-1 text-3xs leading-relaxed text-muted">
      Photo: {photoAttribution.credit} · {photoAttribution.license}
      {photoAttribution.source ? <> · <a href={photoAttribution.source} target="_blank" rel="noopener noreferrer"
        className="font-semibold text-primary hover:underline">source<span className="sr-only"> (opens in a new tab)</span></a></> : null}
    </p>}
  </li>;
}

export function AthleteDirectoryRow({ performance }: { performance: AthletePerformance }) {
  const { athlete, medals, results } = performance;
  return <li className="min-w-0">
    <Link href={athletePath(athlete.id)}
      className="flex min-h-14 min-w-0 items-center justify-between gap-3 rounded-control border border-border bg-surface px-3 py-2.5 transition-colors hover:border-primary/40 hover:bg-surface-2/40">
      <span className="min-w-0">
        <span className="block truncate text-sm font-bold text-foreground">{athlete.name}</span>
        <span className="block truncate text-2xs text-muted">
          {athlete.sports.join(" · ") || "International"} · {results.length} result{results.length === 1 ? "" : "s"}
        </span>
      </span>
      <MedalStrip medals={medals} className="shrink-0" />
    </Link>
  </li>;
}
