"use client";

import { useSyncExternalStore } from "react";
import { getDataVersion, subscribeToDataChanges } from "@/lib/data-events";

function getServerSnapshot(): number {
  return 0;
}

/**
 * Subscribes the calling component to admin-panel data edits. The returned
 * number changes every time lib/data.ts mutation helpers (saveTeam,
 * savePlayer, updateGameScore, etc.) run, which is enough to force any
 * component that reads live selector functions in its render body to
 * recompute and re-render with the latest localStorage-backed data.
 *
 * Uses useSyncExternalStore so the server-rendered/statically-generated
 * markup (which always reflects lib/mock-data.ts) matches on hydration,
 * then immediately re-renders with live client data if it differs -- no
 * hydration mismatch warnings.
 */
export function useLiveData(): number {
  return useSyncExternalStore(subscribeToDataChanges, getDataVersion, getServerSnapshot);
}
