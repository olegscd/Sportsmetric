import { supabase } from "@/lib/supabase";
import { inferLeague } from "@/lib/league-utils";
import type { Game, GameStatus, League, Player, Season, Team } from "@/types/sports";

function logSupabaseError(context: string, error: { message: string } | null): boolean {
  if (error) {
    console.error(`[Sportsmetric DB] ${context}:`, error.message);
    return true;
  }
  return false;
}

export interface SupabaseDataResult {
  seasons: Season[];
  teams: Team[];
  players: Player[];
  games: Game[];
}

export function seasonToRecord(season: Season) {
  return {
    id: season.id,
    label: season.label,
    year: season.id,
    is_current: season.isCurrent,
    // NOTE: 'league' column does not exist in the seasons table — inferred from season ID at read time
  };
}

export function teamToRecord(team: Team) {
  return {
    id: team.id,
    name: team.name,
    short_name: team.shortName,
    logo: team.logo,
    league: team.league,
    accent_color: team.accentColor,
    season_id: team.seasonId,
    record: team.record,
  };
}

export function playerToRecord(player: Player) {
  return {
    id: player.id,
    person_id: player.personId || player.id,
    name: player.name,
    jersey_number: player.jerseyNumber,
    position: player.position,
    team_id: player.teamId,
    height: player.height,
    photo_url: player.photoUrl,
    season_id: player.seasonId,
    season_averages: player.seasonAverages,
    rank_badges: player.rankBadges,
  };
}

export function gameToRecord(game: Game) {
  return {
    id: game.id,
    league: game.league,
    season_id: game.seasonId,
    home_team_id: game.homeTeam.id,
    away_team_id: game.awayTeam.id,
    home_score: game.homeScore,
    away_score: game.awayScore,
    status: game.status,
    start_time: game.startTime,
    quarter_or_set: game.quarterOrSet,
    time_remaining: game.timeRemaining,
    box_score: {
      home: game.boxScore?.home ?? [],
      away: game.boxScore?.away ?? [],
      venue: game.venue ?? null,
      stage: game.stage ?? "ELIMINATION",
      isPlayoff: game.isPlayoff ?? false,
    },
    play_by_play: game.playByPlay ?? [],
  };
}


export function mapSeasonRows(rows: Array<{ id: string; label: string; is_current: boolean; league?: League }>): Season[] {
  const seenLeaguesWithCurrent = new Set<League>();

  const mapped = rows.map((s) => {
    const league = inferLeague(s.id, s.league);

    let isCurrent = Boolean(s.is_current);

    // Enforce max 1 current season per league
    if (isCurrent) {
      if (seenLeaguesWithCurrent.has(league)) {
        isCurrent = false; // Demote duplicate current seasons
      } else {
        seenLeaguesWithCurrent.add(league);
      }
    }

    return {
      id: s.id,
      label: s.label,
      isCurrent,
      league,
    };
  });

  // Guarantee at least 1 current season for each league present
  const leaguesInRows = Array.from(new Set(mapped.map((s) => s.league!)));
  for (const l of leaguesInRows) {
    if (!mapped.some((s) => s.league === l && s.isCurrent)) {
      const firstSeason = mapped.find((s) => s.league === l);
      if (firstSeason) firstSeason.isCurrent = true;
    }
  }

  return mapped;
}

export function mapTeamRows(
  rows: Array<{
    id: string;
    name: string;
    short_name: string;
    logo: string | null;
    league: League;
    accent_color: string;
    season_id: string;
    record: Team["record"];
  }>
): Team[] {
  return rows.map((t) => ({
    id: t.id,
    name: t.name,
    shortName: t.short_name,
    logo: t.logo,
    league: t.league,
    accentColor: t.accent_color,
    seasonId: t.season_id,
    record: t.record ?? { wins: 0, losses: 0 },
  }));
}

export function mapPlayerRows(
  rows: Array<{
    id: string;
    person_id: string;
    name: string;
    jersey_number: number;
    position: Player["position"];
    team_id: string;
    height: string;
    photo_url: string | null;
    season_id: string;
    season_averages: Player["seasonAverages"];
    rank_badges: Player["rankBadges"] | null;
  }>
): Player[] {
  return rows.map((p) => ({
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
}

export function mapGameRows(
  rows: Array<{
    id: string;
    league: League;
    season_id: string;
    home_team_id: string;
    away_team_id: string;
    home_score: number;
    away_score: number;
    status: GameStatus;
    start_time: string;
    venue?: string | null;
    stage?: Game["stage"] | null;
    is_playoff?: boolean | null;
    quarter_or_set: number;
    time_remaining: string | null;
    box_score: Game["boxScore"] & { venue?: string; stage?: Game["stage"]; isPlayoff?: boolean };
    play_by_play: Game["playByPlay"] | null;
  }>,
  teamsById: Map<string, Team>
): Game[] {
  return rows.map((g) => {
    const homeTeam = teamsById.get(g.home_team_id) ?? {
      id: g.home_team_id,
      name: "Unknown Team",
      shortName: "UNK",
      logo: null,
      league: g.league,
      accentColor: "#6B7280",
      seasonId: g.season_id,
      record: { wins: 0, losses: 0 },
    };

    const awayTeam = teamsById.get(g.away_team_id) ?? {
      id: g.away_team_id,
      name: "Unknown Team",
      shortName: "UNK",
      logo: null,
      league: g.league,
      accentColor: "#6B7280",
      seasonId: g.season_id,
      record: { wins: 0, losses: 0 },
    };

    const boxScoreObj = g.box_score;
    const stage = g.stage ?? boxScoreObj?.stage ?? (boxScoreObj?.isPlayoff ? "SEMIFINALS" : "ELIMINATION");
    const isPlayoff = g.is_playoff ?? boxScoreObj?.isPlayoff ?? (stage !== "ELIMINATION");
    const venue = g.venue ?? boxScoreObj?.venue ?? null;

    return {
      id: g.id,
      league: g.league,
      seasonId: g.season_id,
      homeTeam,
      awayTeam,
      homeScore: g.home_score,
      awayScore: g.away_score,
      status: g.status,
      startTime: g.start_time,
      venue,
      stage,
      isPlayoff,
      quarterOrSet: g.quarter_or_set,
      timeRemaining: g.time_remaining,
      boxScore: {
        home: boxScoreObj?.home ?? [],
        away: boxScoreObj?.away ?? [],
      },
      playByPlay: g.play_by_play ?? [],
    };
  });
}


export async function fetchAllSupabaseData(): Promise<SupabaseDataResult | null> {
  if (!supabase) return null;

  const [seasonsRes, teamsRes, playersRes, gamesRes] = await Promise.all([
    supabase.from("seasons").select("*").order("id", { ascending: false }),
    supabase.from("teams").select("*").limit(5000),
    supabase.from("players").select("*").limit(5000),
    supabase.from("games").select("*").order("start_time", { ascending: false }).limit(5000),
  ]);

  const hasError =
    logSupabaseError("seasons fetch", seasonsRes.error) ||
    logSupabaseError("teams fetch", teamsRes.error) ||
    logSupabaseError("players fetch", playersRes.error) ||
    logSupabaseError("games fetch", gamesRes.error);

  if (hasError) return null;

  const seasons = mapSeasonRows(seasonsRes.data ?? []);
  const teams = mapTeamRows(teamsRes.data ?? []);
  const teamsById = new Map(teams.map((t) => [t.id, t]));
  const players = mapPlayerRows(playersRes.data ?? []);
  const games = mapGameRows(gamesRes.data ?? [], teamsById);

  return { seasons, teams, players, games };
}

export async function upsertGameInSupabase(game: Game): Promise<boolean> {
  if (!supabase) return false;
  try {
    const { error } = await supabase.from("games").upsert([gameToRecord(game)]);
    return !logSupabaseError("upsert game", error);
  } catch (err) {
    console.error("[Sportsmetric DB] Unexpected error during upsertGame:", err);
    return false;
  }
}

export async function deleteGameInSupabase(id: string): Promise<boolean> {
  if (!supabase) return false;
  try {
    const { error } = await supabase.from("games").delete().eq("id", id);
    return !logSupabaseError("delete game", error);
  } catch (err) {
    console.error("[Sportsmetric DB] Unexpected error during deleteGame:", err);
    return false;
  }
}

export async function upsertTeamInSupabase(team: Team): Promise<boolean> {
  if (!supabase) return false;
  try {
    const { error } = await supabase.from("teams").upsert([teamToRecord(team)]);
    return !logSupabaseError("upsert team", error);
  } catch (err) {
    console.error("[Sportsmetric DB] Unexpected error during upsertTeam:", err);
    return false;
  }
}

export async function deleteTeamInSupabase(id: string): Promise<boolean> {
  if (!supabase) return false;
  try {
    const { error } = await supabase.from("teams").delete().eq("id", id);
    return !logSupabaseError("delete team", error);
  } catch (err) {
    console.error("[Sportsmetric DB] Unexpected error during deleteTeam:", err);
    return false;
  }
}

export async function upsertPlayerInSupabase(player: Player): Promise<boolean> {
  if (!supabase) return false;
  try {
    const { error } = await supabase.from("players").upsert([playerToRecord(player)]);
    return !logSupabaseError("upsert player", error);
  } catch (err) {
    console.error("[Sportsmetric DB] Unexpected error during upsertPlayer:", err);
    return false;
  }
}

export async function deletePlayerInSupabase(id: string): Promise<boolean> {
  if (!supabase) return false;
  try {
    const { error } = await supabase.from("players").delete().eq("id", id);
    return !logSupabaseError("delete player", error);
  } catch (err) {
    console.error("[Sportsmetric DB] Unexpected error during deletePlayer:", err);
    return false;
  }
}

export async function deleteAllPlayersInSupabase(): Promise<boolean> {
  if (!supabase) return false;
  try {
    const { error } = await supabase.from("players").delete().neq("id", "");
    return !logSupabaseError("delete all players", error);
  } catch (err) {
    console.error("[Sportsmetric DB] Unexpected error during deleteAllPlayers:", err);
    return false;
  }
}

export async function upsertSeasonInSupabase(season: Season): Promise<boolean> {
  if (!supabase) return false;
  try {
    const { error } = await supabase.from("seasons").upsert([seasonToRecord(season)]);
    return !logSupabaseError("upsert season", error);
  } catch (err) {
    console.error("[Sportsmetric DB] Unexpected error during upsertSeason:", err);
    return false;
  }
}

export async function batchUpsertSeasonsInSupabase(seasons: Season[]): Promise<boolean> {
  if (!supabase || seasons.length === 0) return false;
  try {
    const records = seasons.map(seasonToRecord);
    const { error } = await supabase.from("seasons").upsert(records);
    return !logSupabaseError("batch upsert seasons", error);
  } catch (err) {
    console.error("[Sportsmetric DB] Unexpected error during batchUpsertSeasons:", err);
    return false;
  }
}

export async function deleteSeasonInSupabase(id: string): Promise<boolean> {
  if (!supabase) return false;
  try {
    const { error } = await supabase.from("seasons").delete().eq("id", id);
    return !logSupabaseError("delete season", error);
  } catch (err) {
    console.error("[Sportsmetric DB] Unexpected error during deleteSeason:", err);
    return false;
  }
}

export async function batchUpsertGamesInSupabase(games: Game[]): Promise<boolean> {
  if (!supabase || games.length === 0) return false;
  try {
    const records = games.map(gameToRecord);
    const { error } = await supabase.from("games").upsert(records);
    return !logSupabaseError("batch upsert games", error);
  } catch (err) {
    console.error("[Sportsmetric DB] Unexpected error during batchUpsertGames:", err);
    return false;
  }
}

