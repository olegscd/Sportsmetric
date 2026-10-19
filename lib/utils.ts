import { clsx, type ClassValue } from "clsx";

export function cn(...inputs: ClassValue[]): string {
  return clsx(inputs);
}

/** Formats a decimal percentage-like average (e.g. 46.2) as "46.2%". */
export function formatPct(value: number, digits = 1): string {
  return `${value.toFixed(digits)}%`;
}

/** Formats a season-average stat (e.g. ppg 19.8) to one decimal place. */
export function formatAvg(value: number, digits = 1): string {
  return value.toFixed(digits);
}

export function winPct(record: { wins: number; losses: number }): number {
  const total = record.wins + record.losses;
  return total === 0 ? 0 : record.wins / total;
}

export function formatRecord(record: { wins: number; losses: number }): string {
  return `${record.wins}-${record.losses}`;
}

export function formatOrdinal(n: number): string {
  const mod100 = n % 100;
  if (mod100 >= 11 && mod100 <= 13) return `${n}th`;
  switch (n % 10) {
    case 1:
      return `${n}st`;
    case 2:
      return `${n}nd`;
    case 3:
      return `${n}rd`;
    default:
      return `${n}th`;
  }
}

const LEAGUE_LABELS: Record<string, string> = {
  UAAP: "UAAP",
  PBA: "PBA",
  PVL: "PVL",
};

export function leagueLabel(league: string): string {
  return Object.hasOwn(LEAGUE_LABELS, league) ? LEAGUE_LABELS[league] : league;
}

/**
 * Formats an ISO start time into a clean date string (e.g. "Sep 21, 2025").
 */
export function formatGameDate(iso: string, includeYear = true): string {
  if (!iso) return "";
  const date = new Date(iso);
  if (isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("en-PH", {
    month: "short",
    day: "numeric",
    ...(includeYear ? { year: "numeric" } : {}),
    timeZone: "Asia/Manila",
  }).format(date);
}

/**
 * Formats an ISO start time into a short, deterministic display string
 * (e.g. "Aug 2, 2:00 PM"). Uses explicit Intl options and a fixed locale/
 * timezone so server and client render identically.
 */
export function formatStartTime(iso: string): string {
  const date = new Date(iso);
  if (isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("en-PH", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone: "Asia/Manila",
  }).format(date);
}

/**
 * Formats an ISO start time into a full day header (e.g. "Friday, Aug 21, 2026").
 */
export function formatFullDayHeader(iso: string): string {
  if (!iso) return "";
  const date = new Date(iso);
  if (isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("en-PH", {
    weekday: "long",
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "Asia/Manila",
  }).format(date);
}

// ---------------------------------------------------------------------------
// Philippine time helpers
//
// PHT is a fixed UTC+08:00 with no daylight saving, so offset arithmetic is
// exact and avoids relying on the browser's timezone (which is wrong for an
// admin working from abroad).
// ---------------------------------------------------------------------------

const PHT_OFFSET_MS = 8 * 60 * 60 * 1000;

function pad2(value: number): string {
  return String(value).padStart(2, "0");
}

/** Formats an ISO timestamp as a PHT `datetime-local` input value. */
export function isoToPhtInput(iso: string): string {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  const pht = new Date(date.getTime() + PHT_OFFSET_MS);
  return `${pht.getUTCFullYear()}-${pad2(pht.getUTCMonth() + 1)}-${pad2(
    pht.getUTCDate()
  )}T${pad2(pht.getUTCHours())}:${pad2(pht.getUTCMinutes())}`;
}

/** Converts a PHT `datetime-local` input value into an ISO timestamp. */
export function phtInputToIso(value: string): string {
  if (!value) return new Date().toISOString();
  const withSeconds = value.length === 16 ? `${value}:00` : value;
  const date = new Date(`${withSeconds}+08:00`);
  return Number.isNaN(date.getTime()) ? new Date().toISOString() : date.toISOString();
}

/** Today's date in PHT as `YYYY-MM-DD`. */
export function phtTodayInputDate(): string {
  return isoToPhtInput(new Date().toISOString()).slice(0, 10);
}



