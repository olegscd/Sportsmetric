import { isAdminAuthenticated } from "@/app/admin/actions";
import { generateId } from "@/lib/data";
import { supabase } from "@/lib/supabase";
import { upsertGameInSupabase, upsertPlayerInSupabase } from "@/lib/supabase-data";

import type { BoxScoreItem, Game, League, Player, Team, TournamentStage } from "@/types/sports";
import { execFile } from "child_process";
import { NextRequest, NextResponse } from "next/server";

import path from "path";
import util from "util";

const execFileAsync = util.promisify(execFile);

interface ExtractedBoxRow {
  playerName: string;
  jersey?: number | null;
  min: string;
  pts: number;
  reb: number;
  ast: number;
  stl: number;
  blk: number;
  to?: number;
  pf?: number;
  fgM: number;
  fgA: number;
  threeM?: number;
  threeA?: number;
  ftM?: number;
  ftA?: number;
}

interface ExtractedGamePayload {
  league: League;
  stage: TournamentStage;
  isPlayoff: boolean;
  status: "FINAL" | "LIVE" | "UPCOMING";
  competition: string;
  venue?: string;
  startTime: string;
  homeTeam: {
    name: string;
    shortName: string;
    score: number;
  };
  awayTeam: {
    name: string;
    shortName: string;
    score: number;
  };
  boxScore: {
    home: ExtractedBoxRow[];
    away: ExtractedBoxRow[];
  };
  note?: string;
}

function normalizeStr(str: string): string {
  return str.toLowerCase().replace(/[^a-z0-9]+/g, "").trim();
}

function findBestTeamMatch(extracted: { name: string; shortName: string }, teams: Team[]): Team | undefined {
  const shortTarget = normalizeStr(extracted.shortName);
  const nameTarget = normalizeStr(extracted.name);

  // Exact shortName match
  const byShort = teams.find((t) => normalizeStr(t.shortName) === shortTarget);
  if (byShort) return byShort;

  // Exact full name match
  const byName = teams.find((t) => normalizeStr(t.name) === nameTarget);
  if (byName) return byName;

  // Substring or prefix match
  const bySub = teams.find((t) => {
    const tName = normalizeStr(t.name);
    const tShort = normalizeStr(t.shortName);
    return (
      tName.includes(nameTarget) ||
      nameTarget.includes(tName) ||
      tName.includes(shortTarget) ||
      shortTarget.includes(tShort)
    );
  });

  return bySub;
}

function findBestPlayerMatch(row: ExtractedBoxRow, teamRoster: Player[]): Player | undefined {
  const rowNameNorm = normalizeStr(row.playerName);
  
  // 1. Direct name match
  const byName = teamRoster.find((p) => normalizeStr(p.name) === rowNameNorm);
  if (byName) return byName;

  // 2. Jersey number + partial name match
  if (row.jersey !== null && row.jersey !== undefined) {
    const byJersey = teamRoster.find((p) => p.jerseyNumber === row.jersey);
    if (byJersey) return byJersey;
  }

  // 3. Substring match (e.g. "Alarcon, H." or "Harold Alarcon")
  const bySub = teamRoster.find((p) => {
    const pNorm = normalizeStr(p.name);
    return pNorm.includes(rowNameNorm) || rowNameNorm.includes(pNorm);
  });

  return bySub;
}

export async function POST(req: NextRequest) {
  const isAuth = await isAdminAuthenticated();
  if (!isAuth) {
    return NextResponse.json({ error: "Unauthorized. Please log in as admin." }, { status: 401 });
  }

  let body: {
    url: string;
    league?: League;
    seasonId: string;
    stage?: TournamentStage;
    status?: "FINAL" | "LIVE" | "UPCOMING";
    previewOnly?: boolean;
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

  // Path to python script
  const scriptPath = path.resolve("extractors/extract_single_game.py");

  // Determine python executable
  const pythonCmd = process.platform === "win32" ? "python" : "python3";

  let stdout = "";
  let stderr = "";

  try {
    const result = await execFileAsync(pythonCmd, [
      scriptPath,
      "--url",
      url.trim(),
      "--league",
      league,
      "--stage",
      stage,
      "--status",
      status,
    ]);
    stdout = result.stdout;
    stderr = result.stderr;
  } catch (err: unknown) {
    const execErr = err as { stdout?: string; stderr?: string; message: string };
    console.error("[Python Extraction Error]:", execErr);
    return NextResponse.json(
      {
        error: "Failed to extract game data from URL.",
        details: execErr.stderr || execErr.stdout || execErr.message,
      },
      { status: 500 }
    );
  }

  let parsedPayload: ExtractedGamePayload;
  try {
    parsedPayload = JSON.parse(stdout);
  } catch {
    console.error("[JSON Parse Error on stdout]:", stdout, stderr);
    return NextResponse.json(
      {
        error: "Extractor returned invalid JSON output.",
        rawOutput: stdout,
      },
      { status: 500 }
    );
  }

  // Load teams and players for this season
  if (!supabase) {
    return NextResponse.json({ error: "Database client is not available." }, { status: 500 });
  }

  const [teamsRes, playersRes] = await Promise.all([
    supabase.from("teams").select("*").eq("season_id", seasonId),
    supabase.from("players").select("*").eq("season_id", seasonId),
  ]);

  if (teamsRes.error) {
    return NextResponse.json({ error: `Failed to fetch teams: ${teamsRes.error.message}` }, { status: 500 });
  }
  if (playersRes.error) {
    return NextResponse.json({ error: `Failed to fetch players: ${playersRes.error.message}` }, { status: 500 });
  }

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
      let matchedPlayer = findBestPlayerMatch(row, roster);

      if (!matchedPlayer && !previewOnly) {
        // Create new player record if not found in roster
        const newPlayerId = generateId();
        const personSlug = row.playerName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
        const newPlayer: Player = {
          id: newPlayerId,
          personId: personSlug,
          name: row.playerName,
          jerseyNumber: row.jersey ?? 0,
          position: "SG",
          teamId: team.id,
          height: `6'0"`,
          photoUrl: null,
          seasonId: team.seasonId,
          seasonAverages: {
            ppg: row.pts,
            rpg: row.reb,
            apg: row.ast,
            spg: row.stl,
            bpg: row.blk,
            fgPct: row.fgA > 0 ? Math.round((row.fgM / row.fgA) * 1000) / 10 : 0,
            threePtPct: row.threeA && row.threeA > 0 && row.threeM ? Math.round((row.threeM / row.threeA) * 1000) / 10 : 0,
            ftPct: row.ftA && row.ftA > 0 && row.ftM ? Math.round((row.ftM / row.ftA) * 1000) / 10 : 0,
            matchesPlayed: 1,
            totalPts: row.pts,
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
      });
    }

    return result;
  }

  const mappedHomeBox = await resolveBoxRows(parsedPayload.boxScore.home, homeTeamMatch, homeRoster);
  const mappedAwayBox = await resolveBoxRows(parsedPayload.boxScore.away, awayTeamMatch, awayRoster);

  // Generate clean natural ID or composite ID for game
  const dateSlug = parsedPayload.startTime.split("T")[0];
  const gameId = `${league.toLowerCase()}-${seasonId}-${homeTeamMatch.shortName.toLowerCase()}-vs-${awayTeamMatch.shortName.toLowerCase()}-${dateSlug}`;

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

  // Commit to Supabase
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
