/**
 * Minimal pub-sub so client components can react to admin-panel edits that
 * mutate the data in lib/data.ts. Deliberately has no
 * "use client" directive and no React import -- it's plain, dependency-free
 * JS that's safe to import from both Server and Client Components.
 */

type Listener = () => void;

const listeners = new Set<Listener>();
let version = 0;

export function subscribeToDataChanges(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getDataVersion(): number {
  return version;
}

export function notifyDataChanged(): void {
  version++;
  listeners.forEach((listener) => listener());
}

// Cross-tab broadcast & storage listener so updates in one tab sync to others
if (typeof window !== "undefined") {
  window.addEventListener("storage", (e) => {
    if (e.key?.startsWith("sportsmetric_")) {
      notifyDataChanged();
    }
  });

  try {
    const channel = new BroadcastChannel("sportsmetric-sync");
    channel.onmessage = () => {
      notifyDataChanged();
    };
  } catch {
    // BroadcastChannel unsupported in old browser environments
  }
}

