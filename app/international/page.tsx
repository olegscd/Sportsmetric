import Link from "next/link";
import { Globe2, Medal as MedalIcon } from "lucide-react";
import { PAGE_FRAME } from "@/components/layout/page-shell";
import { PageHeading } from "@/components/ui/PageHeading";
import { EmptyState } from "@/components/ui/EmptyState";
import { Notice } from "@/components/ui/Notice";
import { Badge } from "@/components/ui/Badge";
import { JsonLd } from "@/components/seo/JsonLd";
import { CompetitionLine, LevelBadge, ResultHeadline, SourceLink } from "@/components/international/ResultParts";
import { getPublicInternationalData } from "@/lib/international-data";
import {
  CONNECTION_LABELS, COMPETITION_LEVELS, INTERNATIONAL_LAUNCHED, LEVEL_LABELS, REPRESENTATION_LABELS,
  athletePath, medalCount, sortResultsNewestFirst, type CompetitionLevel,
} from "@/lib/international";
import { breadcrumbJsonLd, pageMetadata } from "@/lib/seo";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

const TITLE = "Filipino Athletes Abroad & International Results";
const DESCRIPTION = "Source-backed international results of Filipino athletes: Olympic and world championship placements, regional games, world rankings and stats from foreign leagues.";

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
  const visibleAthleteIds = new Set(results.map(r => r.athleteId));
  const athleteList = data.athletes.filter(a => (!sport && !level) || visibleAthleteIds.has(a.id) || (!level && a.sports.includes(sport)));

  return <div className={PAGE_FRAME}>
    <JsonLd data={breadcrumbJsonLd([{ name: "International", path: "/international" }])} />
    <PageHeading eyebrow="International" title="Filipinos on the world stage"
      description="Results of Filipino athletes competing abroad and for the Philippines, each linked to a public source." />

    {!INTERNATIONAL_LAUNCHED && <Notice tone="info" className="px-4 py-3 text-xs">
      Preview: this section is not yet listed in navigation or search results while profiles are being verified.
    </Notice>}

    {!data.athletes.length ? <EmptyState icon={<Globe2 size={20} aria-hidden="true" />} title="No verified profiles published yet"
      description="Athlete profiles appear here once their Filipino connection and results have been checked against public sources." /> : <>
      {(sports.length > 1 || levels.length > 1) && <nav aria-label="Filter international results" className="space-y-2">
        {sports.length > 1 && <div className="h-scroll flex gap-2 overflow-x-auto pb-1">
          <Chip href={filterHref("", level)} selected={!sport}>All sports</Chip>
          {sports.map(s => <Chip key={s} href={filterHref(s, level)} selected={sport === s}>{s}</Chip>)}
        </div>}
        {levels.length > 1 && <div className="h-scroll flex gap-2 overflow-x-auto pb-1">
          <Chip href={filterHref(sport, "")} selected={!level}>All levels</Chip>
          {levels.map(l => <Chip key={l} href={filterHref(sport, l)} selected={level === l}>{LEVEL_LABELS[l]}</Chip>)}
        </div>}
      </nav>}

      <section className="space-y-3" aria-labelledby="intl-results">
        <h2 id="intl-results" className="text-lg font-bold text-foreground">Latest results</h2>
        {!results.length ? <EmptyState title="No results for this filter" description="Try another sport or competition level." /> :
          <ul className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {results.slice(0, 30).map(r => {
              const c = competitions.get(r.competitionId)!;
              const a = athletes.get(r.athleteId)!;
              return <li key={r.id} className="flex min-w-0 flex-col gap-2 rounded-card border border-border/80 bg-surface p-4 shadow-card">
                <div className="flex items-start justify-between gap-2">
                  <Link href={athletePath(a.id)} className="min-w-0 truncate text-sm font-bold text-foreground hover:text-primary">{a.name}</Link>
                  <LevelBadge competition={c} />
                </div>
                <p className="text-sm text-foreground"><ResultHeadline result={r} className="text-base" /></p>
                <p className="text-xs leading-relaxed text-muted">
                  <span className="font-semibold text-foreground">{r.event}</span>{r.scope ? ` · ${r.scope}` : ""}<br />
                  {c.name}{c.season ? ` (${c.season})` : ""}<br />
                  <CompetitionLine competition={c} />
                </p>
                <div className="mt-auto flex flex-wrap items-center justify-between gap-2 border-t border-border/60 pt-2">
                  <span className="text-2xs text-muted">{REPRESENTATION_LABELS[r.representation]}: {r.represented}</span>
                  <SourceLink url={r.sourceUrl} publisher={r.sourcePublisher} />
                </div>
              </li>;
            })}
          </ul>}
      </section>

      <section className="space-y-3" aria-labelledby="intl-athletes">
        <h2 id="intl-athletes" className="text-lg font-bold text-foreground">Athletes</h2>
        <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {athleteList.map(a => {
            const own = data.results.filter(r => r.athleteId === a.id);
            const medals = medalCount(own);
            const medalTotal = medals.gold + medals.silver + medals.bronze;
            return <li key={a.id}>
              <Link href={athletePath(a.id)} className="flex min-h-16 flex-col gap-1 rounded-control border border-border bg-surface px-4 py-3 hover:border-primary/40">
                <span className="text-sm font-bold text-foreground">{a.name}</span>
                <span className="flex flex-wrap items-center gap-1.5 text-2xs text-muted">
                  {a.sports.join(", ") || "—"} · {CONNECTION_LABELS[a.filipinoConnection]}
                  {medalTotal > 0 && <Badge tone="archive" icon={<MedalIcon size={10} aria-hidden="true" />}>{medalTotal} medal{medalTotal === 1 ? "" : "s"}</Badge>}
                  <span>{own.length} result{own.length === 1 ? "" : "s"}</span>
                </span>
              </Link>
            </li>;
          })}
        </ul>
      </section>
    </>}

    <section className="max-w-3xl space-y-2 text-xs leading-6 text-muted">
      <h2 className="text-sm font-bold text-foreground">About this coverage</h2>
      <p>Each athlete&apos;s Filipino connection (citizenship, naturalization or heritage) is cited separately from the country or club they represented in a given event. World rankings, placements, marks and season statistics are labelled by type and are not combined into career totals. Coverage is selective: a missing result does not mean an event did not happen.</p>
    </section>
  </div>;
}
