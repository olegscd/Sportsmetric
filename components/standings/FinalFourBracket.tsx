"use client";

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
  if (standings.length < 4) {
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
  let seed1SfWins = 1; // Twice to beat advantage
  let seed4SfWins = 0;
  for (const g of sf1Games) {
    if (g.status === "FINAL") {
      const winnerId = g.homeScore > g.awayScore ? g.homeTeam.id : g.awayTeam.id;
      if (winnerId === seed1.id) seed1SfWins++;
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
  let seed2SfWins = 1; // Twice to beat advantage
  let seed3SfWins = 0;
  for (const g of sf2Games) {
    if (g.status === "FINAL") {
      const winnerId = g.homeScore > g.awayScore ? g.homeTeam.id : g.awayTeam.id;
      if (winnerId === seed2.id) seed2SfWins++;
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
  const champion: Team =
    sf2FinalsWins > sf1FinalsWins ? sf2Winner : sf1Winner;

  return (
    <div className="flex flex-col gap-4 rounded-3xl border border-amber-500/20 bg-surface/50 p-4 sm:p-6 shadow-xl">
      <div className="flex items-center justify-between border-b border-border pb-3">
        <div className="flex items-center gap-2">
          <Trophy size={18} className="text-amber-400" />
          <h3 className="text-sm font-bold text-foreground uppercase tracking-wider">
            Final Four Bracket
          </h3>
        </div>
        <span className="rounded-full bg-amber-500/10 px-2.5 py-0.5 text-[10px] font-extrabold text-amber-500 border border-amber-500/20">
          Playoffs
        </span>
      </div>

      {/* Bracket Level 1: Semifinals */}
      <div className="flex flex-col gap-3">
        <p className="text-[10px] font-bold uppercase tracking-widest text-muted">
          Semifinals
        </p>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {/* Matchup 1 */}
          <div className="flex flex-col rounded-2xl border border-border bg-elevated p-3 gap-2">
            <div className="text-[10px] font-bold text-muted uppercase tracking-wide">
              Semifinal 1
            </div>

            {/* Seed 1 */}
            <Link
              href={`/teams/${seed1.id}`}
              className={cn(
                "flex items-center gap-2 rounded-xl p-2.5 transition-colors border",
                sf1Winner.id === seed1.id
                  ? "bg-emerald-500/20 border-emerald-500/40 text-foreground font-bold shadow-sm"
                  : "bg-rose-500/15 border-rose-500/30 text-foreground/80 font-medium opacity-75"
              )}
            >
              <span
                className={cn(
                  "flex h-5 w-5 shrink-0 items-center justify-center rounded text-[10px] font-black",
                  sf1Winner.id === seed1.id
                    ? "bg-emerald-500/30 text-emerald-400"
                    : "bg-rose-500/20 text-rose-400"
                )}
              >
                #1
              </span>
              <TeamBadge team={seed1} size="sm" />
              <span className="truncate text-xs text-foreground">
                {seed1.name}
              </span>
            </Link>

            {/* Seed 4 */}
            <Link
              href={`/teams/${seed4.id}`}
              className={cn(
                "flex items-center gap-2 rounded-xl p-2.5 transition-colors border",
                sf1Winner.id === seed4.id
                  ? "bg-emerald-500/20 border-emerald-500/40 text-foreground font-bold shadow-sm"
                  : "bg-rose-500/15 border-rose-500/30 text-foreground/80 font-medium opacity-75"
              )}
            >
              <span
                className={cn(
                  "flex h-5 w-5 shrink-0 items-center justify-center rounded text-[10px] font-black",
                  sf1Winner.id === seed4.id
                    ? "bg-emerald-500/30 text-emerald-400"
                    : "bg-rose-500/20 text-rose-400"
                )}
              >
                #4
              </span>
              <TeamBadge team={seed4} size="sm" />
              <span className="truncate text-xs text-foreground">
                {seed4.name}
              </span>
            </Link>
          </div>

          {/* Matchup 2 */}
          <div className="flex flex-col rounded-2xl border border-border bg-elevated p-3 gap-2">
            <div className="text-[10px] font-bold text-muted uppercase tracking-wide">
              Semifinal 2
            </div>

            {/* Seed 2 */}
            <Link
              href={`/teams/${seed2.id}`}
              className={cn(
                "flex items-center gap-2 rounded-xl p-2.5 transition-colors border",
                sf2Winner.id === seed2.id
                  ? "bg-emerald-500/20 border-emerald-500/40 text-foreground font-bold shadow-sm"
                  : "bg-rose-500/15 border-rose-500/30 text-foreground/80 font-medium opacity-75"
              )}
            >
              <span
                className={cn(
                  "flex h-5 w-5 shrink-0 items-center justify-center rounded text-[10px] font-black",
                  sf2Winner.id === seed2.id
                    ? "bg-emerald-500/30 text-emerald-400"
                    : "bg-rose-500/20 text-rose-400"
                )}
              >
                #2
              </span>
              <TeamBadge team={seed2} size="sm" />
              <span className="truncate text-xs text-foreground">
                {seed2.name}
              </span>
            </Link>

            {/* Seed 3 */}
            <Link
              href={`/teams/${seed3.id}`}
              className={cn(
                "flex items-center gap-2 rounded-xl p-2.5 transition-colors border",
                sf2Winner.id === seed3.id
                  ? "bg-emerald-500/20 border-emerald-500/40 text-foreground font-bold shadow-sm"
                  : "bg-rose-500/15 border-rose-500/30 text-foreground/80 font-medium opacity-75"
              )}
            >
              <span
                className={cn(
                  "flex h-5 w-5 shrink-0 items-center justify-center rounded text-[10px] font-black",
                  sf2Winner.id === seed3.id
                    ? "bg-emerald-500/30 text-emerald-400"
                    : "bg-rose-500/20 text-rose-400"
                )}
              >
                #3
              </span>
              <TeamBadge team={seed3} size="sm" />
              <span className="truncate text-xs text-foreground">
                {seed3.name}
              </span>
            </Link>
          </div>
        </div>
      </div>

      {/* Bracket Line Connector: Semifinals -> Finals */}
      <div className="flex justify-center my-1 text-amber-500/40">
        <svg className="w-full max-w-[320px] h-10 overflow-visible" viewBox="0 0 200 40">
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
        <p className="text-[10px] font-bold uppercase tracking-widest text-amber-500 text-center">
          Finals Series
        </p>

        <div className="flex flex-col rounded-2xl border border-amber-500/30 bg-amber-500/5 p-3.5 gap-2 max-w-md mx-auto w-full">
          {/* Finalist 1 */}
          <Link
            href={`/teams/${sf1Winner.id}`}
            className={cn(
              "flex items-center gap-2.5 rounded-xl p-2.5 transition-colors border",
              champion.id === sf1Winner.id
                ? "bg-emerald-500/20 border-emerald-500/40 text-foreground font-bold shadow-sm"
                : "bg-rose-500/15 border-rose-500/30 text-foreground/80 font-medium opacity-75"
            )}
          >
            <TeamBadge team={sf1Winner} size="sm" />
            <span className="truncate text-xs text-foreground">
              {sf1Winner.name}
            </span>
          </Link>

          <div className="text-center text-[10px] font-extrabold text-muted uppercase">vs</div>

          {/* Finalist 2 */}
          <Link
            href={`/teams/${sf2Winner.id}`}
            className={cn(
              "flex items-center gap-2.5 rounded-xl p-2.5 transition-colors border",
              champion.id === sf2Winner.id
                ? "bg-emerald-500/20 border-emerald-500/40 text-foreground font-bold shadow-sm"
                : "bg-rose-500/15 border-rose-500/30 text-foreground/80 font-medium opacity-75"
            )}
          >
            <TeamBadge team={sf2Winner} size="sm" />
            <span className="truncate text-xs text-foreground">
              {sf2Winner.name}
            </span>
          </Link>
        </div>
      </div>

      {/* Bracket Line Connector: Finals -> Champion */}
      <div className="flex justify-center my-1 text-amber-400">
        <svg className="w-8 h-10 overflow-visible" viewBox="0 0 20 40">
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
      <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border-2 border-emerald-400 bg-emerald-500/20 p-5 text-center shadow-lg max-w-md mx-auto w-full">
        <div className="flex items-center gap-1.5 rounded-full bg-emerald-400/20 px-3 py-1 text-emerald-400 text-xs font-black uppercase tracking-wider">
          <Trophy size={16} />
          <span>Season Champion</span>
        </div>

        <Link
          href={`/teams/${champion.id}`}
          className="flex flex-col items-center gap-2 group cursor-pointer"
        >
          <TeamBadge team={champion} size="lg" className="ring-4 ring-emerald-400/40 group-hover:scale-105 transition-transform" />
          <span className="text-base sm:text-lg font-black text-foreground group-hover:text-emerald-400 transition-colors">
            {champion.name}
          </span>
        </Link>
      </div>
    </div>
  );
}
