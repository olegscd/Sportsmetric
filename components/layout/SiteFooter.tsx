import { BrandMark } from "@/components/layout/BrandMark";
import Link from "next/link";
import { PAGE_SHELL } from "./page-shell";
import { LEAGUE_PAGES } from "@/lib/leagues";

export function SiteFooter() {
  return (
    <footer className="mt-10 border-t border-border/80 bg-surface-2/80 py-9">
      <div className={`${PAGE_SHELL} flex flex-col gap-6 md:flex-row md:items-start md:justify-between`}>
        <div className="max-w-md space-y-2.5">
          <Link href="/" className="inline-flex items-center">
            <BrandMark compact />
          </Link>
          <p className="text-xs leading-relaxed text-muted">
            Philippine sports, athlete performance and the records behind every achievement. Live scores, standings, player statistics and UAAP history in one place.
          </p>
        </div>
        <div className="flex flex-wrap gap-x-8 gap-y-4">
          <nav aria-label="Footer leagues" className="flex flex-col gap-1 text-xs">
            <span className="eyebrow mb-1 text-muted/80">Leagues</span>
            {LEAGUE_PAGES.map((item) => (
              <Link
                key={item.slug}
                href={`/leagues/${item.slug}`}
                className="inline-flex min-h-9 items-center font-semibold text-muted transition-colors hover:text-foreground"
              >
                {`${item.league} scores & stats`}
              </Link>
            ))}
          </nav>
          <nav aria-label="Explore sports" className="flex flex-col gap-1 text-xs">
            <span className="eyebrow mb-1 text-muted/80">Explore</span>
            <Link
              href="/news"
              className="inline-flex min-h-9 items-center font-semibold text-muted transition-colors hover:text-foreground"
            >
              Newsroom
            </Link>
            <Link
              href="/uaap"
              className="inline-flex min-h-9 items-center font-semibold text-muted transition-colors hover:text-foreground"
            >
              UAAP history
            </Link>
            <Link
              href="/about"
              className="inline-flex min-h-9 items-center font-semibold text-muted transition-colors hover:text-foreground"
            >
              About Sportsmetric
            </Link>
          </nav>
        </div>
      </div>
    </footer>
  );
}
