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
  return LEAGUE_LABELS[league] ?? league;
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

