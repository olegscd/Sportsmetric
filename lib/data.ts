import {
  derivePlayerAverages,
  derivePlayerGameLog,
  derivePlayerStatRank,
  deriveStandings,
  deriveStatLeaders,
  isLifetimeSeason,
  LIFETIME_SEASON_ID,
  type DerivedTeamStandings,
  type PlayerGameLogEntry,
  type StatLeaderEntry,
} from "@/lib/derivations";

import { mockGames, mockPlayers, mockSeasons, mockTeams } from "@/lib/mock-data";
import {
  batchUpsertGamesInSupabase,
  deleteAllPlayersInSupabase,
  deleteGameInSupabase,
  deletePlayerInSupabase,
  deleteSeasonInSupabase,
  deleteTeamInSupabase,
  upsertGameInSupabase,
  upsertPlayerInSupabase,
  upsertSeasonInSupabase,
  upsertTeamInSupabase,
} from "@/lib/supabase-data";

import type {
  BoxScoreItem,
  Game,
  GameStatus,
  League,
  PlayByPlayEvent,
  Player,
  Season,
  SeasonAverages,
  Team,
} from "@/types/sports";

export type { DerivedTeamStandings, PlayerGameLogEntry, StatLeaderEntry };
export { isLifetimeSeason, LIFETIME_SEASON_ID };

/** Unique ID generator for games, players, teams, seasons */
export function generateId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return Math.random().toString(36).substring(2, 11);
}

// Memory fallbacks (mirrors mock-data if context not available)
let inMemorySeasons: Season[] = [...mockSeasons];
let inMemoryTeams: Team[] = [...mockTeams];
let inMemoryPlayers: Player[] = [...mockPlayers];
let inMemoryGames: Game[] = [...mockGames];

export function markClientStorageReady(): void {
  // Legacy stub retained for backward compatibility
}

export function initSupabaseSync(): void {
  // Legacy stub retained for backward compatibility
}

export function resetAllDataToDefaults(): void {
  inMemorySeasons = [...mockSeasons];
  inMemoryTeams = [...mockTeams];
  inMemoryPlayers = [...mockPlayers];
  inMemoryGames = [...mockGames];
  void batchUpsertGamesInSupabase(mockGames);
}

export function getCurrentSeasonId(): string {
  const current = inMemorySeasons.find((s) => s.isCurrent);
    return current?.id ?? inMemorySeasons[0]?.id ?? "2025-26";
}

export function getSeasons(): Season[] {
  return inMemorySeasons;
}

export function getSeasonById(id: string): Season | undefined {
  if (isLifetimeSeason(id)) {
    return { id: LIFETIME_SEASON_ID, label: "Career / Lifetime", isCurrent: false };
  }
  return inMemorySeasons.find((s) => s.id === id);
}

export function getTeams(): Team[] {
  return inMemoryTeams;
}

export function getTeamById(id: string): Team | undefined {
  return inMemoryTeams.find((t) => t.id === id);
}

export function getTeamsByLeague(
  league: League,
  seasonId: string = getCurrentSeasonId()
): Team[] {
  if (isLifetimeSeason(seasonId)) {
    const standings = deriveStandings(inMemoryTeams, inMemoryGames, league, seasonId);
    return standings.map((s) => s.team);
  }
  const filtered = inMemoryTeams.filter(
    (t) => t.league === league && t.seasonId === seasonId
  );
  return filtered.length > 0
    ? filtered
    : inMemoryTeams.filter((t) => t.league === league);
}

export function getPlayers(): Player[] {
  return inMemoryPlayers;
}

export function getPlayerById(id: string): Player | undefined {
  return inMemoryPlayers.find((p) => p.id === id);
}

export function getPlayersByTeam(teamId: string): Player[] {
  return inMemoryPlayers.filter((player) => player.teamId === teamId);
}

export function getPlayersByLeague(
  league: League,
  seasonId: string = getCurrentSeasonId()
): Player[] {
  const teamIds = new Set(
    inMemoryTeams.filter((t) => t.league === league).map((t) => t.id)
  );

  if (isLifetimeSeason(seasonId)) {
    return inMemoryPlayers.filter((p) => teamIds.has(p.teamId));
  }

  return inMemoryPlayers.filter(
    (p) => p.seasonId === seasonId && teamIds.has(p.teamId)
  );
}

export function getGames(): Game[] {
  return inMemoryGames;
}

export function getAllGames(seasonId?: string): Game[] {
  if (!seasonId || isLifetimeSeason(seasonId)) return inMemoryGames;
  return inMemoryGames.filter((g) => g.seasonId === seasonId);
}

export function getGameById(id: string): Game | undefined {
  return inMemoryGames.find((g) => g.id === id);
}

export function getGamesByLeague(
  league: League,
  seasonId: string = getCurrentSeasonId()
): Game[] {
  if (isLifetimeSeason(seasonId)) {
    return inMemoryGames.filter((g) => g.league === league);
  }
  return inMemoryGames.filter((g) => g.league === league && g.seasonId === seasonId);
}

export function getStandings(
  league: League,
  seasonId: string = getCurrentSeasonId()
): DerivedTeamStandings[] {
  return deriveStandings(inMemoryTeams, inMemoryGames, league, seasonId);
}

export function getStatLeaders(
  league: League,
  statKey: keyof SeasonAverages,
  limit = 5,
  seasonId: string = getCurrentSeasonId()
): StatLeaderEntry[] {
  return deriveStatLeaders(inMemoryPlayers, inMemoryTeams, inMemoryGames, league, statKey, seasonId, limit);
}

export function getPlayerStatRank(
  playerId: string,
  statKey: keyof SeasonAverages
): number | undefined {
  return derivePlayerStatRank(playerId, statKey, inMemoryPlayers, inMemoryTeams, inMemoryGames);
}

export function getPlayerGameLog(playerId: string): PlayerGameLogEntry[] {
  return derivePlayerGameLog(playerId, inMemoryGames, inMemoryTeams, inMemoryPlayers);
}

export function getPlayerSeasonLines(playerId: string): Player[] {
  const player = getPlayerById(playerId);
  if (!player) return [];
  return inMemoryPlayers.filter((p) => p.personId === player.personId);
}

export function getPlayerCareerAverages(playerId: string): SeasonAverages | null {
  const player = getPlayerById(playerId);
  if (!player) return null;
  return derivePlayerAverages(player, inMemoryGames);
}

// Mutation functions with direct Supabase calls
export function saveGame(game: Game): void {
  const idx = inMemoryGames.findIndex((g) => g.id === game.id);
  if (idx >= 0) inMemoryGames[idx] = game;
  else inMemoryGames.unshift(game);
  void upsertGameInSupabase(game);
}

export function updateGameScore(
  id: string,
  homeScore: number,
  awayScore: number,
  status: GameStatus,
  quarterOrSet: number,
  timeRemaining: string | null,
  playByPlay?: PlayByPlayEvent[]
): void {
  const game = inMemoryGames.find((g) => g.id === id);
  if (!game) return;

  const updated: Game = {
    ...game,
    homeScore,
    awayScore,
    status,
    quarterOrSet,
    timeRemaining,
    playByPlay: playByPlay ?? game.playByPlay,
  };
  const idx = inMemoryGames.findIndex((g) => g.id === id);
  inMemoryGames[idx] = updated;
  void upsertGameInSupabase(updated);
}

export function updateGameBoxScore(
  id: string,
  side: "home" | "away",
  items: BoxScoreItem[]
): void {
  const game = inMemoryGames.find((g) => g.id === id);
  if (!game) return;

  const updated: Game = {
    ...game,
    boxScore: {
      ...(game.boxScore ?? { home: [], away: [] }),
      [side]: items,
    },
  };
  const idx = inMemoryGames.findIndex((g) => g.id === id);
  inMemoryGames[idx] = updated;
  void upsertGameInSupabase(updated);
}

export function deleteGame(id: string): void {
  inMemoryGames = inMemoryGames.filter((g) => g.id !== id);
  void deleteGameInSupabase(id);
}

export function saveTeam(team: Team): void {
  const idx = inMemoryTeams.findIndex((t) => t.id === team.id);
  if (idx >= 0) inMemoryTeams[idx] = team;
  else inMemoryTeams.push(team);
  void upsertTeamInSupabase(team);
}

export function deleteTeam(id: string): void {
  inMemoryTeams = inMemoryTeams.filter((t) => t.id !== id);
  void deleteTeamInSupabase(id);
}

export function savePlayer(player: Player): void {
  const idx = inMemoryPlayers.findIndex((p) => p.id === player.id);
  if (idx >= 0) inMemoryPlayers[idx] = player;
  else inMemoryPlayers.push(player);
  void upsertPlayerInSupabase(player);
}

export function deletePlayer(id: string): void {
  inMemoryPlayers = inMemoryPlayers.filter((p) => p.id !== id);
  void deletePlayerInSupabase(id);
}

export function deleteAllPlayers(): void {
  inMemoryPlayers = [];
  void deleteAllPlayersInSupabase();
}

export function saveSeason(season: Season): void {
  const idx = inMemorySeasons.findIndex((s) => s.id === season.id);
  if (idx >= 0) inMemorySeasons[idx] = season;
  else inMemorySeasons.push(season);
  void upsertSeasonInSupabase(season);
}

export function deleteSeason(id: string): void {
  inMemorySeasons = inMemorySeasons.filter((s) => s.id !== id);
  void deleteSeasonInSupabase(id);
}