import { ValidationError } from "@/lib/admin-validation";
import { getEffectiveGameStatus } from "@/lib/derivations";
import { inferLeague } from "@/lib/league-utils";
import { supabase } from "@/lib/supabase";
import { getServiceSupabase } from "@/lib/supabase-admin";
import type { Game, GameStatus, League, Player, Season, Team } from "@/types/sports";


function logSupabaseError(context: string, error: { message: string } | null): boolean {
  if (error) {
    console.error(`[Sportsmetric DB] ${context}:`, error.message);
    return true;
  }
  return false;
}

/**
 * Reads use the anon client (RLS allows public SELECT). Writes need the
 * service-role client, because RLS blocks anon writes. Never fall back to the
 * anon key -- those writes look successful in the UI and then vanish.
 */
function getWriteClient() {
  return getServiceSupabase();
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
    league: inferLeague(season.id, season.league),
    sort_order: season.sortOrder ?? null,
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
    // Venue/stage/playoff live in dedicated columns. They are mirrored into
    // box_score so rows written before those columns existed stay readable.
    venue: game.venue ?? null,
    stage: game.stage ?? "ELIMINATION",
    is_playoff: game.isPlayoff ?? false,
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


export function mapSeasonRows(
  rows: Array<{
    id: string;
    label: string;
    is_current: boolean;
    league?: League;
    sort_order?: number | null;
  }>
): Season[] {
  const seenLeaguesWithCurrent = new Set<League>();

  // Respect the admin-defined order, falling back to id-descending for rows
  // saved before sort_order existed.
  const ordered = [...rows].sort((a, b) => {
    const aOrder = a.sort_order ?? Number.MAX_SAFE_INTEGER;
    const bOrder = b.sort_order ?? Number.MAX_SAFE_INTEGER;
    if (aOrder !== bOrder) return aOrder - bOrder;
    return b.id.localeCompare(a.id);
  });

  const mapped = ordered.map((s) => {
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
      sortOrder: s.sort_order ?? undefined,
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
  return rows
    .filter((t) => !t.id.startsWith("__"))
    .map((t) => ({
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
    const effectiveStatus = getEffectiveGameStatus({
      status: g.status,
      startTime: g.start_time,
      // Without the league, PVL fixtures auto-flip to LIVE as soon as their
      // scheduled time passes. Pass it through so PVL stays UPCOMING until
      // official post-match data arrives.
      league: g.league,
    });

    return {
      id: g.id,
      league: g.league,
      seasonId: g.season_id,
      homeTeam,
      awayTeam,
      homeScore: g.home_score,
      awayScore: g.away_score,
      status: effectiveStatus,
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


type SeasonDbRow = {
  id: string;
  label: string;
  is_current: boolean;
  league?: League;
  sort_order?: number | null;
};

type TeamDbRow = {
  id: string;
  name: string;
  short_name: string;
  logo: string | null;
  league: League;
  accent_color: string;
  season_id: string;
  record: Team["record"];

};

type PlayerDbRow = {
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
};

type GameDbRow = {
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
};

async function fetchPaginatedTable<T>(
  table: string,
  orderColumn?: string,
  ascending = false
): Promise<T[]> {

  if (!supabase) return [];
  const all: T[] = [];
  const pageSize = 1000;
  let from = 0;

  while (true) {
    let query = supabase.from(table).select("*");
    if (orderColumn) {
      query = query.order(orderColumn, { ascending });
    }
    // A stable tiebreaker is required for offset pagination: ordering only by
    // start_time can duplicate or skip rows when several games share a time.
    query = query.order("id", { ascending: true });
    const { data, error } = await query.range(from, from + pageSize - 1);
    if (error) {
      // Returning a partial dataset would silently produce wrong standings.
      // Let the caller surface the failure instead.
      throw new Error(`Failed to load ${table} (offset ${from}): ${error.message}`);
    }
    if (!data || data.length === 0) break;
    all.push(...(data as unknown as T[]));
    if (data.length < pageSize) break;
    from += pageSize;
  }

  return all;
}

export async function fetchAllSupabaseData(): Promise<SupabaseDataResult | null> {
  if (!supabase) return null;

  const [seasonsRows, teamsRows, playersRows, gamesRows] = await Promise.all([
    fetchPaginatedTable<SeasonDbRow>("seasons", "id", false),
    fetchPaginatedTable<TeamDbRow>("teams"),
    fetchPaginatedTable<PlayerDbRow>("players"),
    fetchPaginatedTable<GameDbRow>("games", "start_time", false),
  ]);

  const seasons = mapSeasonRows(seasonsRows);
  const teams = mapTeamRows(teamsRows);
  const teamsById = new Map(teams.map((t) => [t.id, t]));
  const players = mapPlayerRows(playersRows);
  const games = mapGameRows(gamesRows, teamsById);

  return { seasons, teams, players, games };
}


/**
 * Rebuilds win/loss from FINAL games in the season. Used after every game
 * write so marking a match FINAL (or un-finalising it) cannot drift from
 * the denormalised `teams.record` column.
 */
export async function recomputeTeamRecords(
  seasonId: string,
  teamIds: string[]
): Promise<boolean> {
  const db = getWriteClient();
  const uniqueIds = Array.from(new Set(teamIds.filter(Boolean)));
  if (!db || uniqueIds.length === 0) return false;

  try {
    const { data: gameRows, error: gamesError } = await db
      .from("games")
      .select("home_team_id, away_team_id, home_score, away_score, status, stage, is_playoff")
      .eq("season_id", seasonId)
      .eq("status", "FINAL");

    if (logSupabaseError("recompute team records (games)", gamesError)) return false;

    // The standings shown in the app exclude playoff games, so the denormalised
    // teams.record column must exclude them too or the two disagree.
    const regularSeasonFinals = (gameRows ?? []).filter((row) => {
      if (row.is_playoff) return false;
      return (row.stage ?? "ELIMINATION") === "ELIMINATION";
    });

    const { data: teamRows, error: teamsError } = await db
      .from("teams")
      .select("*")
      .in("id", uniqueIds);

    if (logSupabaseError("recompute team records (teams)", teamsError) || !teamRows) {
      return false;
    }

    const updates = teamRows.map((team) => {
      let wins = 0;
      let losses = 0;
      for (const row of regularSeasonFinals) {
        const isHome = row.home_team_id === team.id;
        const isAway = row.away_team_id === team.id;
        if (!isHome && !isAway) continue;
        const own = isHome ? row.home_score : row.away_score;
        const other = isHome ? row.away_score : row.home_score;
        if (own > other) wins += 1;
        else if (other > own) losses += 1;
      }
      return { ...team, record: { wins, losses } };
    });

    const { error: upsertError } = await db.from("teams").upsert(updates);
    return !logSupabaseError("recompute team records (upsert)", upsertError);
  } catch (err) {
    console.error("[Sportsmetric DB] Unexpected error during recomputeTeamRecords:", err);
    return false;
  }
}

export async function upsertGameInSupabase(game: Game): Promise<boolean> {
  const db = getWriteClient();
  if (!db) return false;
  try {
    // If an upsert changes either side, the team that was replaced also needs
    // its win/loss record recalculated.
    const { data: existing } = await db
      .from("games")
      .select("home_team_id, away_team_id")
      .eq("id", game.id)
      .maybeSingle();

    const { error } = await db.from("games").upsert([gameToRecord(game)]);
    if (logSupabaseError("upsert game", error)) return false;

    const affectedTeams = new Set([game.homeTeam.id, game.awayTeam.id]);
    if (existing) {
      affectedTeams.add(existing.home_team_id);
      affectedTeams.add(existing.away_team_id);
    }
    await recomputeTeamRecords(game.seasonId, Array.from(affectedTeams));
    return true;
  } catch (err) {
    console.error("[Sportsmetric DB] Unexpected error during upsertGame:", err);
    return false;
  }
}

export async function deleteGameInSupabase(id: string): Promise<boolean> {
  const db = getWriteClient();
  if (!db) return false;
  try {
    const { data: existing } = await db
      .from("games")
      .select("season_id, home_team_id, away_team_id")
      .eq("id", id)
      .maybeSingle();

    const { error } = await db.from("games").delete().eq("id", id);
    if (logSupabaseError("delete game", error)) return false;

    if (existing) {
      await recomputeTeamRecords(existing.season_id, [
        existing.home_team_id,
        existing.away_team_id,
      ]);
    }
    return true;
  } catch (err) {
    console.error("[Sportsmetric DB] Unexpected error during deleteGame:", err);
    return false;
  }
}

export async function upsertTeamInSupabase(team: Team): Promise<boolean> {
  const db = getWriteClient();
  if (!db) return false;
  try {
    const { error } = await db.from("teams").upsert([teamToRecord(team)]);
    return !logSupabaseError("upsert team", error);
  } catch (err) {
    console.error("[Sportsmetric DB] Unexpected error during upsertTeam:", err);
    return false;
  }
}

export async function deleteTeamInSupabase(id: string): Promise<boolean> {
  const db = getWriteClient();
  if (!db) return false;
  try {
    const [asHome, asAway] = await Promise.all([
      db.from("games").select("id").eq("home_team_id", id).limit(1),
      db.from("games").select("id").eq("away_team_id", id).limit(1),
    ]);
    if (logSupabaseError("delete team (check home games)", asHome.error)) return false;
    if (logSupabaseError("delete team (check away games)", asAway.error)) return false;
    if ((asHome.data && asHome.data.length > 0) || (asAway.data && asAway.data.length > 0)) {
      throw new ValidationError(
        "This team still has games on the schedule. Delete those games first."
      );
    }

    const { error: playersError } = await db.from("players").delete().eq("team_id", id);
    if (logSupabaseError("delete team (players)", playersError)) return false;

    const { error } = await db.from("teams").delete().eq("id", id);
    return !logSupabaseError("delete team", error);
  } catch (err) {
    if (err instanceof ValidationError) throw err;
    console.error("[Sportsmetric DB] Unexpected error during deleteTeam:", err);
    return false;
  }
}

export async function upsertPlayerInSupabase(player: Player): Promise<boolean> {
  const db = getWriteClient();
  if (!db) return false;
  try {
    const { error } = await db.from("players").upsert([playerToRecord(player)]);
    return !logSupabaseError("upsert player", error);
  } catch (err) {
    console.error("[Sportsmetric DB] Unexpected error during upsertPlayer:", err);
    return false;
  }
}

export async function batchUpsertPlayersInSupabase(players: Player[]): Promise<boolean> {
  const db = getWriteClient();
  if (!db) return false;
  if (players.length === 0) return true;
  try {
    // The DB has a partial unique index on (team, season, jersey>0). A single
    // duplicate would otherwise abort the whole batch with an opaque 500.
    const seenInBatch = new Map<string, string>();
    for (const player of players) {
      if (player.jerseyNumber <= 0) continue;
      const key = `${player.teamId}|${player.seasonId}|${player.jerseyNumber}`;
      const other = seenInBatch.get(key);
      if (other) {
        throw new ValidationError(
          `Jersey #${player.jerseyNumber} is assigned to both ${other} and ${player.name}.`
        );
      }
      seenInBatch.set(key, player.name);
    }

    const teamIds = Array.from(new Set(players.map((p) => p.teamId)));
    const jerseyNumbers = Array.from(
      new Set(players.map((p) => p.jerseyNumber).filter((n) => n > 0))
    );
    if (teamIds.length > 0 && jerseyNumbers.length > 0) {
      const { data: existing, error: lookupError } = await db
        .from("players")
        .select("id, name, team_id, season_id, jersey_number")
        .in("team_id", teamIds)
        .in("jersey_number", jerseyNumbers);
      if (logSupabaseError("batch upsert players (jersey check)", lookupError)) return false;

      const incomingIds = new Set(players.map((p) => p.id));
      for (const player of players) {
        if (player.jerseyNumber <= 0) continue;
        const conflict = (existing ?? []).find(
          (row) =>
            row.team_id === player.teamId &&
            row.season_id === player.seasonId &&
            row.jersey_number === player.jerseyNumber &&
            !incomingIds.has(row.id)
        );
        if (conflict) {
          throw new ValidationError(
            `Jersey #${player.jerseyNumber} is already used by ${conflict.name} on this team.`
          );
        }
      }
    }

    const { error } = await db.from("players").upsert(players.map(playerToRecord));
    return !logSupabaseError("batch upsert players", error);
  } catch (err) {
    if (err instanceof ValidationError) throw err;
    console.error("[Sportsmetric DB] Unexpected error during batchUpsertPlayers:", err);
    return false;
  }
}

export async function deletePlayerInSupabase(id: string): Promise<boolean> {
  const db = getWriteClient();
  if (!db) return false;
  try {
    const { error } = await db.from("players").delete().eq("id", id);
    return !logSupabaseError("delete player", error);
  } catch (err) {
    console.error("[Sportsmetric DB] Unexpected error during deletePlayer:", err);
    return false;
  }
}

/**
 * Deletes every player in one season. The season id is required so a caller
 * can never accidentally wipe the whole table.
 */
export async function deleteAllPlayersInSupabase(seasonId: string): Promise<boolean> {
  const db = getWriteClient();
  if (!db) return false;
  if (!seasonId) throw new ValidationError("seasonId is required.");
  try {
    const { error } = await db.from("players").delete().eq("season_id", seasonId);
    return !logSupabaseError("delete all players", error);
  } catch (err) {
    console.error("[Sportsmetric DB] Unexpected error during deleteAllPlayers:", err);
    return false;
  }
}

export async function upsertSeasonInSupabase(season: Season): Promise<boolean> {
  const db = getWriteClient();
  if (!db) return false;
  try {
    const { error } = await db.from("seasons").upsert([seasonToRecord(season)]);
    return !logSupabaseError("upsert season", error);
  } catch (err) {
    console.error("[Sportsmetric DB] Unexpected error during upsertSeason:", err);
    return false;
  }
}

export async function batchUpsertSeasonsInSupabase(seasons: Season[]): Promise<boolean> {
  const db = getWriteClient();
  if (!db) return false;
  if (seasons.length === 0) return true;
  try {
    const records = seasons.map(seasonToRecord);
    const { error } = await db.from("seasons").upsert(records);
    return !logSupabaseError("batch upsert seasons", error);
  } catch (err) {
    console.error("[Sportsmetric DB] Unexpected error during batchUpsertSeasons:", err);
    return false;
  }
}

/**
 * Removes a season along with the games, players and teams that belong to it.
 * Without this, deleting a season leaves orphaned rows that still surface in
 * league-wide queries.
 */
export async function deleteSeasonInSupabase(id: string): Promise<boolean> {
  const db = getWriteClient();
  if (!db) return false;
  try {
    for (const table of ["games", "players", "teams"] as const) {
      const { error } = await db.from(table).delete().eq("season_id", id);
      if (logSupabaseError(`delete ${table} for season ${id}`, error)) return false;
    }
    const { error } = await db.from("seasons").delete().eq("id", id);
    return !logSupabaseError("delete season", error);
  } catch (err) {
    console.error("[Sportsmetric DB] Unexpected error during deleteSeason:", err);
    return false;
  }
}

export async function batchUpsertGamesInSupabase(games: Game[]): Promise<boolean> {
  const db = getWriteClient();
  if (!db) return false;
  if (games.length === 0) return true;
  try {
    const records = games.map(gameToRecord);
    const { error } = await db.from("games").upsert(records);
    if (logSupabaseError("batch upsert games", error)) return false;

    const bySeason = new Map<string, string[]>();
    for (const game of games) {
      const ids = bySeason.get(game.seasonId) ?? [];
      ids.push(game.homeTeam.id, game.awayTeam.id);
      bySeason.set(game.seasonId, ids);
    }
    await Promise.all(
      Array.from(bySeason.entries()).map(([seasonId, teamIds]) =>
        recomputeTeamRecords(seasonId, teamIds)
      )
    );
    return true;
  } catch (err) {
    console.error("[Sportsmetric DB] Unexpected error during batchUpsertGames:", err);
    return false;
  }
}

