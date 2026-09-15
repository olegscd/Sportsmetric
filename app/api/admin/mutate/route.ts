import { isAdminAuthenticated } from "@/lib/admin-auth";
import {
  ValidationError,
  normalizeBatch,
  normalizeGame,
  normalizePlayer,
  normalizeSeason,
  normalizeTeam,
  requireId,
} from "@/lib/admin-validation";
import { hasServiceRoleAccess } from "@/lib/supabase-admin";
import {
  batchUpsertGamesInSupabase,
  batchUpsertPlayersInSupabase,
  batchUpsertSeasonsInSupabase,
  deleteAllPlayersInSupabase,
  deleteGameInSupabase,
  deletePlayerInSupabase,
  deleteSeasonInSupabase,
  deleteTeamInSupabase,
  upsertGameInSupabase,
  upsertPlayerInSupabase,
  upsertTeamInSupabase,
} from "@/lib/supabase-data";
import { NextResponse } from "next/server";

/**
 * Single authenticated write endpoint for the live sports tables. The browser
 * has no Supabase write credentials, so every admin mutation lands here, gets
 * validated, and is executed with the service-role key.
 */

type OpHandler = (payload: Record<string, unknown>) => Promise<boolean>;

const HANDLERS: Record<string, OpHandler> = {
  "game.upsert": (p) => upsertGameInSupabase(normalizeGame(p.game)),
  "game.batchUpsert": (p) =>
    batchUpsertGamesInSupabase(normalizeBatch(p.games, "games", normalizeGame)),
  "game.delete": (p) => deleteGameInSupabase(requireId(p.id, "id")),

  "team.upsert": (p) => upsertTeamInSupabase(normalizeTeam(p.team)),
  "team.delete": (p) => deleteTeamInSupabase(requireId(p.id, "id")),

  "player.upsert": (p) => upsertPlayerInSupabase(normalizePlayer(p.player)),
  "player.batchUpsert": (p) =>
    batchUpsertPlayersInSupabase(normalizeBatch(p.players, "players", normalizePlayer)),
  "player.delete": (p) => deletePlayerInSupabase(requireId(p.id, "id")),
  "player.deleteAll": (p) =>
    deleteAllPlayersInSupabase(requireId(p.seasonId, "seasonId")),

  "season.batchUpsert": (p) =>
    batchUpsertSeasonsInSupabase(normalizeBatch(p.seasons, "seasons", normalizeSeason)),
  "season.delete": (p) => deleteSeasonInSupabase(requireId(p.id, "id")),
};

export async function POST(request: Request) {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  if (!hasServiceRoleAccess()) {
    return NextResponse.json(
      {
        error:
          "Server is missing SUPABASE_SERVICE_ROLE_KEY, so writes would be rejected by row-level security. Set it in the environment and redeploy.",
      },
      { status: 503 }
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Request body must be valid JSON." }, { status: 400 });
  }

  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    return NextResponse.json({ error: "Request body must be an object." }, { status: 400 });
  }

  const payload = body as Record<string, unknown>;
  const op = typeof payload.op === "string" ? payload.op : "";
  const handler = HANDLERS[op];

  if (!handler) {
    return NextResponse.json({ error: `Unknown operation "${op}".` }, { status: 400 });
  }

  try {
    const ok = await handler(payload);
    if (!ok) {
      return NextResponse.json(
        { error: `Database rejected the "${op}" operation. Check the server logs.` },
        { status: 500 }
      );
    }
    return NextResponse.json({ success: true });
  } catch (err) {
    if (err instanceof ValidationError) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    console.error(`[Admin mutate] Unexpected failure on "${op}":`, err);
    return NextResponse.json({ error: "Unexpected server error." }, { status: 500 });
  }
}
