import Link from "next/link";
import { ChevronDown, Globe2 } from "lucide-react";
import { PAGE_FRAME } from "@/components/layout/page-shell";
import { PageHeading } from "@/components/ui/PageHeading";
import { EmptyState } from "@/components/ui/EmptyState";
import { Notice } from "@/components/ui/Notice";
import { JsonLd } from "@/components/seo/JsonLd";
import { AthleteDirectoryRow, AthleteSpotlightCard } from "@/components/international/AthleteSpotlight";
import { PlacementFeed } from "@/components/international/PlacementFeed";
import { getPublicInternationalData } from "@/lib/international-data";
import {
  COMPETITION_LEVELS, INTERNATIONAL_LAUNCHED, LEVEL_LABELS, MEDAL_POINTS,
  selectTopPerformers, sortResultsNewestFirst, type CompetitionLevel,
} from "@/lib/international";
import { breadcrumbJsonLd, pageMetadata } from "@/lib/seo";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

const TITLE = "Filipino Athletes Abroad & International Results";
const DESCRIPTION = "Source-backed international results of Filipino athletes: Olympic and world championship placements, regional games, world rankings and stats from foreign leagues.";
const RECENT_LIMIT = 12;

export function generateMetadata() {
  return pageMetadata(TITLE, DESCRIPTION, "/international", INTERNATIONAL_LAUNCHED);
}

const first = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value) ?? "";

function filterHref(sport: string, level: string) {
  const params = new URLSearchParams();
  if (sport) params.set("sport", sport);
  if (level) params.set("level", level);
  const query = params.toString();
  return query ? `/international?${query}` : "/international";
}

function Chip({ href, selected, children }: { href: string; selected: boolean; children: React.ReactNode }) {
  return <Link href={href} aria-current={selected ? "true" : undefined} scroll={false}
    className={cn("inline-flex min-h-11 shrink-0 items-center rounded-full border px-4 text-xs font-semibold transition-colors",
      selected ? "border-primary/60 bg-primary/15 text-foreground" : "border-border bg-surface/40 text-muted hover:border-primary/40 hover:text-foreground")}>
    {children}
  </Link>;
}

export default async function InternationalPage({ searchParams }: Props) {
  const params = await searchParams;
  const data = await getPublicInternationalData();
  const competitions = new Map(data.competitions.map(c => [c.id, c]));
  const athletes = new Map(data.athletes.map(a => [a.id, a]));

  const sports = [...new Set(data.competitions.map(c => c.sport))].sort();
  const levels = COMPETITION_LEVELS.filter(level => data.competitions.some(c => c.level === level));
  const sport = sports.includes(first(params.sport)) ? first(params.sport) : "";
  const level = (levels as string[]).includes(first(params.level)) ? first(params.level) as CompetitionLevel : "";

  const results = sortResultsNewestFirst(data.results.filter(r => {
    const c = competitions.get(r.competitionId);
    return c && (!sport || c.sport === sport) && (!level || c.level === level);
  }), competitions);
  const recent = results.slice(0, RECENT_LIMIT);
  const { top, rest } = selectTopPerformers(data.athletes, data.results, 10, competitions);

  return <div className={PAGE_FRAME}>
    <JsonLd data={breadcrumbJsonLd([{ name: "International", path: "/international" }])} />
    <PageHeading eyebrow="International" title="Filipinos on the world stage"
      description="Results of Filipino athletes competing abroad and for the Philippines, each linked to a public source." />

    {!INTERNATIONAL_LAUNCHED && <Notice tone="info" className="px-4 py-3 text-xs">
      Preview: this section is not yet listed in navigation or search results while profiles are being verified.
    </Notice>}

    {!data.athletes.length ? <EmptyState icon={<Globe2 size={20} aria-hidden="true" />} title="No verified profiles published yet"
      description="Athlete profiles appear here once their Filipino connection and results have been checked against public sources." /> : <>
      <section className="space-y-3" aria-labelledby="intl-top">
        <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-1">
          <div className="min-w-0">
            <h2 id="intl-top" className="text-lg font-bold text-foreground">Top performers</h2>
            <p className="text-xs leading-relaxed text-muted">
              Ranked by major-medal points — gold {MEDAL_POINTS.gold}, silver {MEDAL_POINTS.silver}, bronze {MEDAL_POINTS.bronze}. Ties break on golds, then podiums.
            </p>
          </div>
          <span className="text-2xs font-semibold uppercase tracking-wide text-muted">
            {top.length} of {data.athletes.length} athletes
          </span>
        </div>

        {top.length ? <ul className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {top.map((performance, index) => <AthleteSpotlightCard key={performance.athlete.id}
            performance={performance} rank={index + 1} competitions={competitions} />)}
        </ul> : <EmptyState title="No ranked performances yet"
          description="Profiles appear in this ranking once they have a published international result." />}

        {rest.length > 0 && <details className="group rounded-card border border-border/70 bg-surface/60">
          <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 text-sm font-semibold text-foreground [&::-webkit-details-marker]:hidden">
            <span className="flex items-center gap-2">
              <ChevronDown size={14} aria-hidden="true" className="text-muted transition-transform group-open:rotate-180" />
              More athletes
            </span>
            <span className="text-2xs font-medium text-muted">{rest.length} profile{rest.length === 1 ? "" : "s"}</span>
          </summary>
          <ul className="grid gap-2 border-t border-border/60 p-3 sm:grid-cols-2 lg:grid-cols-3">
            {rest.map(performance => <AthleteDirectoryRow key={performance.athlete.id} performance={performance} />)}
          </ul>
        </details>}
      </section>

      <section className="space-y-3" aria-labelledby="intl-results">
        <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-1">
          <div className="min-w-0">
            <h2 id="intl-results" className="text-lg font-bold text-foreground">Recent placements &amp; updates</h2>
            <p className="text-xs leading-relaxed text-muted">Newest source-verified results first. Filters apply to this feed.</p>
          </div>
          {results.length > 0 && <span className="text-2xs font-semibold uppercase tracking-wide text-muted">
            Showing {recent.length} of {results.length}
          </span>}
        </div>

        {(sports.length > 1 || levels.length > 1) && <nav aria-label="Filter recent placements" className="space-y-2">
          {sports.length > 1 && <div className="h-scroll flex gap-2 overflow-x-auto pb-1">
            <Chip href={filterHref("", level)} selected={!sport}>All sports</Chip>
            {sports.map(s => <Chip key={s} href={filterHref(s, level)} selected={sport === s}>{s}</Chip>)}
          </div>}
          {levels.length > 1 && <div className="h-scroll flex gap-2 overflow-x-auto pb-1">
            <Chip href={filterHref(sport, "")} selected={!level}>All levels</Chip>
            {levels.map(l => <Chip key={l} href={filterHref(sport, l)} selected={level === l}>{LEVEL_LABELS[l]}</Chip>)}
          </div>}
        </nav>}

        {!recent.length ? <EmptyState
          title={sport || level ? "No results for this filter" : "No published placements yet"}
          description={sport || level ? "Try another sport or competition level." : "Placements appear here once they have been checked against a public source."} /> :
          <PlacementFeed results={recent} competitions={competitions} athletes={athletes} />}
      </section>
    </>}

    <section className="max-w-3xl space-y-2 text-xs leading-6 text-muted">
      <h2 className="text-sm font-bold text-foreground">About this coverage</h2>
      <p>Each athlete&apos;s Filipino connection (citizenship, naturalization or heritage) is cited separately from the country or club they represented in a given event. World rankings, placements, marks and season statistics are labelled by type and are not combined into career totals. Coverage is selective: a missing result does not mean an event did not happen.</p>
    </section>
  </div>;
}
