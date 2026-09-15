import type { Game, Player, Season, Team } from "@/types/sports";

/**
 * Every write to the live sports tables goes through `/api/admin/mutate`.
 * The browser never talks to Supabase for writes -- the anon key cannot get
 * past RLS, and shipping a key that could would defeat the admin password.
 */
export type AdminMutation =
  | { op: "game.upsert"; game: Game }
  | { op: "game.batchUpsert"; games: Game[] }
  | { op: "game.delete"; id: string }
  | { op: "team.upsert"; team: Team }
  | { op: "team.delete"; id: string }
  | { op: "player.upsert"; player: Player }
  | { op: "player.batchUpsert"; players: Player[] }
  | { op: "player.delete"; id: string }
  | { op: "player.deleteAll"; seasonId: string }
  | { op: "season.batchUpsert"; seasons: Season[] }
  | { op: "season.delete"; id: string };

export type AdminMutationOp = AdminMutation["op"];

export class AdminMutationError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "AdminMutationError";
    this.status = status;
  }

  /** A 401 means the admin cookie expired; the UI should prompt a re-login. */
  get isUnauthorized(): boolean {
    return this.status === 401;
  }
}

export async function adminMutate(mutation: AdminMutation): Promise<void> {
  let response: Response;
  try {
    response = await fetch("/api/admin/mutate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "same-origin",
      body: JSON.stringify(mutation),
    });
  } catch {
    throw new AdminMutationError("Network error — check your connection and retry.", 0);
  }

  if (response.ok) return;

  const detail = (await response.json().catch(() => null)) as { error?: string } | null;
  const message =
    response.status === 401
      ? "Your admin session expired. Sign in again to continue."
      : detail?.error || `Request failed with status ${response.status}.`;

  throw new AdminMutationError(message, response.status);
}
