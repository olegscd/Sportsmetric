import { isAdminAuthenticated } from "@/lib/admin-auth";
import { generateId } from "@/lib/data";
import { buildGameId } from "@/lib/game-id";
import {
  extractGameFromUrl,
  type ExtractedBoxRow,
  type ExtractedGamePayload,
} from "@/lib/game-extractor";
import { supabase } from "@/lib/supabase";
import { hasServiceRoleAccess } from "@/lib/supabase-admin";
import {
  upsertGameInSupabase,
  upsertPlayerInSupabase,
} from "@/lib/supabase-data";
import type { BoxScoreItem, Game, League, Player, Team, TournamentStage } from "@/types/sports";
import { NextRequest, NextResponse } from "next/server";


function normalizeStr(str: string): string {

  return str.toLowerCase().replace(/[^a-z0-9]+/g, "").trim();
}

const TEAM_CODE_ALIASES: Record<string, string[]> = {
  // PBA
  bwb: ["blackwater", "blackwaterbossing", "bossing"],
  con: ["converge", "convergefiberxers", "fiberxers"],
  gin: ["ginebra", "barangayginebra", "ginebrasanmiguel"],
  mag: ["magnolia", "magnoliahotshots", "hotshots"],
  mer: ["meralco", "meralcobolts", "bolts"],
  mgp: ["macau", "macaugiantpandas", "giantpandas", "mbk"],
  mbk: ["macau", "macaublackbears", "blackbears", "mgp"],
  nlx: ["nlex", "nlexroadwarriors", "roadwarriors"],
  phx: ["phoenix", "phoenixfuelmasters", "fuelmasters"],
  ros: ["rainorshine", "rainorshineelastopainters", "elastopainters"],
  smb: ["smb", "sanmiguel", "sanmiguelbeermen", "beermen"],
  ter: ["terrafirma", "terrafirmadyip", "dyip"],
  tgr: ["titan", "titanultragiantrisers", "giantrisers"],
  tnt: ["tnt", "tnttropang5g", "tnttropanggiga", "tropang5g", "tropang"],
  // UAAP
  up: ["up", "upfightingmaroons", "fightingmaroons", "maroons", "upis", "upisjrs", "juniorfightingmaroons"],
  upis: ["up", "upfightingmaroons", "fightingmaroons", "maroons", "upis", "upisjrs", "juniorfightingmaroons"],
  dlsu: ["dlsu", "delasalle", "greenarchers", "archers", "lasalle", "lasallejrs", "dlsz", "juniorarchers"],
  lasalle: ["dlsu", "delasalle", "greenarchers", "archers", "lasalle", "lasallejrs", "dlsz", "juniorarchers"],
  la: ["dlsu", "delasalle", "greenarchers", "archers", "lasalle", "lasallejrs", "dlsz", "juniorarchers"],
  dlsz: ["dlsu", "delasalle", "greenarchers", "archers", "lasalle", "lasallejrs", "dlsz", "juniorarchers"],
  ust: ["ust", "growlingtigers", "tigers", "ustjrs", "tigercubs", "juniorgoldentigers"],
  admu: ["admu", "ateneo", "blueeagles", "eagles", "ateneojrs", "blueeaglets", "eaglets"],
  ateneo: ["admu", "ateneo", "blueeagles", "eagles", "ateneojrs", "blueeaglets", "eaglets"],
  feu: ["feu", "tamaraws", "feujrs", "feud", "babytamaraws"],
  feud: ["feu", "tamaraws", "feujrs", "feud", "babytamaraws"],
  ue: ["ue", "redwarriors", "warriors", "uejrs", "juniorwarriors"],
  nu: ["nu", "bulldogs", "nujrs", "nuns", "bullpups"],
  nuns: ["nu", "bulldogs", "nujrs", "nuns", "bullpups"],
  adu: ["adu", "adamson", "soaringfalcons", "falcons", "adujrs", "babyfalcons"],
  // PVL
  ccs: ["creamline", "creamlinecoolsmashers", "coolsmashers", "cream"],
  cream: ["creamline", "creamlinecoolsmashers", "coolsmashers", "ccs"],
  cmf: ["chocomucho", "chocomuchoflyingtitans", "flyingtitans"],
  pga: ["petrogazz", "petrogazzangels", "angels", "pet"],
  pet: ["petrogazz", "petrogazzangels", "angels", "pga"],
  ctc: ["cignal", "cignalhdspikers", "hdspikers", "cig"],
  cig: ["cignal", "cignalhdspikers", "hdspikers", "ctc"],
  pldt: ["pldt", "pldthighspeedhitters", "highspeedhitters", "hsh"],
  hsh: ["pldt", "pldthighspeedhitters", "highspeedhitters", "hsh"],
  akr: ["akari", "akarichargers", "powerchargers", "aka", "akari"],
  aka: ["akari", "akarichargers", "powerchargers", "akr", "akari"],
  akari: ["akari", "akarichargers", "powerchargers", "akr", "aka"],
  nxg: ["nxled", "nxledchameleons", "chameleons", "nxl"],
  nxl: ["nxled", "nxledchameleons", "chameleons", "nxg"],
  zus: ["zus", "zuscoffee", "thunderbelles"],
  cap: ["capital1", "capital1solarspikers", "solarspikers", "cap1"],
  cap1: ["capital1", "capital1solarspikers", "solarspikers", "cap"],
  gal: ["galeries", "galeriestower", "galeriestowerhighrisers", "highrisers", "gth"],
  gth: ["galeries", "galeriestower", "galeriestowerhighrisers", "highrisers", "gal"],
  che: ["chery", "cherytiggo", "crossovers"],
  ftl: ["f2", "f2logistics", "cargomovers"],
  fff: ["farmfresh", "farmfreshfoxies", "foxies"],
  est: ["est", "estcola"],
  estcola: ["est", "estcola"],
  hvf: ["hvf", "hochiminh", "hochiminhcity", "hcmc", "hcm"],
  hcmc: ["hvf", "hochiminh", "hochiminhcity", "hcmc", "hcm"],
  hochiminh: ["hvf", "hochiminh", "hochiminhcity", "hcmc", "hcm"],
  hochiminhcity: ["hvf", "hochiminh", "hochiminhcity", "hcmc", "hcm"],
};


function findBestTeamMatch(extracted: { name: string; shortName: string }, teams: Team[]): Team | undefined {
  const shortTarget = normalizeStr(extracted.shortName);
  const nameTarget = normalizeStr(extracted.name);

  // 1. Exact shortName match
  const byShort = teams.find((t) => normalizeStr(t.shortName) === shortTarget);
  if (byShort) return byShort;

  // 2. Exact full name match
  const byName = teams.find((t) => normalizeStr(t.name) === nameTarget);
  if (byName) return byName;

  // 3. Known code alias match
  const aliases = Object.hasOwn(TEAM_CODE_ALIASES, shortTarget)
    ? TEAM_CODE_ALIASES[shortTarget]
    : [];
  for (const alias of aliases) {
    const matched = teams.find((t) => {
      const tNorm = normalizeStr(t.name);
      const tShortNorm = normalizeStr(t.shortName);
      const tIdNorm = normalizeStr(t.id);
      return tNorm.includes(alias) || alias.includes(tNorm) || tShortNorm === alias || tIdNorm.includes(alias);
    });
    if (matched) return matched;
  }

  // 4. Substring or prefix match
  const bySub = teams.find((t) => {
    const tName = normalizeStr(t.name);
    const tShort = normalizeStr(t.shortName);
    const tId = normalizeStr(t.id);
    return (
      tName.includes(nameTarget) ||
      nameTarget.includes(tName) ||
      tName.includes(shortTarget) ||
      shortTarget.includes(tShort) ||
      tId.includes(shortTarget) ||
      shortTarget.includes(tId)
    );
  });

  return bySub;
}


function extractNameTokens(name: string): { initials: string[]; lastName: string; fullNorm: string } {
  const clean = name.replace(/[.,/#!$%^&*;:{}=\-_`~()]/g, " ").trim().toLowerCase();
  const parts = clean.split(/\s+/).filter(Boolean);
  const lastName = parts.length > 0 ? parts[parts.length - 1] : "";
  const initials = parts.map((p) => p[0]);
  return {
    initials,
    lastName,
    fullNorm: normalizeStr(name),
  };
}

function findBestPlayerMatch(row: ExtractedBoxRow, teamRoster: Player[]): Player | undefined {
  const rowTokens = extractNameTokens(row.playerName);

  // 1. Exact full normalized name match
  const byExact = teamRoster.find((p) => normalizeStr(p.name) === rowTokens.fullNorm);
  if (byExact) return byExact;

  // 2. Jersey number match + last name similarity check
  if (row.jersey !== null && row.jersey !== undefined) {
    const byJerseyList = teamRoster.filter((p) => p.jerseyNumber === row.jersey);
    if (byJerseyList.length === 1) {
      return byJerseyList[0];
    }
    if (byJerseyList.length > 1) {
      // Disambiguate by last name
      const matched = byJerseyList.find((p) => {
        const pTokens = extractNameTokens(p.name);
        return (
          pTokens.lastName.includes(rowTokens.lastName) ||
          rowTokens.lastName.includes(pTokens.lastName)
        );
      });
      if (matched) return matched;
    }
  }

  // 3. Last name + First Initial match (e.g. "J. Franklin" <-> "John Franklin" or "Franklin, J.")
  if (rowTokens.lastName && rowTokens.lastName.length > 2) {
    const byLastName = teamRoster.find((p) => {
      const pTokens = extractNameTokens(p.name);
      const sameLastName =
        pTokens.lastName === rowTokens.lastName ||
        pTokens.fullNorm.includes(rowTokens.lastName) ||
        rowTokens.fullNorm.includes(pTokens.lastName);

      if (!sameLastName) return false;

      // If both have initials, check if any initial matches
      const hasSharedInitial = rowTokens.initials.some((init) => pTokens.initials.includes(init));
      return hasSharedInitial || sameLastName;
    });

    if (byLastName) return byLastName;
  }

  // 4. Substring fallback
  const bySub = teamRoster.find((p) => {
    const pNorm = normalizeStr(p.name);
    return pNorm.includes(rowTokens.fullNorm) || rowTokens.fullNorm.includes(pNorm);
  });

  return bySub;
}

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

