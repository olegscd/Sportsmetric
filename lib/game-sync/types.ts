import type { ExtractedBoxRow } from "@/lib/game-extractor";
import type { League, TournamentStage } from "@/types/sports";

export interface SyncSource {
  id: string;
  league: League;
  season_id: string;
  label: string;
  tournament_url: string;
  year: number;
  starts_on: string;
  ends_on: string;
  conference_id: string | null;
  enabled: boolean;
  last_checked_at?: string | null;
  last_success_at?: string | null;
  last_error?: string | null;
}

export interface Observation {
  key: string;
  home: string;
  away: string;
  day: string;
  startTime: string | null;
  status: "UPCOMING" | "LIVE" | "FINAL";
  homeScore: number | null;
  awayScore: number | null;
  venue: string | null;
  stage: TournamentStage;
  url: string;
  /** Live period (quarter, or overtime as 5+) and game clock, when published. */
  period?: number | null;
  clock?: string | null;
  /** Official box score, oriented to `home`/`away` above. */
  box?: { home: ExtractedBoxRow[]; away: ExtractedBoxRow[] } | null;
  /** PVL: official match-report PDF that carries the box score. */
  reportUrl?: string | null;
}

export interface StoredGame {
  id: string;
  league: League;
  season_id: string;
  home_team_id: string;
  away_team_id: string;
  home_score: number;
  away_score: number;
  status: string;
  start_time: string;
  venue: string | null;
  stage: string | null;
  is_playoff: boolean | null;
  quarter_or_set?: number | null;
  time_remaining?: string | null;
}

export interface SyncTeam {
  id: string;
  name: string;
  short_name: string;
  league: League;
  season_id: string;
}

export interface SyncLink {
  source_id: string;
  source_key: string;
  game_id: string;
  paused: boolean;
  snapshot: Partial<StoredGame> | null;
  last_checked_at: string;
}

export interface SyncIssue {
  source_id: string;
  source_key: string;
  game_id?: string;
  message: string;
}

export type SyncDecision =
  | { kind: "skip"; reason: string }
  | { kind: "review"; reason: string; gameId?: string }
  | { kind: "save"; game: StoredGame; previous: StoredGame | null };
