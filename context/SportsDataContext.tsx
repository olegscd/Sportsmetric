"use client";

import {
  derivePlayerAverages,
  derivePlayerGameLog,
  derivePlayerStatRank,
  deriveStandings,
  deriveStatLeaders,
  type DerivedTeamStandings,
  type PlayerGameLogEntry,
  type StatLeaderEntry,
} from "@/lib/derivations";
import { inferLeague } from "@/lib/league-utils";
import { mockGames, mockPlayers, mockSeasons, mockTeams } from "@/lib/mock-data";
import { supabase } from "@/lib/supabase";
import {
  batchUpsertGamesInSupabase,
  batchUpsertSeasonsInSupabase,
  deleteAllPlayersInSupabase,
  deleteGameInSupabase,
  deletePlayerInSupabase,
  deleteSeasonInSupabase,
  deleteTeamInSupabase,
  fetchAllSupabaseData,
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
import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";

interface SportsDataContextType {
  seasons: Season[];
  teams: Team[];
  players: Player[];
  games: Game[];
  currentSeasonId: string;
  setCurrentSeasonId: (id: string) => void;
  setSeasonAsCurrent: (id: string) => Promise<void>;
  reorderSeasons: (newSeasonsOrder: Season[]) => Promise<void>;
  loading: boolean;
  error: string | null;
  isHydrated: boolean;
  refreshData: () => Promise<void>;
  resetToDefaults: () => void;
  // Action methods
  saveGame: (game: Game) => Promise<void>;
  deleteGame: (id: string) => Promise<void>;
  updateGameScore: (
    id: string,
    homeScore: number,
    awayScore: number,
    status: GameStatus,
    quarterOrSet: number,
    timeRemaining: string | null,
    playByPlay?: PlayByPlayEvent[]
  ) => Promise<void>;
  updateGameBoxScore: (id: string, side: "home" | "away", items: BoxScoreItem[]) => Promise<void>;
  saveTeam: (team: Team) => Promise<void>;
  deleteTeam: (id: string) => Promise<void>;
  savePlayer: (player: Player) => Promise<void>;
  deletePlayer: (id: string) => Promise<void>;
  deleteAllPlayers: () => Promise<void>;
  saveSeason: (season: Season) => Promise<void>;
  deleteSeason: (id: string) => Promise<void>;
  importBoxScoreBatch: (games: Game[]) => Promise<void>;
  // Derived data selectors
  getStandings: (league: League, seasonId?: string) => DerivedTeamStandings[];
  getStatLeaders: (
    league: League,
    statKey: keyof SeasonAverages,
    limit?: number,
    seasonId?: string
  ) => StatLeaderEntry[];
  getPlayerStatRank: (playerId: string, statKey: keyof SeasonAverages) => number | undefined;
  getPlayerGameLog: (playerId: string) => PlayerGameLogEntry[];
  getPlayerAverages: (player: Player) => SeasonAverages;
}

const SportsDataContext = createContext<SportsDataContextType | undefined>(undefined);

export function SportsDataProvider({ children }: { children: React.ReactNode }) {
  const [seasons, setSeasons] = useState<Season[]>(mockSeasons);
  const [teams, setTeams] = useState<Team[]>(mockTeams);
  const [players, setPlayers] = useState<Player[]>(mockPlayers);
  const [games, setGames] = useState<Game[]>(mockGames);
  const [currentSeasonId, setCurrentSeasonId] = useState<string>(() => {
    return mockSeasons.find((s) => s.isCurrent)?.id ?? mockSeasons[0]?.id ?? "2025-26";
  });
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [isHydrated, setIsHydrated] = useState<boolean>(false);

  // Debounce ref for realtime updates
  const realtimeDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const loadDataFromSupabase = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchAllSupabaseData();
      if (data && data.seasons.length > 0) {
        setSeasons(data.seasons);
        setTeams(data.teams);
        setPlayers(data.players);
        setGames(data.games);
        setCurrentSeasonId((prev) => {
          if (prev && data.seasons.some((s) => s.id === prev)) return prev;
          const uaapCurr = data.seasons.find((s) => inferLeague(s.id, s.league) === "UAAP" && s.isCurrent)?.id;
          return uaapCurr ?? data.seasons.find((s) => s.isCurrent)?.id ?? data.seasons[0]?.id ?? prev;
        });
      } else {
        setSeasons(mockSeasons);
        setTeams(mockTeams);
        setPlayers(mockPlayers);
        setGames(mockGames);
      }
    } catch (err) {
      console.warn("[SportsDataContext] Using mock fallbacks after load error:", err);
      setError("Failed to load live data from Supabase. Displaying fallback data.");
      setSeasons(mockSeasons);
      setTeams(mockTeams);
      setPlayers(mockPlayers);
      setGames(mockGames);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    setIsHydrated(true);
    void loadDataFromSupabase();

    if (!supabase) return;

    const channel = supabase
      .channel("sportsmetric-realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public" },
        () => {
          // Debounce rapid successive changes to avoid N full reloads
          if (realtimeDebounceRef.current) clearTimeout(realtimeDebounceRef.current);
          realtimeDebounceRef.current = setTimeout(() => {
            void loadDataFromSupabase();
          }, 500);
        }
      )
      .subscribe();

    return () => {
      if (realtimeDebounceRef.current) clearTimeout(realtimeDebounceRef.current);
      if (supabase) {
        void supabase.removeChannel(channel);
      }
    };
  }, [loadDataFromSupabase]);

  // Reset to defaults
  const resetToDefaults = useCallback(() => {
    setSeasons(mockSeasons);
    setTeams(mockTeams);
    setPlayers(mockPlayers);
    setGames(mockGames);
    const curr = mockSeasons.find((s) => s.isCurrent)?.id ?? mockSeasons[0]?.id ?? "2025-26";
    setCurrentSeasonId(curr);
    void batchUpsertGamesInSupabase(mockGames);
  }, []);

  // Action Handlers — all wrapped in useCallback for stable references
  const saveGame = useCallback(async (game: Game) => {
    setGames((prev) => {
      const idx = prev.findIndex((g) => g.id === game.id);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = game;
        return next;
      }
      return [game, ...prev];
    });
    await upsertGameInSupabase(game);
  }, []);

  const deleteGame = useCallback(async (id: string) => {
    setGames((prev) => prev.filter((g) => g.id !== id));
    await deleteGameInSupabase(id);
  }, []);

  const updateGameScore = useCallback(async (
    id: string,
    homeScore: number,
    awayScore: number,
    status: GameStatus,
    quarterOrSet: number,
    timeRemaining: string | null,
    playByPlay?: PlayByPlayEvent[]
  ) => {
    let updatedGame: Game | null = null;
    setGames((prev) => {
      const game = prev.find((g) => g.id === id);
      if (!game) return prev;

      updatedGame = {
        ...game,
        homeScore,
        awayScore,
        status,
        quarterOrSet,
        timeRemaining,
        playByPlay: playByPlay ?? game.playByPlay,
      };

      return prev.map((g) => (g.id === id ? updatedGame! : g));
    });

    // updatedGame is assigned synchronously inside the updater
    if (updatedGame) {
      await upsertGameInSupabase(updatedGame);
    }
  }, []);

  const updateGameBoxScore = useCallback(async (id: string, side: "home" | "away", items: BoxScoreItem[]) => {
    let updatedGame: Game | null = null;
    setGames((prev) => {
      const game = prev.find((g) => g.id === id);
      if (!game) return prev;

      const currentBox = game.boxScore ?? { home: [], away: [] };
      updatedGame = {
        ...game,
        boxScore: {
          ...currentBox,
          [side]: items,
        },
      };

      return prev.map((g) => (g.id === id ? updatedGame! : g));
    });

    if (updatedGame) {
      await upsertGameInSupabase(updatedGame);
    }
  }, []);

  const saveTeam = useCallback(async (team: Team) => {
    setTeams((prev) => {
      const idx = prev.findIndex((t) => t.id === team.id);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = team;
        return next;
      }
      return [...prev, team];
    });
    await upsertTeamInSupabase(team);
  }, []);

  const deleteTeam = useCallback(async (id: string) => {
    setTeams((prev) => prev.filter((t) => t.id !== id));
    await deleteTeamInSupabase(id);
  }, []);

  const savePlayer = useCallback(async (player: Player) => {
    setPlayers((prev) => {
      const idx = prev.findIndex((p) => p.id === player.id);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = player;
        return next;
      }
      return [...prev, player];
    });
    await upsertPlayerInSupabase(player);
  }, []);

  const deletePlayer = useCallback(async (id: string) => {
    setPlayers((prev) => prev.filter((p) => p.id !== id));
    await deletePlayerInSupabase(id);
  }, []);

  const deleteAllPlayers = useCallback(async () => {
    setPlayers([]);
    await deleteAllPlayersInSupabase();
  }, []);

  const saveSeason = useCallback(async (season: Season) => {
    const sLeague = inferLeague(season.id, season.league);
    let nextSeasons: Season[] = [];

    setSeasons((prev) => {
      const idx = prev.findIndex((s) => s.id === season.id);
      let updatedList = [...prev];
      if (idx >= 0) {
        updatedList[idx] = season;
      } else {
        updatedList = [...prev, season];
      }

      if (season.isCurrent) {
        updatedList = updatedList.map((s) => {
          const l = inferLeague(s.id, s.league);
          if (l === sLeague) {
            return { ...s, isCurrent: s.id === season.id };
          }
          return s;
        });
      }
      nextSeasons = updatedList;
      return updatedList;
    });

    await batchUpsertSeasonsInSupabase(nextSeasons);
  }, []);

  const deleteSeason = useCallback(async (id: string) => {
    let nextSeasons: Season[] = [];

    setSeasons((prev) => {
      const deletedSeason = prev.find((s) => s.id === id);
      const remaining = prev.filter((s) => s.id !== id);

      if (deletedSeason?.isCurrent) {
        const dLeague = inferLeague(id, deletedSeason.league);
        const remainingInLeague = remaining.filter(
          (s) => inferLeague(s.id, s.league) === dLeague
        );
        if (remainingInLeague.length > 0) {
          remainingInLeague[0] = { ...remainingInLeague[0], isCurrent: true };
          // Update in the remaining array too
          const idx = remaining.findIndex((s) => s.id === remainingInLeague[0].id);
          if (idx >= 0) remaining[idx] = remainingInLeague[0];
        }
      }
      nextSeasons = remaining;
      return remaining;
    });

    setCurrentSeasonId((prev) => {
      if (prev === id && nextSeasons.length > 0) {
        const replacement = nextSeasons.find((s) => s.isCurrent);
        return replacement?.id ?? nextSeasons[0]?.id ?? prev;
      }
      return prev;
    });

    await deleteSeasonInSupabase(id);
    if (nextSeasons.length > 0) {
      await batchUpsertSeasonsInSupabase(nextSeasons);
    }
  }, []);

  const setSeasonAsCurrent = useCallback(async (targetId: string) => {
    setCurrentSeasonId(targetId);

    setSeasons((prev) => {
      const targetSeason = prev.find((s) => s.id === targetId);
      const targetLeague = inferLeague(targetId, targetSeason?.league);

      const updatedSeasons = prev.map((s) => {
        const sLeague = inferLeague(s.id, s.league);
        if (sLeague === targetLeague) {
          return { ...s, isCurrent: s.id === targetId };
        }
        return s;
      });

      // Fire-and-forget Supabase sync
      void batchUpsertSeasonsInSupabase(updatedSeasons);
      return updatedSeasons;
    });
  }, []);

  const reorderSeasons = useCallback(async (newSeasonsOrder: Season[]) => {
    setSeasons(newSeasonsOrder);
    await batchUpsertSeasonsInSupabase(newSeasonsOrder);
  }, []);

  const importBoxScoreBatch = useCallback(async (batchGames: Game[]) => {
    setGames((prev) => {
      const byId = new Map(prev.map((g) => [g.id, g]));
      for (const g of batchGames) byId.set(g.id, g);
      return Array.from(byId.values());
    });
    await batchUpsertGamesInSupabase(batchGames);
  }, []);

  // Selectors — memoized with useCallback
  const getStandingsHandler = useCallback(
    (league: League, seasonId = currentSeasonId) => {
      return deriveStandings(teams, games, league, seasonId);
    },
    [teams, games, currentSeasonId]
  );

  const getStatLeadersHandler = useCallback(
    (league: League, statKey: keyof SeasonAverages, limit = 5, seasonId = currentSeasonId) => {
      return deriveStatLeaders(players, teams, games, league, statKey, seasonId, limit);
    },
    [players, teams, games, currentSeasonId]
  );

  const getPlayerStatRankHandler = useCallback(
    (playerId: string, statKey: keyof SeasonAverages) => {
      return derivePlayerStatRank(playerId, statKey, players, teams, games);
    },
    [players, teams, games]
  );

  const getPlayerGameLogHandler = useCallback(
    (playerId: string) => {
      return derivePlayerGameLog(playerId, games, teams, players);
    },
    [games, teams, players]
  );

  const getPlayerAveragesHandler = useCallback(
    (player: Player) => {
      return derivePlayerAverages(player, games, teams);
    },
    [games, teams]
  );

  // Memoize the entire context value to prevent unnecessary re-renders
  const value = useMemo<SportsDataContextType>(
    () => ({
      seasons,
      teams,
      players,
      games,
      currentSeasonId,
      setCurrentSeasonId,
      setSeasonAsCurrent,
      reorderSeasons,
      loading,
      error,
      isHydrated,
      refreshData: loadDataFromSupabase,
      resetToDefaults,
      saveGame,
      deleteGame,
      updateGameScore,
      updateGameBoxScore,
      saveTeam,
      deleteTeam,
      savePlayer,
      deletePlayer,
      deleteAllPlayers,
      saveSeason,
      deleteSeason,
      importBoxScoreBatch,
      getStandings: getStandingsHandler,
      getStatLeaders: getStatLeadersHandler,
      getPlayerStatRank: getPlayerStatRankHandler,
      getPlayerGameLog: getPlayerGameLogHandler,
      getPlayerAverages: getPlayerAveragesHandler,
    }),
    [
      seasons, teams, players, games, currentSeasonId, loading, error, isHydrated,
      loadDataFromSupabase, resetToDefaults,
      saveGame, deleteGame, updateGameScore, updateGameBoxScore,
      saveTeam, deleteTeam, savePlayer, deletePlayer, deleteAllPlayers,
      saveSeason, deleteSeason, setSeasonAsCurrent, reorderSeasons, importBoxScoreBatch,
      getStandingsHandler, getStatLeadersHandler, getPlayerStatRankHandler,
      getPlayerGameLogHandler, getPlayerAveragesHandler,
    ]
  );

  return (
    <SportsDataContext.Provider value={value}>
      {children}
    </SportsDataContext.Provider>
  );
}

export function useSportsData(): SportsDataContextType {
  const context = useContext(SportsDataContext);
  if (!context) {
    throw new Error("useSportsData must be used within a SportsDataProvider");
  }
  return context;
}
