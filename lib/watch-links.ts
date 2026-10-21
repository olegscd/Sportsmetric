import { ValidationError } from "@/lib/admin-validation";
import type { Game, GameLinks, GameStatus, ReplayKind, Season, SeasonLinks } from "@/types/sports";

/**
 * Watch / tickets / replay links. Season links are defaults; game links
 * override them for one fixture. Shared by data mapping, admin validation
 * and the UI so the "which link shows when" rule lives in one place.
 */

export const REPLAY_KINDS: ReplayKind[] = ["full", "highlights", "condensed"];
export const REPLAY_KIND_LABELS: Record<ReplayKind, string> = {
  full: "Full game", highlights: "Highlights", condensed: "Condensed game",
};

type Row = Record<string, unknown>;
const text = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : null);

export function seasonLinksFromRow(row: Row): SeasonLinks | undefined {
  const links: SeasonLinks = { watchUrl: text(row.watch_url), watchLabel: text(row.watch_label), watchNote: text(row.watch_note),
    ticketsUrl: text(row.tickets_url), ticketsLabel: text(row.tickets_label) };
  return Object.values(links).some(Boolean) ? links : undefined;
}

export function gameLinksFromRow(row: Row): GameLinks | undefined {
  const kind = text(row.replay_kind);
  const links: GameLinks = { watchUrl: text(row.watch_url), ticketsUrl: text(row.tickets_url), replayUrl: text(row.replay_url),
    replayKind: kind && (REPLAY_KINDS as string[]).includes(kind) ? kind as ReplayKind : null, replayLabel: text(row.replay_label) };
  return Object.values(links).some(Boolean) ? links : undefined;
}

export function seasonLinksToRow(l: SeasonLinks) {
  return { watch_url: l.watchUrl, watch_label: l.watchLabel, watch_note: l.watchNote, tickets_url: l.ticketsUrl, tickets_label: l.ticketsLabel };
}

export function gameLinksToRow(l: GameLinks) {
  return { watch_url: l.watchUrl, tickets_url: l.ticketsUrl, replay_url: l.replayUrl,
    replay_kind: l.replayUrl ? l.replayKind : null, replay_label: l.replayUrl ? l.replayLabel : null };
}

// ---------------------------------------------------------------------------
// Validation (admin writes)

function record(value: unknown, label: string): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) throw new ValidationError(`${label} must be an object.`);
  return value as Record<string, unknown>;
}

function optLabel(value: unknown, max = 60): string | null {
  return typeof value === "string" && value.trim() ? value.trim().slice(0, max) : null;
}

function optHttps(value: unknown, label: string): string | null {
  const raw = optLabel(value, 2000);
  if (!raw) return null;
  let url: URL;
  try { url = new URL(raw); } catch { throw new ValidationError(`${label} must be a full https:// link.`); }
  if (url.protocol !== "https:" || url.username || url.password) throw new ValidationError(`${label} must be a public https:// link.`);
  return url.toString();
}

/** A single YouTube video (watch?v=, youtu.be/, /live/<id>, /shorts/<id>). */
export function isSingleVideoUrl(raw: string): boolean {
  const url = new URL(raw);
  const host = url.hostname.replace(/^(www|m)\./, "");
  if (host === "youtu.be") return url.pathname.length > 1;
  if (host !== "youtube.com") return false;
  return url.pathname === "/watch" || /^\/(live|shorts|embed)\/[^/]+$/.test(url.pathname);
}

export function normalizeSeasonLinks(input: unknown): SeasonLinks {
  const raw = record(input, "links");
  const watchUrl = optHttps(raw.watchUrl, "Watch link");
  // Every game without its own link falls back to the season default, so a
  // single video here would send every upcoming and live game to one old game.
  if (watchUrl && isSingleVideoUrl(watchUrl)) {
    throw new ValidationError("The season Watch link must be a channel or its live/streams page, not a single video. Add a specific game's livestream on that game instead.");
  }
  return {
    watchUrl, watchLabel: optLabel(raw.watchLabel), watchNote: optLabel(raw.watchNote, 40),
    ticketsUrl: optHttps(raw.ticketsUrl, "Tickets link"), ticketsLabel: optLabel(raw.ticketsLabel),
  };
}

export function normalizeGameLinks(input: unknown): GameLinks {
  const raw = record(input, "links");
  const replayUrl = optHttps(raw.replayUrl, "Replay link");
  const kind = optLabel(raw.replayKind, 20);
  if (kind && !(REPLAY_KINDS as string[]).includes(kind)) throw new ValidationError(`Replay type must be one of: ${REPLAY_KINDS.join(", ")}.`);
  return {
    watchUrl: optHttps(raw.watchUrl, "Watch link"), ticketsUrl: optHttps(raw.ticketsUrl, "Tickets link"),
    replayUrl, replayKind: replayUrl ? (kind as ReplayKind | null) ?? "highlights" : null,
    replayLabel: replayUrl ? optLabel(raw.replayLabel) : null,
  };
}

// ---------------------------------------------------------------------------
// Display rule

export type GameAction = { kind: "tickets" | "watch" | "replay"; url: string; label: string; detail: string | null };

function host(url: string) {
  try { return new URL(url).hostname.replace(/^www\./, ""); } catch { return url; }
}

/**
 * Upcoming: tickets first, then where to watch, using season defaults.
 * Live: only this game's livestream. Final: only this game's replay.
 */
export function gameActions(
  game: Pick<Game, "links"> & { status: GameStatus; startTime?: string },
  season: Pick<Season, "links"> | undefined,
  now: number = Date.now(),
): GameAction[] {
  const g = game.links; const s = season?.links;
  if (game.status === "FINAL") {
    return g?.replayUrl ? [{ kind: "replay", url: g.replayUrl, label: g.replayLabel ?? host(g.replayUrl),
      detail: g.replayKind ? REPLAY_KIND_LABELS[g.replayKind] : null }] : [];
  }
  if (game.status === "LIVE") {
    return g?.watchUrl ? [{ kind: "watch", url: g.watchUrl, label: host(g.watchUrl), detail: null }] : [];
  }

  const watchUrl = g?.watchUrl ?? s?.watchUrl ?? null;
  const ticketsUrl = g?.ticketsUrl ?? s?.ticketsUrl ?? null;
  // A per-game watch link may point to another broadcaster, so only reuse
  // the season's broadcaster name when the URL also comes from the season.
  const watchLabel = g?.watchUrl ? host(g.watchUrl) : s?.watchLabel ?? (watchUrl ? host(watchUrl) : "");
  const watch: GameAction | null = watchUrl
    ? { kind: "watch", url: watchUrl, label: watchLabel, detail: g?.watchUrl ? null : s?.watchNote ?? null } : null;

  // Some leagues (PVL) stay UPCOMING until the official result arrives, so
  // stop selling tickets once the scheduled start has passed.
  const started = game.startTime ? Date.parse(game.startTime) <= now : false;
  const tickets: GameAction | null = ticketsUrl && !started
    ? { kind: "tickets", url: ticketsUrl, label: g?.ticketsUrl ? host(g.ticketsUrl) : s?.ticketsLabel ?? host(ticketsUrl), detail: null } : null;
  return [tickets, watch].filter((a): a is GameAction => a !== null);
}
