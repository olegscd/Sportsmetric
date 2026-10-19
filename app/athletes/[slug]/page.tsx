import Link from "next/link";
import { notFound } from "next/navigation";
import { cache } from "react";
import { PAGE_FRAME } from "@/components/layout/page-shell";
import { PageHeading } from "@/components/ui/PageHeading";
import { EmptyState } from "@/components/ui/EmptyState";
import { StatTile } from "@/components/ui/StatTile";
import { Notice } from "@/components/ui/Notice";
import { TableShell, Td, Th } from "@/components/ui/Table";
import { JsonLd } from "@/components/seo/JsonLd";
import { CompetitionLine, LevelBadge, ResultHeadline, SourceLink } from "@/components/international/ResultParts";
import { getPublicAthleteProfile } from "@/lib/international-data";
import {
  CONNECTION_LABELS, INTERNATIONAL_LAUNCHED, REPRESENTATION_LABELS, athletePath, medalCount,
  resultSortKey, sortResultsNewestFirst,
} from "@/lib/international";
import { absoluteUrl, breadcrumbJsonLd, pageMetadata } from "@/lib/seo";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ slug: string }> };

const load = cache(async (slug: string) => {
  const profile = await getPublicAthleteProfile(slug);
  if (!profile) notFound();
  return profile;
});

export async function generateMetadata({ params }: Props) {
  const { slug } = await params;
  const { athlete, results } = await load(slug);
  const sports = athlete.sports.join(", ");
  return pageMetadata(`${athlete.name} International Results${sports ? ` — ${sports}` : ""}`,
    `${athlete.name}'s international results${sports ? ` in ${sports}` : ""}: ${results.length} source-backed placement${results.length === 1 ? "" : "s"}, marks, rankings and season stats on Sportsmetric.`,
    athletePath(athlete.id), INTERNATIONAL_LAUNCHED && results.length > 0);
}

function reviewedLabel(iso: string | null) {
  return iso ? new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-PH", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }) : null;
}

export default async function AthletePage({ params }: Props) {
  const { slug } = await params;
  const { athlete, results, competitions: list, leaguePlayerId } = await load(slug);
  const competitions = new Map(list.map(c => [c.id, c]));
  const sorted = sortResultsNewestFirst(results, competitions);
  const medals = medalCount(results);
  const path = athletePath(athlete.id);

  // Group by year so long careers stay scannable.
  const byYear = new Map<string, typeof sorted>();
  for (const r of sorted) {
    const year = resultSortKey(r, competitions.get(r.competitionId)).slice(0, 4) || "Undated";
    byYear.set(year, [...(byYear.get(year) ?? []), r]);
  }

  return <div className={PAGE_FRAME}>
    <JsonLd data={{ "@context": "https://schema.org", "@type": "Person", name: athlete.name, url: absoluteUrl(path),
      ...(athlete.sports.length ? { knowsAbout: athlete.sports } : {}) }} />
    <JsonLd data={breadcrumbJsonLd([{ name: "International", path: "/international" }, { name: athlete.name, path }])} />

    <nav aria-label="Breadcrumb" className="text-xs text-muted">
      <Link href="/international" className="font-semibold text-primary hover:underline">International</Link> / {athlete.name}
    </nav>
    <PageHeading eyebrow={athlete.sports.join(" · ") || "International"} title={athlete.name}
      description={athlete.bio ?? `International results for ${athlete.name}, each linked to its public source.`} />

    {!INTERNATIONAL_LAUNCHED && <Notice tone="info" className="px-4 py-3 text-xs">Preview: this profile is not yet listed in search results.</Notice>}

    <section aria-label="Filipino connection" className="flex flex-wrap items-center gap-x-4 gap-y-1 rounded-card border border-border/80 bg-surface px-4 py-3 text-sm">
      <span className="font-semibold text-foreground">{CONNECTION_LABELS[athlete.filipinoConnection]}</span>
      {athlete.connectionNote && <span className="text-muted">{athlete.connectionNote}</span>}
      <SourceLink url={athlete.connectionSourceUrl} />
      {leaguePlayerId && <Link href={`/players/${encodeURIComponent(leaguePlayerId)}`} className="ml-auto inline-flex min-h-8 items-center text-xs font-semibold text-primary hover:underline">Philippine league profile</Link>}
    </section>

    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
      <StatTile label="Results" value={results.length} />
      <StatTile label="Gold" value={medals.gold} tone={medals.gold ? "archive" : "default"} />
      <StatTile label="Silver" value={medals.silver} />
      <StatTile label="Bronze" value={medals.bronze} />
    </div>

    {!sorted.length ? <EmptyState title="No published results yet" description="Results appear once they have been checked against a public source." /> :
      [...byYear].map(([year, rows]) => <section key={year} className="space-y-2" aria-labelledby={`y-${year}`}>
        <h2 id={`y-${year}`} className="text-lg font-bold text-foreground">{year}</h2>
        <TableShell>
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead><tr><Th>Competition</Th><Th>Event</Th><Th>Representing</Th><Th>Result</Th><Th>Source</Th></tr></thead>
            <tbody>{rows.map(r => {
              const c = competitions.get(r.competitionId)!;
              return <tr key={r.id} className="border-b border-border/50 last:border-0 align-top">
                <Td><div className="flex flex-col gap-1"><span className="font-semibold text-foreground">{c.name}{c.season ? ` (${c.season})` : ""}</span>
                  <span className="flex flex-wrap items-center gap-2"><LevelBadge competition={c} /><CompetitionLine competition={c} /></span></div></Td>
                <Td><span className="text-foreground">{r.event}</span>{r.scope && <span className="block text-xs text-muted">{r.scope}</span>}</Td>
                <Td><span className="text-foreground">{r.represented}</span><span className="block text-xs text-muted">{REPRESENTATION_LABELS[r.representation]}</span></Td>
                <Td><ResultHeadline result={r} />{r.notes && <span className="block max-w-xs text-xs text-muted">{r.notes}</span>}</Td>
                <Td><SourceLink url={r.sourceUrl} publisher={r.sourcePublisher} />{r.reviewedAt && <span className="block text-2xs text-muted">Checked {reviewedLabel(r.reviewedAt)}</span>}</Td>
              </tr>;
            })}</tbody>
          </table>
        </TableShell>
      </section>)}

    <section className="max-w-3xl space-y-2 text-xs leading-6 text-muted">
      <h2 className="text-sm font-bold text-foreground">Coverage notes</h2>
      {athlete.coverageNote && <p>{athlete.coverageNote}</p>}
      <p>This profile lists selected international results; it is not a complete career record. Rankings, placements and season statistics are shown as published by each source and are not combined into totals.{athlete.reviewedAt ? ` Profile last reviewed ${reviewedLabel(athlete.reviewedAt)}.` : ""}</p>
    </section>
  </div>;
}
