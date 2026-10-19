import { ValidationError } from "@/lib/admin-validation";
import { safeImageSource } from "@/lib/image-policy";
import {
  COMPETITION_LEVELS, FILIPINO_CONNECTIONS, MEDALS, REPRESENTATIONS, RESULT_TYPES,
  type IntlAthlete, type IntlCompetition, type IntlResult, type StatLine,
} from "@/lib/international";

/**
 * Rebuilds international entities field by field from untrusted admin input,
 * mirroring the database CHECK constraints so editors see a readable message
 * instead of a raw Postgres error.
 */

const SLUG = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

function record(value: unknown, label: string): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) throw new ValidationError(`${label} must be an object.`);
  return value as Record<string, unknown>;
}

function text(value: unknown, label: string, max = 300): string {
  if (typeof value !== "string" || !value.trim()) throw new ValidationError(`${label} is required.`);
  return value.trim().slice(0, max);
}

function optText(value: unknown, max = 300): string | null {
  return typeof value === "string" && value.trim() ? value.trim().slice(0, max) : null;
}

function slug(value: unknown, label: string, max: number): string {
  const v = text(value, label, max + 1);
  if (v.length > max || !SLUG.test(v)) throw new ValidationError(`${label} must use lowercase letters, numbers and single hyphens (max ${max}).`);
  return v;
}

function oneOf<T extends string>(value: unknown, allowed: readonly T[], label: string): T {
  if (typeof value === "string" && (allowed as readonly string[]).includes(value)) return value as T;
  throw new ValidationError(`${label} must be one of: ${allowed.join(", ")}.`);
}

function optOneOf<T extends string>(value: unknown, allowed: readonly T[], label: string): T | null {
  if (value === null || value === undefined || value === "") return null;
  return oneOf(value, allowed, label);
}

export function httpsUrl(value: unknown, label: string): string {
  const raw = text(value, label, 2000);
  let url: URL;
  try { url = new URL(raw); } catch { throw new ValidationError(`${label} must be a full https:// link.`); }
  if (url.protocol !== "https:" || url.username || url.password) throw new ValidationError(`${label} must be a public https:// link.`);
  return url.toString();
}

function optHttpsUrl(value: unknown, label: string): string | null {
  return optText(value, 2000) ? httpsUrl(value, label) : null;
}

function optDate(value: unknown, label: string): string | null {
  const v = optText(value, 10);
  if (!v) return null;
  if (!ISO_DATE.test(v) || Number.isNaN(Date.parse(`${v}T00:00:00Z`))) throw new ValidationError(`${label} must be a date (YYYY-MM-DD).`);
  return v;
}

function optPositiveInt(value: unknown, label: string): number | null {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(value);
  if (!Number.isInteger(n) || n <= 0 || n > 1_000_000) throw new ValidationError(`${label} must be a positive whole number.`);
  return n;
}

function optNumber(value: unknown, label: string): number | null {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(value);
  if (!Number.isFinite(n)) throw new ValidationError(`${label} must be a number.`);
  return n;
}

function statLine(value: unknown): StatLine | null {
  if (value === null || value === undefined || value === "") return null;
  const raw = record(value, "result.stats");
  const entries = Object.entries(raw).slice(0, 30).map(([key, v]): [string, number | string] => {
    const k = key.trim().slice(0, 20);
    if (!k) throw new ValidationError("Stat names cannot be blank.");
    if (typeof v === "number" && Number.isFinite(v)) return [k, v];
    if (typeof v === "string" && v.trim()) return [k, v.trim().slice(0, 40)];
    throw new ValidationError(`Stat "${k}" needs a value.`);
  });
  return entries.length ? Object.fromEntries(entries) : null;
}

export function normalizeIntlAthlete(input: unknown): IntlAthlete {
  const raw = record(input, "athlete");
  const sports = Array.isArray(raw.sports) ? raw.sports : [];
  const photo = optText(raw.photoUrl, 2000);
  const photoUrl = photo ? safeImageSource(photo) : null;
  if (photo && !photoUrl) throw new ValidationError("Use a local image path or an approved HTTPS image host (NEXT_PUBLIC_IMAGE_HOSTS).");
  const photoCredit = photoUrl ? optText(raw.photoCredit, 200) : null;
  const photoLicense = photoUrl ? optText(raw.photoLicense, 120) : null;
  const photoSource = photoUrl ? optText(raw.photoSourceUrl, 2000) : null;
  if (photoUrl && !photoCredit) throw new ValidationError("A photo needs a credit naming its photographer or rights holder.");
  if (photoUrl && !photoLicense) throw new ValidationError("A photo needs a license or permission note (e.g. CC BY-SA 4.0).");
  if (photoUrl && !photoSource) throw new ValidationError("A photo needs a source link for its credit and license.");
  return {
    id: slug(raw.id, "Athlete slug", 120),
    name: text(raw.name, "Athlete name", 120),
    sports: [...new Set(sports.map(s => optText(s, 60)).filter((s): s is string => Boolean(s)))].slice(0, 10),
    filipinoConnection: oneOf(raw.filipinoConnection, FILIPINO_CONNECTIONS, "Filipino connection"),
    connectionNote: optText(raw.connectionNote, 500),
    connectionSourceUrl: httpsUrl(raw.connectionSourceUrl, "Connection source"),
    personId: optText(raw.personId, 200),
    photoUrl,
    photoCredit,
    photoLicense,
    photoSourceUrl: photoSource ? httpsUrl(photoSource, "Photo source") : null,
    bio: optText(raw.bio, 2000),
    coverageNote: optText(raw.coverageNote, 500),
    published: Boolean(raw.published),
    reviewedAt: optDate(raw.reviewedAt, "Reviewed date"),
  };
}

export function normalizeIntlCompetition(input: unknown): IntlCompetition {
  const raw = record(input, "competition");
  const startDate = optDate(raw.startDate, "Start date");
  const endDate = optDate(raw.endDate, "End date");
  if (startDate && endDate && endDate < startDate) throw new ValidationError("End date cannot be before the start date.");
  return {
    id: slug(raw.id, "Competition ID", 160),
    name: text(raw.name, "Competition name", 200),
    sport: text(raw.sport, "Sport", 60),
    level: oneOf(raw.level, COMPETITION_LEVELS, "Level"),
    hostCountry: optText(raw.hostCountry, 80),
    season: optText(raw.season, 40),
    startDate, endDate,
    sourceUrl: optHttpsUrl(raw.sourceUrl, "Competition source"),
  };
}

export function normalizeIntlResult(input: unknown): IntlResult {
  const raw = record(input, "result");
  const resultType = oneOf(raw.resultType, RESULT_TYPES, "Result type");
  const placement = optPositiveInt(raw.placement, resultType === "ranking" ? "Rank" : "Placement");
  const fieldSize = optPositiveInt(raw.fieldSize, "Field size");
  const markValue = optNumber(raw.markValue, "Mark");
  const markUnit = optText(raw.markUnit, 20);
  const stats = statLine(raw.stats);
  if ((resultType === "placement" || resultType === "ranking") && placement === null) {
    throw new ValidationError(resultType === "ranking" ? "A ranking needs the rank number." : "A placement needs the finishing position.");
  }
  if (resultType === "mark" && (markValue === null || !markUnit)) throw new ValidationError("A mark needs both a value and a unit (e.g. 6.00 m).");
  if (resultType === "stat_line" && !stats) throw new ValidationError("A stat line needs at least one stat.");
  if (placement !== null && fieldSize !== null && placement > fieldSize) throw new ValidationError("Placement cannot be larger than the field size.");
  return {
    id: text(raw.id, "Result ID", 200),
    athleteId: slug(raw.athleteId, "Athlete", 120),
    competitionId: slug(raw.competitionId, "Competition", 160),
    event: text(raw.event, "Event", 160),
    representation: oneOf(raw.representation, REPRESENTATIONS, "Representation"),
    represented: text(raw.represented, "Represented country or club", 120),
    resultType, placement, fieldSize,
    medal: optOneOf(raw.medal, MEDALS, "Medal"),
    markValue, markUnit, stats,
    scope: optText(raw.scope, 120),
    resultDate: optDate(raw.resultDate, "Result date"),
    sourceUrl: httpsUrl(raw.sourceUrl, "Result source"),
    sourcePublisher: optText(raw.sourcePublisher, 120),
    reviewedAt: optDate(raw.reviewedAt, "Reviewed date"),
    notes: optText(raw.notes, 1000),
    published: Boolean(raw.published),
  };
}
