"use client";

import { Badge } from "@/components/ui/Badge";
import { TeamBadge } from "@/components/ui/TeamBadge";
import type { DerivedTeamStandings } from "@/lib/derivations";
import type { Game, Team } from "@/types/sports";
import { cn } from "@/lib/utils";
import { Trophy } from "lucide-react";
import Link from "next/link";

interface FinalFourBracketProps {
  standings: DerivedTeamStandings[];
  playoffGames: Game[];
}

export function FinalFourBracket({ standings, playoffGames }: FinalFourBracketProps) {
  if (standings.length < 4 || playoffGames.length === 0) {
    return null;
  }

  const seed1 = standings[0]?.team;
  const seed2 = standings[1]?.team;
  const seed3 = standings[2]?.team;
  const seed4 = standings[3]?.team;

  if (!seed1 || !seed2 || !seed3 || !seed4) return null;

  // Semifinal 1 (Seed #1 vs Seed #4) - #1 has Twice-to-Beat
  const sf1Games = playoffGames.filter(
    (g) =>
      (g.homeTeam.id === seed1.id && g.awayTeam.id === seed4.id) ||
      (g.homeTeam.id === seed4.id && g.awayTeam.id === seed1.id)
  );
  let seed4SfWins = 0;
  for (const g of sf1Games) {
    if (g.status === "FINAL") {
      const winnerId = g.homeScore > g.awayScore ? g.homeTeam.id : g.awayTeam.id;
      if (winnerId === seed4.id) seed4SfWins++;
    }
  }
  const sf1Winner: Team = seed4SfWins >= 2 ? seed4 : seed1;

  // Semifinal 2 (Seed #2 vs Seed #3) - #2 has Twice-to-Beat
  const sf2Games = playoffGames.filter(
    (g) =>
      (g.homeTeam.id === seed2.id && g.awayTeam.id === seed3.id) ||
      (g.homeTeam.id === seed3.id && g.awayTeam.id === seed2.id)
  );
  let seed3SfWins = 0;
  for (const g of sf2Games) {
    if (g.status === "FINAL") {
      const winnerId = g.homeScore > g.awayScore ? g.homeTeam.id : g.awayTeam.id;
      if (winnerId === seed3.id) seed3SfWins++;
    }
  }
  const sf2Winner: Team = seed3SfWins >= 2 ? seed3 : seed2;


  // Finals Series (sf1Winner vs sf2Winner)
  const finalsGames = playoffGames.filter(
    (g) =>
      (g.homeTeam.id === sf1Winner.id && g.awayTeam.id === sf2Winner.id) ||
      (g.homeTeam.id === sf2Winner.id && g.awayTeam.id === sf1Winner.id)
  );
  let sf1FinalsWins = 0;
  let sf2FinalsWins = 0;
  for (const g of finalsGames) {
    if (g.status === "FINAL") {
      const winnerId = g.homeScore > g.awayScore ? g.homeTeam.id : g.awayTeam.id;
      if (winnerId === sf1Winner.id) sf1FinalsWins++;
      if (winnerId === sf2Winner.id) sf2FinalsWins++;
    }
  }
  // UAAP finals are best-of-three: only declare a champion once a side has
  // actually won two games. Previously a 0-0 or 1-0 series defaulted to the
  // first finalist, showing a champion before the series was decided.
  const FINALS_WINS_NEEDED = 2;
  const champion: Team | null =
    sf2FinalsWins >= FINALS_WINS_NEEDED
      ? sf2Winner
      : sf1FinalsWins >= FINALS_WINS_NEEDED
        ? sf1Winner
        : null;

  function seedLinkClasses(isWinner: boolean) {
    return cn(
      "flex min-h-11 items-center gap-2 rounded-control border p-2.5 transition-colors",
      isWinner
        ? "border-positive/40 bg-positive/10 text-foreground"
        : "border-border/70 bg-surface-2/60 text-muted hover:border-border-strong"
    );
  }

  return (
    <div className="h-scroll overflow-x-auto rounded-panel border border-archive/20 bg-surface/50 shadow-card">
      <div className="flex min-w-[20rem] flex-col gap-4 p-4 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border pb-3">
          <div className="flex items-center gap-2">
            <Trophy size={18} className="text-archive" aria-hidden="true" />
            <h3 className="text-sm font-bold uppercase tracking-wider text-foreground">
              Final Four Bracket
            </h3>
          </div>
          <Badge tone="archive" size="md">
            Playoffs
          </Badge>
        </div>

        {/* Bracket Level 1: Semifinals */}
        <div className="flex flex-col gap-3">
          <p className="eyebrow text-muted">Semifinals</p>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {/* Matchup 1 */}
            <div className="flex flex-col gap-2 rounded-card border border-border bg-elevated p-3">
              <div className="text-2xs font-bold uppercase tracking-wide text-muted">
                Semifinal 1
              </div>

              {/* Seed 1 */}
              <Link href={`/teams/${seed1.id}`} className={seedLinkClasses(sf1Winner.id === seed1.id)}>
                <span
                  className={cn(
                    "flex h-5 w-5 shrink-0 items-center justify-center rounded text-3xs font-black tabular-nums",
                    sf1Winner.id === seed1.id
                      ? "bg-positive/15 text-positive"
                      : "bg-elevated text-muted"
                  )}
                >
                  #1
                </span>
                <TeamBadge team={seed1} size="sm" />
                <span
                  className={cn(
                    "truncate text-xs",
                    sf1Winner.id === seed1.id ? "font-bold text-foreground" : "text-muted"
                  )}
                >
                  {seed1.name}
                </span>
              </Link>

              {/* Seed 4 */}
              <Link href={`/teams/${seed4.id}`} className={seedLinkClasses(sf1Winner.id === seed4.id)}>
                <span
                  className={cn(
                    "flex h-5 w-5 shrink-0 items-center justify-center rounded text-3xs font-black tabular-nums",
                    sf1Winner.id === seed4.id
                      ? "bg-positive/15 text-positive"
                      : "bg-elevated text-muted"
                  )}
                >
                  #4
                </span>
                <TeamBadge team={seed4} size="sm" />
                <span
                  className={cn(
                    "truncate text-xs",
                    sf1Winner.id === seed4.id ? "font-bold text-foreground" : "text-muted"
                  )}
                >
                  {seed4.name}
                </span>
              </Link>
            </div>

            {/* Matchup 2 */}
            <div className="flex flex-col gap-2 rounded-card border border-border bg-elevated p-3">
              <div className="text-2xs font-bold uppercase tracking-wide text-muted">
                Semifinal 2
              </div>

              {/* Seed 2 */}
              <Link href={`/teams/${seed2.id}`} className={seedLinkClasses(sf2Winner.id === seed2.id)}>
                <span
                  className={cn(
                    "flex h-5 w-5 shrink-0 items-center justify-center rounded text-3xs font-black tabular-nums",
                    sf2Winner.id === seed2.id
                      ? "bg-positive/15 text-positive"
                      : "bg-elevated text-muted"
                  )}
                >
                  #2
                </span>
                <TeamBadge team={seed2} size="sm" />
                <span
                  className={cn(
                    "truncate text-xs",
                    sf2Winner.id === seed2.id ? "font-bold text-foreground" : "text-muted"
                  )}
                >
                  {seed2.name}
                </span>
              </Link>

              {/* Seed 3 */}
              <Link href={`/teams/${seed3.id}`} className={seedLinkClasses(sf2Winner.id === seed3.id)}>
                <span
                  className={cn(
                    "flex h-5 w-5 shrink-0 items-center justify-center rounded text-3xs font-black tabular-nums",
                    sf2Winner.id === seed3.id
                      ? "bg-positive/15 text-positive"
                      : "bg-elevated text-muted"
                  )}
                >
                  #3
                </span>
                <TeamBadge team={seed3} size="sm" />
                <span
                  className={cn(
                    "truncate text-xs",
                    sf2Winner.id === seed3.id ? "font-bold text-foreground" : "text-muted"
                  )}
                >
                  {seed3.name}
                </span>
              </Link>
            </div>
          </div>
        </div>

        {/* Bracket Line Connector: Semifinals -> Finals */}
        <div className="my-1 flex justify-center text-border-strong">
          <svg className="h-10 w-full max-w-[320px] overflow-visible" viewBox="0 0 200 40" aria-hidden="true">
            <path
              d="M 40 0 L 40 18 L 160 18 L 160 0 M 100 18 L 100 40"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </div>

        {/* Bracket Level 2: Finals */}
        <div className="flex flex-col gap-2">
          <p className="text-center text-2xs font-bold uppercase tracking-widest text-archive">
            Finals Series
          </p>

          <div className="mx-auto flex w-full max-w-md flex-col gap-2 rounded-card border border-archive/25 bg-archive/5 p-3.5">
            {/* Finalist 1 */}
            <Link
              href={`/teams/${sf1Winner.id}`}
              className={cn(
                "flex min-h-11 items-center gap-2.5 rounded-control border p-2.5 transition-colors",
                champion?.id === sf1Winner.id
                  ? "border-positive/40 bg-positive/10 font-bold text-foreground"
                  : champion
                    ? "border-border/70 bg-surface-2/60 text-muted"
                    : "border-border bg-elevated text-foreground"
              )}
            >
              <TeamBadge team={sf1Winner} size="sm" />
              <span className="truncate text-xs">{sf1Winner.name}</span>
            </Link>

            <div className="text-center text-2xs font-extrabold uppercase text-muted">vs</div>

            {/* Finalist 2 */}
            <Link
              href={`/teams/${sf2Winner.id}`}
              className={cn(
                "flex min-h-11 items-center gap-2.5 rounded-control border p-2.5 transition-colors",
                champion?.id === sf2Winner.id
                  ? "border-positive/40 bg-positive/10 font-bold text-foreground"
                  : champion
                    ? "border-border/70 bg-surface-2/60 text-muted"
                    : "border-border bg-elevated text-foreground"
              )}
            >
              <TeamBadge team={sf2Winner} size="sm" />
              <span className="truncate text-xs">{sf2Winner.name}</span>
            </Link>
          </div>
        </div>

        {/* Bracket Line Connector: Finals -> Champion */}
        <div className="my-1 flex justify-center text-archive/50">
          <svg className="h-10 w-8 overflow-visible" viewBox="0 0 20 40" aria-hidden="true">
            <path
              d="M 10 0 L 10 32"
              fill="none"
              stroke="currentColor"
              strokeWidth="3"
              strokeLinecap="round"
            />
            <polygon points="4,30 10,40 16,30" fill="currentColor" />
          </svg>
        </div>

        {/* Bracket Level 3: Champion / Winner */}
        {champion ? (
          <div className="mx-auto flex w-full max-w-md flex-col items-center justify-center gap-3 rounded-card border-2 border-positive/50 bg-positive/10 p-5 text-center shadow-card">
            <Badge tone="success" size="md" icon={<Trophy size={14} aria-hidden="true" />}>
              Season Champion
            </Badge>

            <Link
              href={`/teams/${champion.id}`}
              className="group flex flex-col items-center gap-2"
            >
              <TeamBadge
                team={champion}
                size="lg"
                className="ring-4 ring-positive/25 transition-colors group-hover:ring-positive/40"
              />
              <span className="text-base font-black text-foreground transition-colors group-hover:text-positive sm:text-lg">
                {champion.name}
              </span>
            </Link>
          </div>
        ) : (
          <div className="mx-auto flex w-full max-w-md flex-col items-center gap-1.5 rounded-card border border-dashed border-border bg-surface/60 p-5 text-center">
            <span className="text-xs font-bold uppercase tracking-wider text-muted">
              Finals in progress
            </span>
            <p className="text-2xs text-muted">
              The champion appears once a finalist wins {FINALS_WINS_NEEDED} games.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
