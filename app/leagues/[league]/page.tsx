import Link from "next/link";
import { notFound } from "next/navigation";
import { JsonLd } from "@/components/seo/JsonLd";
import { PAGE_FRAME } from "@/components/layout/page-shell";
import { EmptyState } from "@/components/ui/EmptyState";
import { GameCard } from "@/components/match-center/GameCard";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { TableShell, Td, Th } from "@/components/ui/Table";
import { findLeaguePage, LEAGUE_PAGES } from "@/lib/leagues";
import { getLeaguePageData } from "@/lib/public-page-data";
import { breadcrumbJsonLd, pageMetadata } from "@/lib/seo";
import { deriveStandings, getEffectiveGameStatus } from "@/lib/derivations";
import type { League } from "@/types/sports";

type Props = { params: Promise<{ league: string }> };

const LEAGUE_GLOW: Record<League, string> = {
  UAAP: "radial-gradient(ellipse 75% 65% at 100% 0%, rgb(204 0 0 / 0.18), transparent 60%)",
  PBA: "radial-gradient(ellipse 75% 65% at 100% 0%, rgb(247 148 29 / 0.18), transparent 60%)",
  PVL: "radial-gradient(ellipse 75% 65% at 100% 0%, rgb(0 102 204 / 0.2), transparent 60%)",
};

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

  return (
    <div className={PAGE_FRAME}>
      <JsonLd data={breadcrumbJsonLd([{ name: `${entry.league} scores and statistics`, path: `/leagues/${entry.slug}` }])} />
      <section
        className="scoreboard-hero rounded-panel border border-border/90 p-5 md:p-7"
        style={{ backgroundImage: `${LEAGUE_GLOW[entry.league]}, linear-gradient(160deg, rgb(20 28 42 / 0.95), rgb(13 19 30 / 0.98))` }}
      >
        <p className="eyebrow mb-2.5 flex items-center gap-2 text-primary">
          <span className="h-1.5 w-1.5 rounded-full bg-primary" aria-hidden="true" />
          {entry.name}
        </p>
        <h1 className="page-heading text-foreground">{entry.league} scores, standings and player stats</h1>
        <p className="mt-2.5 max-w-2xl text-sm leading-relaxed text-muted">{entry.description}</p>
        <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-border/75 pt-4">
          <nav aria-label="League pages" className="flex flex-wrap gap-2 text-xs font-semibold">
            {LEAGUE_PAGES.map(league => (
              <Link
                key={league.slug}
                href={`/leagues/${league.slug}`}
                aria-current={league.slug === entry.slug ? "page" : undefined}
                className={
                  league.slug === entry.slug
                    ? "inline-flex min-h-10 items-center rounded-full border border-primary/60 bg-primary/15 px-4 text-foreground"
                    : "inline-flex min-h-10 items-center rounded-full border border-border bg-surface-2/80 px-4 text-muted transition-colors hover:border-border-strong hover:text-foreground"
                }
              >
                {league.league}
              </Link>
            ))}
            {entry.league === "UAAP" && (
              <Link href="/uaap" className="inline-flex min-h-10 items-center rounded-full border border-archive/35 bg-archive/10 px-4 text-archive hover:bg-archive/15">
                Historical multi-sport archive
              </Link>
            )}
          </nav>
          {season && <p className="text-xs font-semibold text-muted">Season: <span className="text-foreground">{season.label}</span></p>}
        </div>
      </section>

      {!games.length && !standings.length ? <EmptyState title="No published season records yet" description="Scores, rosters and standings will appear here when they are available." /> : null}
      {[{ title: "Schedule and ongoing games", list: upcoming }, { title: "Recent results", list: results }].map(section => section.list.length > 0 && (
        <section key={section.title} className="space-y-4">
          <SectionHeading level={2} title={section.title} />
          <div className="grid gap-3.5 md:grid-cols-2 xl:grid-cols-3">{section.list.map(game => <GameCard key={game.id} game={game} />)}</div>
        </section>
      ))}
      {standings.length > 0 && (
        <section className="space-y-3">
          <SectionHeading
            level={2}
            title="Elimination-round team records"
            description="Win/loss records from completed elimination-round games in this season. Official final placements and tiebreaks can differ."
          />
          <TableShell>
            <table className="w-full text-left text-sm">
              <thead><tr><Th>Team</Th><Th numeric>Wins</Th><Th numeric>Losses</Th></tr></thead>
              <tbody>
                {standings.map(row => (
                  <tr key={row.team.id} className="transition-colors hover:bg-elevated/50">
                    <Td><Link href={`/teams/${encodeURIComponent(row.team.id)}`} className="font-semibold text-foreground hover:text-primary">{row.team.name}</Link></Td>
                    <Td numeric className="font-bold">{row.wins}</Td>
                    <Td numeric className="font-bold text-muted">{row.losses}</Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TableShell>
        </section>
      )}
      {players.length > 0 && (
        <section className="space-y-4">
          <SectionHeading level={2} title={`${entry.league} player profiles and statistics`} />
          <ul className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
            {players.map(player => (
              <li key={player.id}>
                <Link
                  href={`/players/${encodeURIComponent(player.id)}`}
                  className="block rounded-card border border-border/85 bg-surface/95 px-4 py-3 text-sm font-semibold text-foreground shadow-card transition-all hover:border-primary/45 hover:bg-elevated/60"
                >
                  {player.name}
                </Link>
              </li>
            ))}
          </ul>
          <Link href="/players" className="inline-flex min-h-11 items-center text-sm font-semibold text-primary hover:underline">Browse the full player directory</Link>
        </section>
      )}
    </div>
  );
}
