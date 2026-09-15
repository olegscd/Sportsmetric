import type {
  BoxScoreItem,
  Game,
  GameStatus,
  League,
  PlayByPlayEvent,
  PlayByPlayEventType,
  Player,
  Position,
  Season,
  SeasonAverages,
  Team,
  TournamentStage,
} from "@/types/sports";

/**
 * Normalizers for anything arriving over the wire. They rebuild each entity
 * field by field so an unexpected key, a string where a number belongs, or a
 * bogus enum value can never reach Supabase.
 */

export class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ValidationError";
  }
}

const LEAGUES: League[] = ["UAAP", "PBA", "PVL"];
const GAME_STATUSES: GameStatus[] = ["LIVE", "UPCOMING", "FINAL"];
const STAGES: TournamentStage[] = ["ELIMINATION", "PLAY_IN", "SEMIFINALS", "FINALS"];
const POSITIONS: Position[] = ["PG", "SG", "SF", "PF", "C", "OH", "OP", "MB", "S", "L"];
const PBP_TYPES: PlayByPlayEventType[] = [
  "FG_MADE", "FG_MISSED", "3PT_MADE", "FT_MADE", "REBOUND", "ASSIST", "STEAL",
  "BLOCK", "TURNOVER", "FOUL", "SUB", "TIMEOUT", "PERIOD_END", "KILL",
  "SERVE_ACE", "BLOCK_POINT",
];

const MAX_ID_LENGTH = 200;
const MAX_TEXT_LENGTH = 300;
const MAX_BATCH_SIZE = 500;
const MAX_BOX_SCORE_ROWS = 60;
const MAX_PBP_EVENTS = 1000;
const HEX_COLOR = /^#[0-9a-fA-F]{6}$/;

function asRecord(value: unknown, label: string): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new ValidationError(`${label} must be an object.`);
  }
  return value as Record<string, unknown>;
}

export function requireId(value: unknown, label: string): string {
  if (typeof value !== "string") throw new ValidationError(`${label} must be a string.`);
  const trimmed = value.trim();
  if (!trimmed) throw new ValidationError(`${label} is required.`);
  if (trimmed.length > MAX_ID_LENGTH) {
    throw new ValidationError(`${label} exceeds ${MAX_ID_LENGTH} characters.`);
  }
  return trimmed;
}

function requireText(value: unknown, label: string, max = MAX_TEXT_LENGTH): string {
  if (typeof value !== "string") throw new ValidationError(`${label} must be a string.`);
  const trimmed = value.trim();
  if (!trimmed) throw new ValidationError(`${label} is required.`);
  return trimmed.slice(0, max);
}

function optionalText(value: unknown, max = MAX_TEXT_LENGTH): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed ? trimmed.slice(0, max) : null;
}

function num(value: unknown, fallback = 0): number {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function intInRange(value: unknown, min: number, max: number, fallback = 0): number {
  const parsed = Math.trunc(num(value, fallback));
  if (parsed < min) return min;
  if (parsed > max) return max;
  return parsed;
}

function oneOf<T extends string>(value: unknown, allowed: T[], label: string): T {
  if (typeof value === "string" && (allowed as string[]).includes(value)) return value as T;
  throw new ValidationError(`${label} must be one of: ${allowed.join(", ")}.`);
}

function oneOfOr<T extends string>(value: unknown, allowed: T[], fallback: T): T {
  return typeof value === "string" && (allowed as string[]).includes(value)
    ? (value as T)
    : fallback;
}

function requireIsoDate(value: unknown, label: string): string {
  if (typeof value !== "string") throw new ValidationError(`${label} must be an ISO date string.`);
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    throw new ValidationError(`${label} is not a valid date.`);
  }
  return parsed.toISOString();
}

function requireArray(value: unknown, label: string, max: number): unknown[] {
  if (!Array.isArray(value)) throw new ValidationError(`${label} must be an array.`);
  if (value.length > max) {
    throw new ValidationError(`${label} exceeds the maximum of ${max} entries.`);
  }
  return value;
}

export function normalizeSeason(input: unknown): Season {
  const raw = asRecord(input, "season");
  return {
    id: requireId(raw.id, "season.id"),
    label: requireText(raw.label, "season.label"),
    isCurrent: Boolean(raw.isCurrent),
    league: typeof raw.league === "string" && (LEAGUES as string[]).includes(raw.league)
      ? (raw.league as League)
      : undefined,
    sortOrder: raw.sortOrder === undefined || raw.sortOrder === null
      ? undefined
      : intInRange(raw.sortOrder, 0, 100000),
  };
}

export function normalizeTeam(input: unknown): Team {
  const raw = asRecord(input, "team");
  const record = asRecord(raw.record ?? {}, "team.record");
  const accentColor = typeof raw.accentColor === "string" && HEX_COLOR.test(raw.accentColor.trim())
    ? raw.accentColor.trim()
    : "#6B7280";

  return {
    id: requireId(raw.id, "team.id"),
    name: requireText(raw.name, "team.name"),
    shortName: requireText(raw.shortName, "team.shortName", 24),
    logo: optionalText(raw.logo, 500),
    league: oneOf(raw.league, LEAGUES, "team.league"),
    accentColor,
    seasonId: requireId(raw.seasonId, "team.seasonId"),
    record: {
      wins: intInRange(record.wins, 0, 999),
      losses: intInRange(record.losses, 0, 999),
    },
  };
}

function normalizeSeasonAverages(input: unknown): SeasonAverages {
  const raw = asRecord(input ?? {}, "player.seasonAverages");
  const base: SeasonAverages = {
    ppg: num(raw.ppg),
    rpg: num(raw.rpg),
    apg: num(raw.apg),
    spg: num(raw.spg),
    bpg: num(raw.bpg),
    fgPct: num(raw.fgPct),
    threePtPct: num(raw.threePtPct),
    ftPct: num(raw.ftPct),
  };

  // The volleyball stat surface is wide and optional; keep any numeric extras.
  for (const [key, value] of Object.entries(raw)) {
    if (key in base) continue;
    if (typeof value === "number" && Number.isFinite(value)) {
      (base as unknown as Record<string, number>)[key] = value;
    }
  }

  return base;
}

export function normalizePlayer(input: unknown): Player {
  const raw = asRecord(input, "player");
  const id = requireId(raw.id, "player.id");
  const rankBadges = Array.isArray(raw.rankBadges) ? raw.rankBadges.slice(0, 20) : [];

  return {
    id,
    personId: typeof raw.personId === "string" && raw.personId.trim() ? raw.personId.trim() : id,
    name: requireText(raw.name, "player.name", 120),
    jerseyNumber: intInRange(raw.jerseyNumber, 0, 999),
    position: oneOfOr(raw.position, POSITIONS, "SG"),
    teamId: requireId(raw.teamId, "player.teamId"),
    height: optionalText(raw.height, 24) ?? "",
    photoUrl: optionalText(raw.photoUrl, 500),
    seasonId: requireId(raw.seasonId, "player.seasonId"),
    seasonAverages: normalizeSeasonAverages(raw.seasonAverages),
    rankBadges: rankBadges.map((badge) => {
      const b = asRecord(badge, "player.rankBadges[]");
      return {
        label: optionalText(b.label, 80) ?? "",
        statKey: optionalText(b.statKey, 40) ?? "",
        rank: intInRange(b.rank, 1, 9999, 1),
        scope: b.scope === "team" ? ("team" as const) : ("league" as const),
      };
    }),
  };
}

function normalizeBoxScoreItem(input: unknown): BoxScoreItem {
  const raw = asRecord(input, "boxScore[]");
  const item: BoxScoreItem = {
    playerId: requireId(raw.playerId, "boxScore[].playerId"),
    pts: num(raw.pts),
    reb: num(raw.reb),
    ast: num(raw.ast),
    stl: num(raw.stl),
    blk: num(raw.blk),
    fgM: num(raw.fgM),
    fgA: num(raw.fgA),
    min: optionalText(raw.min, 12) ?? "0:00",
  };

  const optionalNumbers = [
    "jersey", "to", "pf", "threeM", "threeA", "ftM", "ftA",
    "atkPts", "blkPts", "acePts", "digs", "receptions",
  ] as const;
  for (const key of optionalNumbers) {
    if (raw[key] !== undefined && raw[key] !== null) {
      (item as unknown as Record<string, unknown>)[key] = num(raw[key]);
    }
  }
  if (raw.playerName !== undefined) item.playerName = optionalText(raw.playerName, 120) ?? undefined;
  if (raw.is_libero !== undefined) item.is_libero = Boolean(raw.is_libero);

  return item;
}

function normalizePlayByPlayEvent(input: unknown): PlayByPlayEvent {
  const raw = asRecord(input, "playByPlay[]");
  const score = asRecord(raw.currentScore ?? {}, "playByPlay[].currentScore");
  return {
    id: requireId(raw.id, "playByPlay[].id"),
    timestamp: optionalText(raw.timestamp, 12) ?? "",
    period: intInRange(raw.period, 0, 20),
    description: optionalText(raw.description, 500) ?? "",
    scoringTeamId: optionalText(raw.scoringTeamId, MAX_ID_LENGTH),
    currentScore: { home: intInRange(score.home, 0, 999), away: intInRange(score.away, 0, 999) },
    type: oneOfOr(raw.type, PBP_TYPES, "FG_MADE"),
  };
}

export function normalizeGame(input: unknown): Game {
  const raw = asRecord(input, "game");
  const boxScore = asRecord(raw.boxScore ?? {}, "game.boxScore");
  const homeTeam = normalizeTeam(raw.homeTeam);
  const awayTeam = normalizeTeam(raw.awayTeam);

  if (homeTeam.id === awayTeam.id) {
    throw new ValidationError("A game cannot have the same team on both sides.");
  }

  const stage = oneOfOr(raw.stage, STAGES, "ELIMINATION");

  return {
    id: requireId(raw.id, "game.id"),
    league: oneOf(raw.league, LEAGUES, "game.league"),
    seasonId: requireId(raw.seasonId, "game.seasonId"),
    homeTeam,
    awayTeam,
    homeScore: intInRange(raw.homeScore, 0, 999),
    awayScore: intInRange(raw.awayScore, 0, 999),
    status: oneOf(raw.status, GAME_STATUSES, "game.status"),
    quarterOrSet: intInRange(raw.quarterOrSet, 0, 20),
    timeRemaining: optionalText(raw.timeRemaining, 12),
    startTime: requireIsoDate(raw.startTime, "game.startTime"),
    venue: optionalText(raw.venue, 200),
    stage,
    isPlayoff: raw.isPlayoff === undefined ? stage !== "ELIMINATION" : Boolean(raw.isPlayoff),
    boxScore: {
      home: requireArray(boxScore.home ?? [], "game.boxScore.home", MAX_BOX_SCORE_ROWS).map(normalizeBoxScoreItem),
      away: requireArray(boxScore.away ?? [], "game.boxScore.away", MAX_BOX_SCORE_ROWS).map(normalizeBoxScoreItem),
    },
    playByPlay: requireArray(raw.playByPlay ?? [], "game.playByPlay", MAX_PBP_EVENTS).map(normalizePlayByPlayEvent),
  };
}

export function normalizeBatch<T>(
  input: unknown,
  label: string,
  normalize: (item: unknown) => T
): T[] {
  return requireArray(input, label, MAX_BATCH_SIZE).map(normalize);
}
