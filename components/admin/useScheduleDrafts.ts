"use client";

import { useCallback, useMemo, useState, useSyncExternalStore } from "react";
import { isDraftFixture, MAX_FIXTURES, type DraftFixture } from "@/lib/schedule-builder";

/** A separate browser draft per league/season; never writes a previous scope into a new one. */
export function useScheduleDrafts(key: string, initialDraft: DraftFixture) {
  const [memory, setMemory] = useState<Record<string, DraftFixture[]>>({});
  const [writeFailed, setWriteFailed] = useState(false);
  const subscribe = useCallback((onChange: () => void) => {
    const changed = (event: Event) => {
      if (event instanceof StorageEvent && event.key !== key && event.key !== null) return;
      onChange();
    };
    window.addEventListener("storage", changed);
    window.addEventListener("sportsmetric:schedule-draft", changed);
    return () => {
      window.removeEventListener("storage", changed);
      window.removeEventListener("sportsmetric:schedule-draft", changed);
    };
  }, [key]);
  const read = useCallback(() => {
    try { return window.localStorage.getItem(key); }
    catch { return "unavailable"; }
  }, [key]);
  const raw = useSyncExternalStore(subscribe, read, () => null);
  const ready = useSyncExternalStore(subscribe, () => true, () => false);
  const drafts = useMemo(() => {
    if (!writeFailed && raw && raw !== "unavailable") {
      try {
        const parsed: unknown = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0 && parsed.length <= MAX_FIXTURES && parsed.every(isDraftFixture) && new Set(parsed.map(row => row.id)).size === parsed.length) return parsed as DraftFixture[];
      } catch { /* A malformed browser draft falls back to an empty fixture. */ }
    }
    return memory[key] ?? [initialDraft];
  }, [raw, initialDraft, memory, key, writeFailed]);

  function setDrafts(next: DraftFixture[]) {
    setMemory(previous => ({ ...previous, [key]: next }));
    try {
      window.localStorage.setItem(key, JSON.stringify(next));
      setWriteFailed(false);
      window.dispatchEvent(new Event("sportsmetric:schedule-draft"));
    } catch { setWriteFailed(true); }
  }

  const storageStatus = !ready ? "loading" : raw === "unavailable" || writeFailed ? "unavailable" : "saved";
  return { drafts, setDrafts, storageStatus, ready };
}
