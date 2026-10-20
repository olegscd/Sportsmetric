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
  updateGameLinksInSupabase,
  updateSeasonActiveInSupabase,
  updateSeasonLinksInSupabase,
} from "@/lib/supabase-data";
import { normalizeGameLinks, normalizeSeasonLinks } from "@/lib/watch-links";
import {
  deleteIntlAthlete,
  deleteIntlCompetition,
  deleteIntlResult,
  upsertIntlAthlete,
  upsertIntlCompetition,
  upsertIntlResult,
} from "@/lib/international-data";
import {
  normalizeIntlAthlete,
  normalizeIntlCompetition,
  normalizeIntlResult,
} from "@/lib/international-validation";
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
  "season.active": (p) => {
    if (typeof p.active !== "boolean") throw new ValidationError("active must be true or false.");
    return updateSeasonActiveInSupabase(requireId(p.id, "id"), p.active);
  },
  "season.links": (p) => updateSeasonLinksInSupabase(requireId(p.id, "id"), normalizeSeasonLinks(p.links)),
  "game.links": (p) => updateGameLinksInSupabase(requireId(p.id, "id"), normalizeGameLinks(p.links)),

  "intl.athlete.upsert": (p) => upsertIntlAthlete(normalizeIntlAthlete(p.athlete)),
  "intl.athlete.delete": (p) => deleteIntlAthlete(requireId(p.id, "id")),
  "intl.competition.upsert": (p) => upsertIntlCompetition(normalizeIntlCompetition(p.competition)),
  "intl.competition.delete": (p) => deleteIntlCompetition(requireId(p.id, "id")),
  "intl.result.upsert": (p) => upsertIntlResult(normalizeIntlResult(p.result)),
  "intl.result.delete": (p) => deleteIntlResult(requireId(p.id, "id")),
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

  const contentLength = Number(request.headers.get("content-length") ?? "0");
  if (Number.isFinite(contentLength) && contentLength > 8_000_000) {
    return NextResponse.json({ error: "Request body is too large." }, { status: 413 });
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

  // hasOwn avoids resolving inherited properties such as "constructor" or
  // "__proto__" as if they were registered operations.
  if (!Object.hasOwn(HANDLERS, op)) {
    return NextResponse.json({ error: `Unknown operation "${op}".` }, { status: 400 });
  }
  const handler = HANDLERS[op];

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
