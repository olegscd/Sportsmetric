/**
 * International coverage: types and pure formatting helpers shared by the
 * public pages, the admin workspace and tests. No database access here.
 */

/**
 * Master switch for public discovery. While false, /international and athlete
 * pages still render for anyone with the URL (useful for review) but carry
 * noindex and stay out of the navigation and sitemap. Flip to true once the
 * first verified profiles are published.
 */
export const INTERNATIONAL_LAUNCHED = false;

export const FILIPINO_CONNECTIONS = ["citizen", "dual_citizen", "naturalized", "heritage"] as const;
export type FilipinoConnection = (typeof FILIPINO_CONNECTIONS)[number];

export const COMPETITION_LEVELS = ["olympics", "world_championship", "continental", "regional",
  "world_tour", "international_club", "foreign_league", "foreign_collegiate", "other"] as const;
export type CompetitionLevel = (typeof COMPETITION_LEVELS)[number];

export const REPRESENTATIONS = ["national_team", "club", "individual"] as const;
export type Representation = (typeof REPRESENTATIONS)[number];

export const RESULT_TYPES = ["placement", "mark", "ranking", "stat_line", "award"] as const;
export type ResultType = (typeof RESULT_TYPES)[number];

export const MEDALS = ["gold", "silver", "bronze"] as const;
export type Medal = (typeof MEDALS)[number];

export const CONNECTION_LABELS: Record<FilipinoConnection, string> = {
  citizen: "Filipino citizen",
  dual_citizen: "Dual citizen",
  naturalized: "Naturalized Filipino",
  heritage: "Filipino heritage",
};

export const LEVEL_LABELS: Record<CompetitionLevel, string> = {
  olympics: "Olympic Games",
  world_championship: "World Championship",
  continental: "Continental",
  regional: "Regional Games",
  world_tour: "World Tour / Circuit",
  international_club: "International Club",
  foreign_league: "Foreign Pro League",
  foreign_collegiate: "Foreign Collegiate",
  other: "Other",
};

export const REPRESENTATION_LABELS: Record<Representation, string> = {
  national_team: "National team",
  club: "Club",
  individual: "Individual",
};

export const RESULT_TYPE_LABELS: Record<ResultType, string> = {
  placement: "Placement",
  mark: "Mark (time, distance, score)",
  ranking: "Ranking",
  stat_line: "Stat line",
  award: "Award",
};

export interface IntlAthlete {
  id: string;
  name: string;
  sports: string[];
  filipinoConnection: FilipinoConnection;
  connectionNote: string | null;
  connectionSourceUrl: string;
  personId: string | null;
  photoUrl: string | null;
  bio: string | null;
  coverageNote: string | null;
  published: boolean;
  reviewedAt: string | null;
}

export interface IntlCompetition {
  id: string;
  name: string;
  sport: string;
  level: CompetitionLevel;
  hostCountry: string | null;
  season: string | null;
  startDate: string | null;
  endDate: string | null;
  sourceUrl: string | null;
}

export type StatLine = Record<string, number | string>;

export interface IntlResult {
  id: string;
  athleteId: string;
  competitionId: string;
  event: string;
  representation: Representation;
  represented: string;
  resultType: ResultType;
  placement: number | null;
  fieldSize: number | null;
  medal: Medal | null;
  markValue: number | null;
  markUnit: string | null;
  stats: StatLine | null;
  scope: string | null;
  resultDate: string | null;
  sourceUrl: string;
  sourcePublisher: string | null;
  reviewedAt: string | null;
  notes: string | null;
  published: boolean;
}

export interface InternationalData {
  athletes: IntlAthlete[];
  competitions: IntlCompetition[];
  results: IntlResult[];
  /** False when the international tables have not been migrated yet. */
  available: boolean;
}

export const EMPTY_INTERNATIONAL: InternationalData = { athletes: [], competitions: [], results: [], available: false };

// ---------------------------------------------------------------------------
// Row mapping (snake_case database <-> camelCase app)

type Row = Record<string, unknown>;
const str = (value: unknown) => (typeof value === "string" && value.trim() ? value : null);
const numOrNull = (value: unknown) => {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

export function athleteFromRow(row: Row): IntlAthlete {
  return {
    id: String(row.id), name: String(row.name ?? ""),
    sports: Array.isArray(row.sports) ? row.sports.map(String) : [],
    filipinoConnection: (FILIPINO_CONNECTIONS as readonly string[]).includes(String(row.filipino_connection))
      ? row.filipino_connection as FilipinoConnection : "citizen",
    connectionNote: str(row.connection_note), connectionSourceUrl: String(row.connection_source_url ?? ""),
    personId: str(row.person_id), photoUrl: str(row.photo_url), bio: str(row.bio),
    coverageNote: str(row.coverage_note), published: Boolean(row.published), reviewedAt: str(row.reviewed_at),
  };
}

export function athleteToRow(a: IntlAthlete): Row {
  return { id: a.id, name: a.name, sports: a.sports, filipino_connection: a.filipinoConnection,
    connection_note: a.connectionNote, connection_source_url: a.connectionSourceUrl, person_id: a.personId,
    photo_url: a.photoUrl, bio: a.bio, coverage_note: a.coverageNote, published: a.published,
    reviewed_at: a.reviewedAt, updated_at: new Date().toISOString() };
}

export function competitionFromRow(row: Row): IntlCompetition {
  return {
    id: String(row.id), name: String(row.name ?? ""), sport: String(row.sport ?? ""),
    level: (COMPETITION_LEVELS as readonly string[]).includes(String(row.level)) ? row.level as CompetitionLevel : "other",
    hostCountry: str(row.host_country), season: str(row.season), startDate: str(row.start_date),
    endDate: str(row.end_date), sourceUrl: str(row.source_url),
  };
}

export function competitionToRow(c: IntlCompetition): Row {
  return { id: c.id, name: c.name, sport: c.sport, level: c.level, host_country: c.hostCountry, season: c.season,
    start_date: c.startDate, end_date: c.endDate, source_url: c.sourceUrl, updated_at: new Date().toISOString() };
}

export function resultFromRow(row: Row): IntlResult {
  const stats = row.stats && typeof row.stats === "object" && !Array.isArray(row.stats) ? row.stats as StatLine : null;
  return {
    id: String(row.id), athleteId: String(row.athlete_id), competitionId: String(row.competition_id),
    event: String(row.event ?? ""),
    representation: (REPRESENTATIONS as readonly string[]).includes(String(row.representation)) ? row.representation as Representation : "individual",
    represented: String(row.represented ?? ""),
    resultType: (RESULT_TYPES as readonly string[]).includes(String(row.result_type)) ? row.result_type as ResultType : "award",
    placement: numOrNull(row.placement), fieldSize: numOrNull(row.field_size),
    medal: (MEDALS as readonly string[]).includes(String(row.medal)) ? row.medal as Medal : null,
    markValue: numOrNull(row.mark_value), markUnit: str(row.mark_unit), stats,
    scope: str(row.scope), resultDate: str(row.result_date), sourceUrl: String(row.source_url ?? ""),
    sourcePublisher: str(row.source_publisher), reviewedAt: str(row.reviewed_at), notes: str(row.notes),
    published: Boolean(row.published),
  };
}

export function resultToRow(r: IntlResult): Row {
  return { id: r.id, athlete_id: r.athleteId, competition_id: r.competitionId, event: r.event,
    representation: r.representation, represented: r.represented, result_type: r.resultType,
    placement: r.placement, field_size: r.fieldSize, medal: r.medal, mark_value: r.markValue,
    mark_unit: r.markUnit, stats: r.stats, scope: r.scope, result_date: r.resultDate,
    source_url: r.sourceUrl, source_publisher: r.sourcePublisher, reviewed_at: r.reviewedAt,
    notes: r.notes, published: r.published, updated_at: new Date().toISOString() };
}

// ---------------------------------------------------------------------------
// Formatting

export function ordinal(n: number): string {
  const mod100 = n % 100;
  if (mod100 >= 11 && mod100 <= 13) return `${n}th`;
  return `${n}${({ 1: "st", 2: "nd", 3: "rd" } as Record<number, string>)[n % 10] ?? "th"}`;
}

export const MEDAL_LABELS: Record<Medal, string> = { gold: "Gold", silver: "Silver", bronze: "Bronze" };

function formatNumber(value: number): string {
  return Number.isInteger(value) ? value.toLocaleString("en-PH") : String(value);
}

export function formatStatLine(stats: StatLine): string {
  return Object.entries(stats).map(([key, value]) => `${typeof value === "number" ? formatNumber(value) : value} ${key.toUpperCase()}`).join(" · ");
}

/** The main figure for a result, e.g. "Gold · 1st of 12", "6.00 m", "No. 54". */
export function formatResultHeadline(r: IntlResult): string {
  switch (r.resultType) {
    case "placement": {
      const place = r.placement ? `${ordinal(r.placement)}${r.fieldSize ? ` of ${r.fieldSize}` : ""}` : "";
      return [r.medal ? MEDAL_LABELS[r.medal] : null, place || null].filter(Boolean).join(" · ");
    }
    case "mark": {
      const mark = r.markValue === null ? "" : `${r.markValue} ${r.markUnit ?? ""}`.trim();
      return [r.medal ? MEDAL_LABELS[r.medal] : null, mark || null, r.placement ? ordinal(r.placement) : null].filter(Boolean).join(" · ");
    }
    case "ranking":
      return r.placement ? `No. ${r.placement.toLocaleString("en-PH")}` : "Ranked";
    case "stat_line":
      return r.stats ? formatStatLine(r.stats) : "";
    case "award":
      return r.medal ? MEDAL_LABELS[r.medal] : "Award";
  }
}

/** Best available date for ordering: explicit result date, then competition dates, then season. */
export function resultSortKey(r: IntlResult, c: IntlCompetition | undefined): string {
  return r.resultDate ?? c?.endDate ?? c?.startDate ?? c?.season ?? "";
}

export function sortResultsNewestFirst(results: IntlResult[], competitions: Map<string, IntlCompetition>): IntlResult[] {
  return [...results].sort((a, b) => resultSortKey(b, competitions.get(b.competitionId))
    .localeCompare(resultSortKey(a, competitions.get(a.competitionId))) || a.event.localeCompare(b.event));
}

export function competitionDateLabel(c: IntlCompetition): string {
  const fmt = (iso: string) => new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-PH", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
  if (c.startDate && c.endDate && c.startDate !== c.endDate) return `${fmt(c.startDate)} – ${fmt(c.endDate)}`;
  if (c.startDate || c.endDate) return fmt((c.startDate ?? c.endDate)!);
  return c.season ?? "";
}

export function medalCount(results: IntlResult[]): Record<Medal, number> {
  const counts: Record<Medal, number> = { gold: 0, silver: 0, bronze: 0 };
  for (const r of results) if (r.medal) counts[r.medal] += 1;
  return counts;
}

/** Weighted medal score for the public top-performers leaderboard. */
export const MEDAL_POINTS: Record<Medal, number> = { gold: 3, silver: 2, bronze: 1 };

export interface AthletePerformance {
  athlete: IntlAthlete;
  results: IntlResult[];
  medals: Record<Medal, number>;
  medalPoints: number;
  /** Finishes inside the top three, including events that do not award medals. */
  podiums: number;
  /** Strongest result by medal, then finishing position, then recency. */
  bestResult: IntlResult | null;
  latestResult: IntlResult | null;
  /** Sort key for latestResult, including competition dates when known. */
  latestDate: string;
}

const NO_PLACEMENT = Number.MAX_SAFE_INTEGER;
const medalRank = (result: IntlResult) => result.medal ? MEDALS.indexOf(result.medal) : MEDALS.length;

export function summarizeAthletePerformances(
  athletes: IntlAthlete[],
  results: IntlResult[],
  competitions: Map<string, IntlCompetition> = new Map(),
): AthletePerformance[] {
  const byAthlete = new Map<string, IntlResult[]>();
  for (const result of results) {
    byAthlete.set(result.athleteId, [...(byAthlete.get(result.athleteId) ?? []), result]);
  }

  return athletes.map(athlete => {
    const own = byAthlete.get(athlete.id) ?? [];
    const medals = medalCount(own);
    const bestResult = [...own].sort((a, b) =>
      medalRank(a) - medalRank(b) ||
      (a.placement ?? NO_PLACEMENT) - (b.placement ?? NO_PLACEMENT) ||
      (b.resultDate ?? "").localeCompare(a.resultDate ?? ""))[0] ?? null;
    const latestResult = sortResultsNewestFirst(own, competitions)[0] ?? null;
    return {
      athlete, results: own, medals,
      medalPoints: medals.gold * MEDAL_POINTS.gold + medals.silver * MEDAL_POINTS.silver + medals.bronze * MEDAL_POINTS.bronze,
      podiums: own.filter(result => result.medal || (result.placement !== null && result.placement <= 3)).length,
      bestResult, latestResult,
      latestDate: latestResult ? resultSortKey(latestResult, competitions.get(latestResult.competitionId)) : "",
    };
  });
}

export function compareAthletePerformances(a: AthletePerformance, b: AthletePerformance): number {
  return b.medalPoints - a.medalPoints
    || b.medals.gold - a.medals.gold
    || b.medals.silver - a.medals.silver
    || b.medals.bronze - a.medals.bronze
    || b.podiums - a.podiums
    || (a.bestResult?.placement ?? NO_PLACEMENT) - (b.bestResult?.placement ?? NO_PLACEMENT)
    || b.latestDate.localeCompare(a.latestDate)
    || a.athlete.name.localeCompare(b.athlete.name);
}

/** The top N performers, plus everyone else for a compact directory. */
export function selectTopPerformers(
  athletes: IntlAthlete[],
  results: IntlResult[],
  limit = 10,
  competitions: Map<string, IntlCompetition> = new Map(),
): { top: AthletePerformance[]; rest: AthletePerformance[] } {
  const summaries = summarizeAthletePerformances(athletes, results, competitions);
  const ranked = summaries.filter(summary => summary.results.length > 0).sort(compareAthletePerformances);
  const unranked = summaries.filter(summary => summary.results.length === 0)
    .sort((a, b) => a.athlete.name.localeCompare(b.athlete.name));
  const capped = Math.max(0, limit);
  return { top: ranked.slice(0, capped), rest: [...ranked.slice(capped), ...unranked] };
}

export function athletePath(id: string): string {
  return `/athletes/${encodeURIComponent(id)}`;
}

export function slugify(value: string): string {
  return value.normalize("NFKD").replace(/[̀-ͯ]/g, "").toLowerCase()
    .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 120);
}

export function sourceHost(url: string): string {
  try { return new URL(url).hostname.replace(/^www\./, ""); } catch { return url; }
}

/** "ppg=12.4, gp=30" -> { ppg: 12.4, gp: 30 }. Throws on malformed pairs. */
export function parseStats(input: string): StatLine | null {
  const pairs = input.split(/[,\n]/).map(part => part.trim()).filter(Boolean);
  if (!pairs.length) return null;
  return Object.fromEntries(pairs.map(pair => {
    const [key, ...rest] = pair.split("=");
    const value = rest.join("=").trim();
    if (!key.trim() || !value) throw new Error(`Write each stat as name=value (problem: "${pair}").`);
    const n = Number(value);
    return [key.trim(), Number.isFinite(n) ? n : value];
  }));
}
