import { findLeaguePage } from "@/lib/leagues";
import type { SportsDataScope } from "@/lib/supabase-data";
import type { League } from "@/types/sports";

export type ShellScopeResolution =
  | { kind: "player"; id: string; scope: SportsDataScope; query: string }
  | { kind: "team"; id: string; scope: SportsDataScope; query: string }
  | { kind: "league"; league: League; scope: SportsDataScope; query: string }
  | { kind: "default"; scope: SportsDataScope; query: string };

const METADATA_PREFIXES = [
  "/admin",
  "/uaap",
  "/news",
  "/about",
  "/international",
  "/athletes",
];

function safeDecode(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function matchesPrefix(pathname: string, prefix: string): boolean {
  return pathname === prefix || pathname.startsWith(`${prefix}/`);
}

/** Resolves the minimal server-side sports data scope needed for a route's shell. */
export function resolveShellScope(
  pathname: string,
  isAdmin: boolean
): ShellScopeResolution {
  if (pathname.startsWith("/players/") && pathname.length > "/players/".length) {
    const id = safeDecode(pathname.slice("/players/".length));
    return {
      kind: "player",
      id,
      scope: { playerId: id },
      query: `player=${encodeURIComponent(id)}`,
    };
  }

  if (pathname.startsWith("/teams/") && pathname.length > "/teams/".length) {
    const id = safeDecode(pathname.slice("/teams/".length));
    return {
      kind: "team",
      id,
      scope: { teamId: id },
      query: `team=${encodeURIComponent(id)}`,
    };
  }

  if (pathname.startsWith("/leagues/")) {
    const slug = pathname.split("/")[2] ?? "";
    const entry = findLeaguePage(slug);
    if (entry) {
      return {
        kind: "league",
        league: entry.league,
        scope: { league: entry.league },
        query: `league=${entry.league}`,
      };
    }
  }

  if (pathname === "/admin" && isAdmin) {
    return { kind: "default", scope: { admin: true }, query: "admin=1" };
  }

  if (METADATA_PREFIXES.some((prefix) => matchesPrefix(pathname, prefix))) {
    return { kind: "default", scope: { metadata: true }, query: "metadata=1" };
  }

  return { kind: "default", scope: { league: "UAAP" }, query: "league=UAAP" };
}
