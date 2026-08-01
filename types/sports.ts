export type League = "UAAP" | "PBA" | "PVL";

export type GameStatus = "LIVE" | "UPCOMING" | "FINAL";

export type Position =
  | "PG"
  | "SG"
  | "SF"
  | "PF"
  | "C" // basketball
  | "OH"
  | "OP"
  | "MB"
  | "S"
  | "L"; // volleyball

export type PlayByPlayEventType =
  | "FG_MADE"
  | "FG_MISSED"
  | "3PT_MADE"
  | "FT_MADE"
  | "REBOUND"
  | "ASSIST"
  | "STEAL"
  | "BLOCK"
  | "TURNOVER"
  | "FOUL"
  | "SUB"
  | "TIMEOUT"
  | "PERIOD_END"
  | "KILL"
  | "SERVE_ACE"
  | "BLOCK_POINT";

export interface SeasonAverages {
  ppg: number;
  rpg: number;
  apg: number;
  spg: number;
  bpg: number;
  fgPct: number;
  threePtPct: number;
  ftPct: number;
  /** Volleyball-specific, optional */
  killsPerSet?: number;
  digsPerSet?: number;
  blocksPerSet?: number;
}

export interface RankBadge {
  /** Display label, e.g. "#1 in 3P%" */
  label: string;
  /** Key of the stat this badge is ranking, e.g. "threePtPct" */
  statKey: string;
  rank: number;
  scope: "league" | "team";
}

export interface Player {
  id: string;
  /**
   * Stable career identity shared across season rows for the same athlete.
   * Defaults to `id` when a player only exists in one season. Lifetime views
   * group and average by this key.
   */
  personId: string;
  name: string;
  jerseyNumber: number;
  position: Position;
  teamId: string;
  /** e.g. "6'6\"" */
  height: string;
  photoUrl: string | null;
  seasonAverages: SeasonAverages;
  rankBadges: RankBadge[];
  /** Which Season this roster/stat line belongs to. */
  seasonId: string;
}

export interface TeamRecord {
  wins: number;
  losses: number;
}

export interface Team {
  id: string;
  name: string;
  shortName: string;
  /** null renders the initials-based TeamBadge fallback */
  logo: string | null;
  league: League;
  record: TeamRecord;
  /** Tailwind-safe hex used by TeamBadge / MomentumBar */
  accentColor: string;
  /** Which Season this team/roster/record belongs to. */
  seasonId: string;
}

/**
 * A sport season/year (e.g. "2025-26"). Teams, players and games each belong
 * to exactly one season, so switching seasons in the UI swaps out the whole
 * roster/standings/schedule for that year. Only one season per league has isCurrent
 * true at a time -- that's the default shown on first load.
 */
export interface Season {
  id: string;
  /** Display label, e.g. "2025-26 Season" */
  label: string;
  isCurrent: boolean;
  league?: League;
}

export interface PlayByPlayEvent {
  id: string;
  /** Game clock, e.g. "08:42" - static string, never derived at render time */
  timestamp: string;
  /** Quarter or set number */
  period: number;
  description: string;
  scoringTeamId: string | null;
  currentScore: {
    home: number;
    away: number;
  };
  type: PlayByPlayEventType;
}

export interface BoxScoreItem {
  playerId: string;
  pts: number;
  reb: number;
  ast: number;
  stl: number;
  blk: number;
  /** Turnovers — optional, from UAAP box scores */
  to?: number;
  /** Personal fouls — optional, from UAAP box scores */
  pf?: number;
  fgM: number;
  fgA: number;
  threeM?: number;
  threeA?: number;
  ftM?: number;
  ftA?: number;
  /** e.g. "34:12" */
  min: string;
}

export interface BoxScore {
  home: BoxScoreItem[];
  away: BoxScoreItem[];
}

export interface Game {
  id: string;
  league: League;
  homeTeam: Team;
  awayTeam: Team;
  homeScore: number;
  awayScore: number;
  status: GameStatus;
  quarterOrSet: number;
  /** null for FINAL / scheduled-future games */
  timeRemaining: string | null;
  /** e.g. "2026-03-24T18:00:00Z" */
  startTime: string;
  venue?: string | null;
  boxScore: BoxScore;
  playByPlay: PlayByPlayEvent[];
  /** Which Season this game belongs to. */
  seasonId: string;
}
