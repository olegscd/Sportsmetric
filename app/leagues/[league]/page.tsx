import Link from "next/link";
import { notFound } from "next/navigation";
import { JsonLd } from "@/components/seo/JsonLd";
import { PAGE_FRAME } from "@/components/layout/page-shell";
import { PageHeading } from "@/components/ui/PageHeading";
import { EmptyState } from "@/components/ui/EmptyState";
import { GameCard } from "@/components/match-center/GameCard";
import { TableShell, Td, Th } from "@/components/ui/Table";
import { findLeaguePage, LEAGUE_PAGES } from "@/lib/leagues";
import { getLeaguePageData } from "@/lib/public-page-data";
import { breadcrumbJsonLd, pageMetadata } from "@/lib/seo";
import { deriveStandings, getEffectiveGameStatus } from "@/lib/derivations";

type Props = { params: Promise<{ league: string }> };

export async function generateMetadata({ params }: Props) {
  const entry = findLeaguePage((await params).league);
  if (!entry) notFound();
  return pageMetadata(`${entry.league} ${entry.sport} Scores, Standings & Player Stats`, entry.description, `/leagues/${entry.slug}`);
}

export default async function LeaguePage({ params }: Props) {
  const entry = findLeaguePage((await params).league);
  if (!entry) notFound();
  const data = await getLeaguePageData(entry.league);
  const season = data.seasons.find(season => season.league === entry.league && season.isCurrent) ?? data.seasons.find(season => season.league === entry.league);
  const games = data.games.filter(game => game.league === entry.league && game.seasonId === season?.id);
  const upcoming = games.filter(game => getEffectiveGameStatus(game) !== "FINAL").sort((a, b) => a.startTime.localeCompare(b.startTime)).slice(0, 8);
  const results = games.filter(game => getEffectiveGameStatus(game) === "FINAL").sort((a, b) => b.startTime.localeCompare(a.startTime)).slice(0, 8);
  const standings = season ? deriveStandings(data.teams, games, entry.league, season.id) : [];
  const players = data.players.filter(player => player.seasonId === season?.id).slice(0, 24);

  return <div className={PAGE_FRAME}>
    <JsonLd data={breadcrumbJsonLd([{ name: `${entry.league} scores and statistics`, path: `/leagues/${entry.slug}` }])} />
    <PageHeading title={`${entry.league} scores, standings and player stats`} eyebrow={entry.name} description={entry.description} />
    <nav aria-label="League pages" className="flex flex-wrap gap-3 text-sm font-semibold">
      {LEAGUE_PAGES.map(league => <Link key={league.slug} href={`/leagues/${league.slug}`} aria-current={league.slug === entry.slug ? "page" : undefined}
        className="inline-flex min-h-11 items-center rounded-control border border-border bg-surface px-4 text-foreground hover:border-primary/40">{league.league}</Link>)}
      {entry.league === "UAAP" && <Link href="/uaap" className="inline-flex min-h-11 items-center px-2 text-primary">Historical multi-sport archive</Link>}
    </nav>
    {season && <p className="text-sm font-semibold text-muted">Season: {season.label}</p>}
    {!games.length && !standings.length ? <EmptyState title="No published season records yet" description="Scores, rosters and standings will appear here when they are available." /> : null}
    {[{ title: "Schedule and ongoing games", list: upcoming }, { title: "Recent results", list: results }].map(section => section.list.length > 0 && <section key={section.title} className="space-y-4">
      <h2 className="text-lg font-bold text-foreground">{section.title}</h2>
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">{section.list.map(game => <GameCard key={game.id} game={game} />)}</div>
    </section>)}
    {standings.length > 0 && <section className="space-y-3">
      <h2 className="text-lg font-bold text-foreground">Elimination-round team records</h2>
      <p className="text-xs text-muted">Win/loss records from completed elimination-round games in this season. Official final placements and tiebreaks can differ.</p>
      <TableShell><table className="w-full text-left text-sm"><thead><tr><Th>Team</Th><Th numeric>Wins</Th><Th numeric>Losses</Th></tr></thead>
        <tbody>{standings.map(row => <tr key={row.team.id}><Td><Link href={`/teams/${encodeURIComponent(row.team.id)}`} className="font-semibold text-foreground hover:text-primary">{row.team.name}</Link></Td><Td numeric>{row.wins}</Td><Td numeric>{row.losses}</Td></tr>)}</tbody>
      </table></TableShell>
    </section>}
    {players.length > 0 && <section className="space-y-4"><h2 className="text-lg font-bold text-foreground">{entry.league} player profiles and statistics</h2>
      <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">{players.map(player => <li key={player.id}><Link href={`/players/${encodeURIComponent(player.id)}`} className="block rounded-control border border-border bg-surface px-4 py-3 text-sm font-semibold text-foreground hover:border-primary/40">{player.name}</Link></li>)}</ul>
      <Link href="/players" className="inline-flex min-h-11 items-center text-sm font-semibold text-primary">Browse the full player directory</Link>
    </section>}
  </div>;
}
