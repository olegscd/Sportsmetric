import Link from "next/link";
import { PAGE_SHELL } from "./page-shell";
import { LEAGUE_PAGES } from "@/lib/leagues";

export function SiteFooter() {
  return <footer className="mt-8 border-t border-border bg-surface/40 py-7">
    <div className={`${PAGE_SHELL} flex flex-col gap-5 md:flex-row md:items-start md:justify-between`}>
      <div className="max-w-lg">
        <p className="text-sm font-bold text-foreground">Sportsmetric</p>
        <p className="mt-2 text-xs leading-relaxed text-muted">Philippine sports, athlete performance and the records behind every achievement. Scores, player statistics and sports history in one place.</p>
      </div>
      <nav aria-label="Explore sports" className="flex flex-wrap gap-x-5 gap-y-2 text-xs font-semibold text-muted">
        {LEAGUE_PAGES.map(item => <Link key={item.slug} href={`/leagues/${item.slug}`} className="inline-flex min-h-11 items-center hover:text-foreground">{item.league} scores &amp; stats</Link>)}
        <Link href="/uaap" className="inline-flex min-h-11 items-center hover:text-foreground">UAAP history</Link>
        <Link href="/about" className="inline-flex min-h-11 items-center hover:text-foreground">About Sportsmetric</Link>
      </nav>
    </div>
  </footer>;
}
