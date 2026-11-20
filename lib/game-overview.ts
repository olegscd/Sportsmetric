import { getEffectiveGameStatus } from "@/lib/derivations";
import type { BoxScoreItem, Game } from "@/types/sports";

export type GameMarginInput = Pick<
  Game,
  "status" | "startTime" | "league" | "homeScore" | "awayScore" | "homeTeam" | "awayTeam"
>;

export interface TeamBoxTotals {
  pts: number;
  reb: number;
  ast: number;
  stl: number;
  blk: number;
  to: number;
  fgM: number;
  fgA: number;
  fgPct: number;
  threeM: number;
  threeA: number;
  threePtPct: number;
  ftM: number;
  ftA: number;
  ftPct: number;
}

function pct(made: number, attempts: number): number {
  return attempts > 0 ? Math.round((made / attempts) * 1000) / 10 : 0;
}

/** Describes the current or final scoring margin for a game overview card. */
export function describeGameMargin(game: GameMarginInput): string {
  const status = getEffectiveGameStatus(game);
  const diff = game.homeScore - game.awayScore;

  if (status === "UPCOMING" && game.homeScore === 0 && game.awayScore === 0) {
    return "Scheduled matchup";
  }
  if (diff === 0) {
    return "Tied game";
  }

  const leader = diff > 0 ? game.homeTeam.shortName : game.awayTeam.shortName;
  const margin = Math.abs(diff);
  return status === "FINAL"
    ? `${leader} won by ${margin}`
    : `${leader} leads by ${margin}`;
}

/** Aggregates player box-score rows into team totals and shooting percentages. */
export function summarizeTeamBoxScore(items: BoxScoreItem[]): TeamBoxTotals {
  let pts = 0;
  let reb = 0;
  let ast = 0;
  let stl = 0;
  let blk = 0;
  let to = 0;
  let fgM = 0;
  let fgA = 0;
  let threeM = 0;
  let threeA = 0;
  let ftM = 0;
  let ftA = 0;

  for (const item of items) {
    pts += item.pts ?? 0;
    reb += item.reb ?? 0;
    ast += item.ast ?? 0;
    stl += item.stl ?? 0;
    blk += item.blk ?? 0;
    to += item.to ?? 0;
    fgM += item.fgM ?? 0;
    fgA += item.fgA ?? 0;
    threeM += item.threeM ?? 0;
    threeA += item.threeA ?? 0;
    ftM += item.ftM ?? 0;
    ftA += item.ftA ?? 0;
  }

  return {
    pts,
    reb,
    ast,
    stl,
    blk,
    to,
    fgM,
    fgA,
    fgPct: pct(fgM, fgA),
    threeM,
    threeA,
    threePtPct: pct(threeM, threeA),
    ftM,
    ftA,
    ftPct: pct(ftM, ftA),
  };
}

export interface TopPerformerSummary {
  playerId: string;
  playerName: string;
  pts: number;
  side: "home" | "away";
}

/** Picks the leading scorer from a game's home/away box scores. */
export function getTopGamePerformer(
  game: Pick<Game, "boxScore">,
  playerNamesById?: Map<string, string>
): TopPerformerSummary | null {
  let best: TopPerformerSummary | null = null;
  for (const side of ["away", "home"] as const) {
    for (const row of game.boxScore?.[side] ?? []) {
      const pts = row.pts ?? 0;
      if (pts <= 0) continue;
      if (!best || pts > best.pts) {
        best = {
          playerId: row.playerId,
          playerName: row.playerName?.trim() || playerNamesById?.get(row.playerId) || "",
          pts,
          side,
        };
      }
    }
  }
  return best && best.playerName ? best : null;
}
