/**
 * Stateless utility module — provides ID generation and re-exports
 * of types/constants from the derivations layer.
 *
 * All mutable state and mutation functions have been consolidated
 * into SportsDataContext.tsx (the single source of truth).
 */

import {
  isLifetimeSeason,
  LIFETIME_SEASON_ID,
  type DerivedTeamStandings,
  type PlayerGameLogEntry,
  type StatLeaderEntry,
} from "@/lib/derivations";

export type { DerivedTeamStandings, PlayerGameLogEntry, StatLeaderEntry };
export { isLifetimeSeason, LIFETIME_SEASON_ID };

/** Unique ID generator for games, players, teams, seasons */
export function generateId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return Math.random().toString(36).substring(2, 11);
}