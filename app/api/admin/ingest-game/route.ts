import { isAdminAuthenticated } from "@/lib/admin-auth";
import { generateId } from "@/lib/data";
import { buildGameId } from "@/lib/game-id";
import { extractGameFromUrl, type ExtractedBoxRow, type ExtractedGamePayload } from "@/lib/game-extractor";
import { findBestPlayerMatch, findBestTeamMatch } from "@/lib/game-ingest-match";
import { supabase } from "@/lib/supabase";
import { hasServiceRoleAccess } from "@/lib/supabase-admin";
import {
  upsertGameInSupabase,
  upsertPlayerInSupabase,
} from "@/lib/supabase-data";
import type { BoxScoreItem, Game, League, Player, Team, TournamentStage } from "@/types/sports";
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  const isAuth = await isAdminAuthenticated();
  if (!isAuth) {
    return NextResponse.json({ error: "Unauthorized. Please log in as admin." }, { status: 401 });
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

  let body: {
    url: string;
    league?: League;
    seasonId: string;
    stage?: TournamentStage;
    status?: "FINAL" | "LIVE" | "UPCOMING";
    previewOnly?: boolean;
    /** Preview payload returned by an earlier previewOnly call. */
    parsedPayload?: ExtractedGamePayload;
  };

  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON request body." }, { status: 400 });
  }

  const { url, league = "UAAP", seasonId, stage = "ELIMINATION", status = "FINAL", previewOnly = false } = body;

  if (!url || !url.trim()) {
    return NextResponse.json({ error: "Game URL is required." }, { status: 400 });
  }
  if (!seasonId || !seasonId.trim()) {
    return NextResponse.json({ error: "Season ID is required." }, { status: 400 });
  }

  let parsedPayload: ExtractedGamePayload;
  if (body.parsedPayload) {
    // The admin UI sends back the payload it already previewed, so saving does
    // not re-fetch the source (and cannot save a different match than the one
    // that was reviewed).
    const candidate = body.parsedPayload;
    if (
      !candidate.homeTeam ||
      !candidate.awayTeam ||
      !candidate.boxScore?.home ||
      !candidate.boxScore?.away ||
      !candidate.startTime
    ) {
      return NextResponse.json({ error: "Invalid preview payload." }, { status: 400 });
    }
    parsedPayload = candidate;
  } else {
    try {
      parsedPayload = await extractGameFromUrl(url.trim(), league, stage, status);
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      console.error("[Extraction Error]:", errorMsg);
      return NextResponse.json(
        {
          error: "Failed to extract game data from URL.",
          details: errorMsg,
        },
        { status: 500 }
      );
    }
  }


  // Load teams and players for this season
  if (!supabase) {
    return NextResponse.json({ error: "Database client is not available." }, { status: 500 });
  }

  const [teamsRes, playersRes, gamesRes] = await Promise.all([
    supabase.from("teams").select("*").eq("season_id", seasonId),
    supabase.from("players").select("*").eq("season_id", seasonId),
    supabase
      .from("games")
      .select("id, home_team_id, away_team_id, start_time")
      .eq("season_id", seasonId),
  ]);

  if (teamsRes.error) {
    return NextResponse.json({ error: `Failed to fetch teams: ${teamsRes.error.message}` }, { status: 500 });
  }
  if (playersRes.error) {
    return NextResponse.json({ error: `Failed to fetch players: ${playersRes.error.message}` }, { status: 500 });
  }
  if (gamesRes.error) {
    return NextResponse.json({ error: `Failed to fetch games: ${gamesRes.error.message}` }, { status: 500 });
  }

  const existingGames = (gamesRes.data ?? []) as Array<{
    id: string;
    home_team_id: string;
    away_team_id: string;
    start_time: string;
  }>;

  const seasonTeams: Team[] = (teamsRes.data ?? []).map((t) => ({
    id: t.id,
    name: t.name,
    shortName: t.short_name,
    logo: t.logo,
    league: t.league,
    accentColor: t.accent_color,
    seasonId: t.season_id,
    record: t.record ?? { wins: 0, losses: 0 },
  }));

  const seasonPlayers: Player[] = (playersRes.data ?? []).map((p) => ({
    id: p.id,
    personId: p.person_id,
    name: p.name,
    jerseyNumber: p.jersey_number,
    position: p.position,
    teamId: p.team_id,
    height: p.height,
    photoUrl: p.photo_url,
    seasonId: p.season_id,
    seasonAverages: p.season_averages ?? {
      ppg: 0, rpg: 0, apg: 0, spg: 0, bpg: 0, fgPct: 0, threePtPct: 0, ftPct: 0,
    },
    rankBadges: p.rank_badges ?? [],
  }));

  const homeTeamMatch = findBestTeamMatch(parsedPayload.homeTeam, seasonTeams);
  const awayTeamMatch = findBestTeamMatch(parsedPayload.awayTeam, seasonTeams);

  if (!homeTeamMatch || !awayTeamMatch) {
    return NextResponse.json(
      {
        error: "Could not resolve team identities for this season.",
        detectedHome: parsedPayload.homeTeam,
        matchedHome: homeTeamMatch ? homeTeamMatch.shortName : null,
        detectedAway: parsedPayload.awayTeam,
        matchedAway: awayTeamMatch ? awayTeamMatch.shortName : null,
        availableTeams: seasonTeams.map((t) => ({ id: t.id, name: t.name, shortName: t.shortName })),
      },
      { status: 422 }
    );
  }

  // Map Box Scores
  const homeRoster = seasonPlayers.filter((p) => p.teamId === homeTeamMatch.id);
  const awayRoster = seasonPlayers.filter((p) => p.teamId === awayTeamMatch.id);

  const createdPlayers: Player[] = [];


  async function resolveBoxRows(rows: ExtractedBoxRow[], team: Team, roster: Player[]): Promise<BoxScoreItem[]> {
    const result: BoxScoreItem[] = [];

    for (const row of rows) {
      const personSlug = row.playerName
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "");
      let matchedPlayer =
        findBestPlayerMatch(row, roster) ??
        roster.find((p) => p.personId === personSlug);

      if (!matchedPlayer && !previewOnly) {
        // A deterministic id makes re-running an import idempotent: the same
        // athlete upserts instead of creating a duplicate row every time.
        const newPlayerId = `${team.id}-${personSlug}`.slice(0, 200);
        const newPlayer: Player = {
          id: newPlayerId,
          personId: personSlug,
          name: row.playerName,
          jerseyNumber: row.jersey ?? 0,
          position: league === "PVL" ? "OH" : "SG",
          teamId: team.id,
          height: "",
          photoUrl: null,
          seasonId: team.seasonId,
          // Let derivePlayerAverages compute the real season line from box
          // scores; a single-game snapshot here would be misleading.
          seasonAverages: {
            ppg: 0,
            rpg: 0,
            apg: 0,
            spg: 0,
            bpg: 0,
            fgPct: 0,
            threePtPct: 0,
            ftPct: 0,
          },
          rankBadges: [],
        };

        const ok = await upsertPlayerInSupabase(newPlayer);
        if (ok) {
          createdPlayers.push(newPlayer);
          roster.push(newPlayer);
          matchedPlayer = newPlayer;
        }
      }

      result.push({
        playerId: matchedPlayer ? matchedPlayer.id : generateId(),
        jersey: row.jersey ?? (matchedPlayer?.jerseyNumber && matchedPlayer.jerseyNumber > 0 ? matchedPlayer.jerseyNumber : undefined),
        playerName: matchedPlayer?.name ?? row.playerName,
        pts: row.pts,
        reb: row.reb,
        ast: row.ast,
        stl: row.stl,
        blk: row.blk,
        to: row.to ?? 0,
        pf: row.pf ?? 0,
        fgM: row.fgM,
        fgA: row.fgA,
        threeM: row.threeM ?? 0,
        threeA: row.threeA ?? 0,
        ftM: row.ftM ?? 0,
        ftA: row.ftA ?? 0,
        min: row.min,
        is_libero: "is_libero" in row ? Boolean(row.is_libero) : undefined,
      });

    }

    return result;
  }

  const mappedHomeBox = await resolveBoxRows(parsedPayload.boxScore.home, homeTeamMatch, homeRoster);
  const mappedAwayBox = await resolveBoxRows(parsedPayload.boxScore.away, awayTeamMatch, awayRoster);

  // Re-use the existing fixture id when the same teams meet at the same time,
  // so re-importing updates it instead of creating a duplicate. Otherwise
  // fall back to the shared collision-safe id builder.
  const existingFixture = existingGames.find(
    (g) =>
      new Date(g.start_time).getTime() === new Date(parsedPayload.startTime).getTime() &&
      ((g.home_team_id === homeTeamMatch.id && g.away_team_id === awayTeamMatch.id) ||
        (g.home_team_id === awayTeamMatch.id && g.away_team_id === homeTeamMatch.id))
  );
  const gameId =
    existingFixture?.id ??
    buildGameId({
      league,
      seasonId,
      homeShort: homeTeamMatch.shortName,
      awayShort: awayTeamMatch.shortName,
      startTimeIso: parsedPayload.startTime,
      claimedIds: new Set(existingGames.map((g) => g.id)),
    });

  const game: Game = {
    id: gameId,
    league,
    seasonId,
    homeTeam: homeTeamMatch,
    awayTeam: awayTeamMatch,
    homeScore: parsedPayload.homeTeam.score,
    awayScore: parsedPayload.awayTeam.score,
    status: parsedPayload.status,
    quarterOrSet: 4,
    timeRemaining: null,
    startTime: parsedPayload.startTime,
    venue: parsedPayload.venue || null,
    stage: parsedPayload.stage,
    isPlayoff: parsedPayload.isPlayoff,
    boxScore: {
      home: mappedHomeBox,
      away: mappedAwayBox,
    },
    playByPlay: [],
  };

  if (previewOnly) {
    return NextResponse.json({
      preview: true,
      game,
      parsedPayload,
      matchedTeams: {
        home: homeTeamMatch,
        away: awayTeamMatch,
      },
    });
  }

  const success = await upsertGameInSupabase(game);
  if (!success) {
    return NextResponse.json({ error: "Failed to upsert game in database." }, { status: 500 });
  }

  return NextResponse.json({
    success: true,
    game,
    createdPlayersCount: createdPlayers.length,
    matchedHomePlayerCount: mappedHomeBox.length,
    matchedAwayPlayerCount: mappedAwayBox.length,
  });
}

