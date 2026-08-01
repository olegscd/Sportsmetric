/**
 * Backfill rows for PBA Commissioner's Cup games missing from the xlsx export.
 * Game 133: MAG 120, SMB 101 (Apr 12, 2026) — sourced from GMA / Global Sports Archive.
 * Game 184: no separate game played (MER vs TNT G3 was rescheduled to game 185 on May 24).
 */
import type { PbaStatsRow } from "./pba-import-core";

function pct(made: number, att: number): string {
  if (att <= 0) return "0";
  return String(Math.round((made / att) * 1000) / 10);
}

type Line = {
  team: string;
  opponent: string;
  teamScore: number;
  player: string;
  jersey: number;
  mins: string;
  pts: number;
  reb: number;
  ast: number;
  to: number;
  stl: number;
  blk: number;
  pf: number;
  fg2m: number;
  fg2a: number;
  fg3m: number;
  fg3a: number;
  ftm: number;
  fta: number;
};

function toRow(gameId: string, date: string, venue: string, line: Line): PbaStatsRow {
  return {
    game_id: gameId,
    game_date: date,
    venue,
    team: line.team,
    opponent: line.opponent,
    team_score: String(line.teamScore),
    player: line.player,
    jersey: String(line.jersey),
    mins: line.mins,
    pts: String(line.pts),
    reb: String(line.reb),
    ast: String(line.ast),
    to: String(line.to),
    stl: String(line.stl),
    blk: String(line.blk),
    pf: String(line.pf),
    fg2_pct: pct(line.fg2m, line.fg2a),
    fg3_pct: pct(line.fg3m, line.fg3a),
    ft_pct: pct(line.ftm, line.fta),
  };
}

const GAME_133_DATE = "04/12/26 03:00 PM";
const GAME_133_VENUE = "Smart Araneta Coliseum";

const game133Lines: Line[] = [
  // San Miguel Beermen — 101
  { team: "SMB", opponent: "MAG", teamScore: 101, player: "K. Rosales", jersey: 1, mins: "07:23", pts: 0, reb: 1, ast: 1, to: 0, stl: 0, blk: 0, pf: 2, fg2m: 0, fg2a: 0, fg3m: 0, fg3a: 2, ftm: 0, fta: 0 },
  { team: "SMB", opponent: "MAG", teamScore: 101, player: "D. Trollano", jersey: 2, mins: "24:31", pts: 10, reb: 1, ast: 1, to: 1, stl: 0, blk: 1, pf: 0, fg2m: 3, fg2a: 7, fg3m: 0, fg3a: 2, ftm: 4, fta: 4 },
  { team: "SMB", opponent: "MAG", teamScore: 101, player: "M. Tautuaa", jersey: 3, mins: "26:27", pts: 13, reb: 5, ast: 3, to: 1, stl: 0, blk: 0, pf: 4, fg2m: 3, fg2a: 7, fg3m: 1, fg3a: 3, ftm: 4, fta: 4 },
  { team: "SMB", opponent: "MAG", teamScore: 101, player: "A. Cahilig", jersey: 11, mins: "08:09", pts: 3, reb: 1, ast: 0, to: 0, stl: 0, blk: 0, pf: 1, fg2m: 0, fg2a: 0, fg3m: 1, fg3a: 2, ftm: 0, fta: 0 },
  { team: "SMB", opponent: "MAG", teamScore: 101, player: "M. Lassiter", jersey: 13, mins: "31:49", pts: 8, reb: 0, ast: 3, to: 2, stl: 1, blk: 0, pf: 1, fg2m: 2, fg2a: 5, fg3m: 1, fg3a: 2, ftm: 1, fta: 3 },
  { team: "SMB", opponent: "MAG", teamScore: 101, player: "J. Fajardo", jersey: 15, mins: "22:03", pts: 12, reb: 8, ast: 0, to: 0, stl: 0, blk: 2, pf: 3, fg2m: 5, fg2a: 9, fg3m: 0, fg3a: 0, ftm: 2, fta: 2 },
  { team: "SMB", opponent: "MAG", teamScore: 101, player: "J.M. Calma", jersey: 22, mins: "08:36", pts: 5, reb: 0, ast: 1, to: 0, stl: 0, blk: 0, pf: 1, fg2m: 2, fg2a: 2, fg3m: 0, fg3a: 0, ftm: 1, fta: 2 },
  { team: "SMB", opponent: "MAG", teamScore: 101, player: "R. Mantua", jersey: 23, mins: "02:45", pts: 0, reb: 0, ast: 1, to: 0, stl: 0, blk: 0, pf: 0, fg2m: 0, fg2a: 0, fg3m: 0, fg3a: 0, ftm: 0, fta: 0 },
  { team: "SMB", opponent: "MAG", teamScore: 101, player: "J. Tiongson", jersey: 33, mins: "13:08", pts: 0, reb: 0, ast: 1, to: 1, stl: 0, blk: 0, pf: 1, fg2m: 0, fg2a: 0, fg3m: 0, fg3a: 1, ftm: 0, fta: 0 },
  { team: "SMB", opponent: "MAG", teamScore: 101, player: "J. Cruz", jersey: 39, mins: "26:54", pts: 13, reb: 2, ast: 3, to: 3, stl: 1, blk: 0, pf: 2, fg2m: 4, fg2a: 6, fg3m: 1, fg3a: 1, ftm: 2, fta: 3 },
  { team: "SMB", opponent: "MAG", teamScore: 101, player: "C. Miller", jersey: 55, mins: "03:19", pts: 6, reb: 0, ast: 0, to: 0, stl: 1, blk: 0, pf: 2, fg2m: 3, fg2a: 3, fg3m: 0, fg3a: 1, ftm: 0, fta: 0 },
  { team: "SMB", opponent: "MAG", teamScore: 101, player: "C. Perez", jersey: 77, mins: "34:07", pts: 23, reb: 5, ast: 5, to: 3, stl: 3, blk: 0, pf: 3, fg2m: 3, fg2a: 9, fg3m: 3, fg3a: 7, ftm: 8, fta: 11 },
  { team: "SMB", opponent: "MAG", teamScore: 101, player: "R. Brondial", jersey: 91, mins: "30:42", pts: 8, reb: 9, ast: 1, to: 1, stl: 1, blk: 0, pf: 3, fg2m: 4, fg2a: 7, fg3m: 0, fg3a: 0, ftm: 0, fta: 0 },
  // Magnolia Hotshots — 120
  { team: "MAG", opponent: "SMB", teamScore: 120, player: "J. Gomez de Liano", jersey: 2, mins: "13:48", pts: 7, reb: 1, ast: 2, to: 0, stl: 0, blk: 0, pf: 2, fg2m: 1, fg2a: 2, fg3m: 1, fg3a: 2, ftm: 2, fta: 2 },
  { team: "MAG", opponent: "SMB", teamScore: 120, player: "P. Lee", jersey: 3, mins: "20:45", pts: 7, reb: 2, ast: 7, to: 2, stl: 0, blk: 0, pf: 1, fg2m: 0, fg2a: 4, fg3m: 1, fg3a: 1, ftm: 0, fta: 0 },
  { team: "MAG", opponent: "SMB", teamScore: 120, player: "C. Koon", jersey: 6, mins: "03:23", pts: 2, reb: 0, ast: 0, to: 0, stl: 0, blk: 0, pf: 3, fg2m: 1, fg2a: 2, fg3m: 0, fg3a: 0, ftm: 0, fta: 0 },
  { team: "MAG", opponent: "SMB", teamScore: 120, player: "I. Sangalang", jersey: 10, mins: "16:25", pts: 12, reb: 2, ast: 0, to: 0, stl: 0, blk: 0, pf: 3, fg2m: 4, fg2a: 5, fg3m: 0, fg3a: 0, ftm: 4, fta: 5 },
  { team: "MAG", opponent: "SMB", teamScore: 120, player: "C. Chapman", jersey: 12, mins: "29:45", pts: 34, reb: 6, ast: 2, to: 4, stl: 0, blk: 3, pf: 2, fg2m: 7, fg2a: 11, fg3m: 3, fg3a: 3, ftm: 11, fta: 11 },
  { team: "MAG", opponent: "SMB", teamScore: 120, player: "G. Gomez", jersey: 13, mins: "02:45", pts: 0, reb: 0, ast: 0, to: 0, stl: 0, blk: 0, pf: 0, fg2m: 0, fg2a: 0, fg3m: 0, fg3a: 0, ftm: 0, fta: 0 },
  { team: "MAG", opponent: "SMB", teamScore: 120, player: "M. Barroca", jersey: 14, mins: "23:45", pts: 4, reb: 3, ast: 9, to: 1, stl: 0, blk: 0, pf: 3, fg2m: 2, fg2a: 3, fg3m: 0, fg3a: 0, ftm: 0, fta: 0 },
  { team: "MAG", opponent: "SMB", teamScore: 120, player: "P. Alfaro", jersey: 17, mins: "17:03", pts: 7, reb: 1, ast: 2, to: 1, stl: 0, blk: 1, pf: 2, fg2m: 2, fg2a: 2, fg3m: 1, fg3a: 4, ftm: 0, fta: 0 },
  { team: "MAG", opponent: "SMB", teamScore: 120, player: "R. dela Rosa", jersey: 19, mins: "28:12", pts: 9, reb: 4, ast: 3, to: 1, stl: 3, blk: 0, pf: 1, fg2m: 1, fg2a: 3, fg3m: 1, fg3a: 3, ftm: 4, fta: 4 },
  { team: "MAG", opponent: "SMB", teamScore: 120, player: "Y. Andrada", jersey: 21, mins: "13:30", pts: 7, reb: 5, ast: 1, to: 0, stl: 0, blk: 0, pf: 0, fg2m: 1, fg2a: 2, fg3m: 1, fg3a: 2, ftm: 2, fta: 2 },
  { team: "MAG", opponent: "SMB", teamScore: 120, player: "Z. Lucero", jersey: 22, mins: "29:23", pts: 11, reb: 7, ast: 4, to: 5, stl: 2, blk: 0, pf: 3, fg2m: 5, fg2a: 6, fg3m: 0, fg3a: 1, ftm: 1, fta: 1 },
  { team: "MAG", opponent: "SMB", teamScore: 120, player: "J. Lastimosa", jersey: 30, mins: "24:45", pts: 13, reb: 2, ast: 6, to: 2, stl: 0, blk: 0, pf: 2, fg2m: 4, fg2a: 5, fg3m: 1, fg3a: 1, ftm: 2, fta: 2 },
  { team: "MAG", opponent: "SMB", teamScore: 120, player: "R. Verano", jersey: 41, mins: "10:43", pts: 2, reb: 3, ast: 0, to: 0, stl: 1, blk: 0, pf: 2, fg2m: 1, fg2a: 4, fg3m: 0, fg3a: 1, ftm: 0, fta: 0 },
  { team: "MAG", opponent: "SMB", teamScore: 120, player: "J. Laput", jersey: 42, mins: "01:10", pts: 0, reb: 0, ast: 0, to: 0, stl: 0, blk: 0, pf: 0, fg2m: 0, fg2a: 0, fg3m: 0, fg3a: 0, ftm: 0, fta: 0 },
  { team: "MAG", opponent: "SMB", teamScore: 120, player: "R. Escoto", jersey: 88, mins: "04:33", pts: 5, reb: 1, ast: 0, to: 0, stl: 0, blk: 0, pf: 1, fg2m: 1, fg2a: 1, fg3m: 1, fg3a: 1, ftm: 0, fta: 0 },
];

export function getPbaCommCupBackfillRows(): PbaStatsRow[] {
  return game133Lines.map((line) => toRow("133", GAME_133_DATE, GAME_133_VENUE, line));
}

/** Game IDs absent from the export that have no separate game record. */
export const PBA_COMM_CUP_SKIPPED_GAME_IDS = ["184"] as const;
