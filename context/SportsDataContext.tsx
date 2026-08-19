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
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";

const emptySubscribe = () => () => {};

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
  const isHydrated = useSyncExternalStore(emptySubscribe, () => true, () => false);
  const [seasons, setSeasons] = useState<Season[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [players, setPlayers] = useState<Player[]>([]);
  const [games, setGames] = useState<Game[]>([]);
  const [currentSeasonId, setCurrentSeasonId] = useState<string>("2025-26");
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Debounce ref for realtime updates
  const realtimeDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const loadDataFromSupabase = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchAllSupabaseData();
      if (data) {
        setSeasons(data.seasons);
        setTeams(data.teams);
        setPlayers(data.players);
        setGames(data.games);
        setCurrentSeasonId((prev) => {
          if (prev && data.seasons.some((s) => s.id === prev)) return prev;
          const uaapCurr = data.seasons.find((s) => inferLeague(s.id, s.league) === "UAAP" && s.isCurrent)?.id;
          return uaapCurr ?? data.seasons.find((s) => s.isCurrent)?.id ?? data.seasons[0]?.id ?? prev;
        });
      }
    } catch (err) {
      console.warn("[SportsDataContext] Load error:", err);
      setError("Failed to load data from Supabase.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let isMounted = true;

    fetchAllSupabaseData()
      .then((data) => {
        if (!isMounted) return;
        if (data) {
          setSeasons(data.seasons);
          setTeams(data.teams);
          setPlayers(data.players);
          setGames(data.games);
          setCurrentSeasonId((prev) => {
            if (prev && data.seasons.some((s) => s.id === prev)) return prev;
            const uaapCurr = data.seasons.find((s) => inferLeague(s.id, s.league) === "UAAP" && s.isCurrent)?.id;
            return uaapCurr ?? data.seasons.find((s) => s.isCurrent)?.id ?? data.seasons[0]?.id ?? prev;
          });
        }
        setLoading(false);
      })
      .catch((err) => {
        if (!isMounted) return;
        console.warn("[SportsDataContext] Initial load error:", err);
        setError("Failed to load data from Supabase.");
        setLoading(false);
      });

    if (!supabase) {
      return () => {
        isMounted = false;
      };
    }

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
      isMounted = false;
      if (realtimeDebounceRef.current) clearTimeout(realtimeDebounceRef.current);
      if (supabase) {
        void supabase.removeChannel(channel);
      }
    };
  }, [loadDataFromSupabase]);


  // Refresh data from Supabase
  const resetToDefaults = useCallback(() => {
    void loadDataFromSupabase();
  }, [loadDataFromSupabase]);

  // Action Handlers — all wrapped in useCallback with optimistic rollback
  const saveGame = useCallback(async (game: Game) => {
    let previousState: Game[] = [];
    setGames((prev) => {
      previousState = prev;
      const idx = prev.findIndex((g) => g.id === game.id);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = game;
        return next;
      }
      return [game, ...prev];
    });

    const ok = await upsertGameInSupabase(game);
    if (!ok) {
      setGames(previousState);
      setError(`Failed to save game ${game.id}`);
      throw new Error(`Failed to save game ${game.id} to database.`);
    }
  }, []);

  const deleteGame = useCallback(async (id: string) => {
    let previousState: Game[] = [];
    setGames((prev) => {
      previousState = prev;
      return prev.filter((g) => g.id !== id);
    });

    const ok = await deleteGameInSupabase(id);
    if (!ok) {
      setGames(previousState);
      setError(`Failed to delete game ${id}`);
      throw new Error(`Failed to delete game ${id} from database.`);
    }
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
    let previousState: Game[] = [];
    let updatedGame: Game | null = null;
    setGames((prev) => {
      previousState = prev;
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

    if (updatedGame) {
      const ok = await upsertGameInSupabase(updatedGame);
      if (!ok) {
        setGames(previousState);
        setError(`Failed to update score for game ${id}`);
        throw new Error(`Failed to update score for game ${id} in database.`);
      }
    }
  }, []);

  const updateGameBoxScore = useCallback(async (id: string, side: "home" | "away", items: BoxScoreItem[]) => {
    let previousState: Game[] = [];
    let updatedGame: Game | null = null;
    setGames((prev) => {
      previousState = prev;
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
      const ok = await upsertGameInSupabase(updatedGame);
      if (!ok) {
        setGames(previousState);
        setError(`Failed to update box score for game ${id}`);
        throw new Error(`Failed to update box score for game ${id} in database.`);
      }
    }
  }, []);

  const saveTeam = useCallback(async (team: Team) => {
    let previousState: Team[] = [];
    setTeams((prev) => {
      previousState = prev;
      const idx = prev.findIndex((t) => t.id === team.id);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = team;
        return next;
      }
      return [...prev, team];
    });

    const ok = await upsertTeamInSupabase(team);
    if (!ok) {
      setTeams(previousState);
      setError(`Failed to save team ${team.name}`);
      throw new Error(`Failed to save team ${team.name} to database.`);
    }
  }, []);

  const deleteTeam = useCallback(async (id: string) => {
    let previousState: Team[] = [];
    setTeams((prev) => {
      previousState = prev;
      return prev.filter((t) => t.id !== id);
    });

    const ok = await deleteTeamInSupabase(id);
    if (!ok) {
      setTeams(previousState);
      setError(`Failed to delete team ${id}`);
      throw new Error(`Failed to delete team ${id} from database.`);
    }
  }, []);

  const savePlayer = useCallback(async (player: Player) => {
    let previousState: Player[] = [];
    setPlayers((prev) => {
      previousState = prev;
      const idx = prev.findIndex((p) => p.id === player.id);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = player;
        return next;
      }
      return [...prev, player];
    });

    const ok = await upsertPlayerInSupabase(player);
    if (!ok) {
      setPlayers(previousState);
      setError(`Failed to save player ${player.name}`);
      throw new Error(`Failed to save player ${player.name} to database.`);
    }
  }, []);

  const deletePlayer = useCallback(async (id: string) => {
    let previousState: Player[] = [];
    setPlayers((prev) => {
      previousState = prev;
      return prev.filter((p) => p.id !== id);
    });

    const ok = await deletePlayerInSupabase(id);
    if (!ok) {
      setPlayers(previousState);
      setError(`Failed to delete player ${id}`);
      throw new Error(`Failed to delete player ${id} from database.`);
    }
  }, []);

  const deleteAllPlayers = useCallback(async () => {
    let previousState: Player[] = [];
    setPlayers((prev) => {
      previousState = prev;
      return [];
    });

    const ok = await deleteAllPlayersInSupabase();
    if (!ok) {
      setPlayers(previousState);
      setError("Failed to delete all players");
      throw new Error("Failed to delete all players from database.");
    }
  }, []);

  const saveSeason = useCallback(async (season: Season) => {
    const sLeague = inferLeague(season.id, season.league);
    let previousState: Season[] = [];
    let nextSeasons: Season[] = [];

    setSeasons((prev) => {
      previousState = prev;
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

    const ok = await batchUpsertSeasonsInSupabase(nextSeasons);
    if (!ok) {
      setSeasons(previousState);
      setError(`Failed to save season ${season.label}`);
      throw new Error(`Failed to save season ${season.label} to database.`);
    }
  }, []);

  const deleteSeason = useCallback(async (id: string) => {
    let previousState: Season[] = [];
    let prevSeasonId = "";
    let nextSeasons: Season[] = [];

    setSeasons((prev) => {
      previousState = prev;
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
      prevSeasonId = prev;
      if (prev === id && nextSeasons.length > 0) {
        const replacement = nextSeasons.find((s) => s.isCurrent);
        return replacement?.id ?? nextSeasons[0]?.id ?? prev;
      }
      return prev;
    });

    const ok = await deleteSeasonInSupabase(id);
    if (!ok) {
      setSeasons(previousState);
      setCurrentSeasonId(prevSeasonId);
      setError(`Failed to delete season ${id}`);
      throw new Error(`Failed to delete season ${id} from database.`);
    }

    if (nextSeasons.length > 0) {
      await batchUpsertSeasonsInSupabase(nextSeasons);
    }
  }, []);

  const setSeasonAsCurrent = useCallback(async (targetId: string) => {
    let previousState: Season[] = [];
    let prevSeasonId = "";
    let updatedSeasons: Season[] = [];

    setCurrentSeasonId((prev) => {
      prevSeasonId = prev;
      return targetId;
    });

    setSeasons((prev) => {
      previousState = prev;
      const targetSeason = prev.find((s) => s.id === targetId);
      const targetLeague = inferLeague(targetId, targetSeason?.league);

      updatedSeasons = prev.map((s) => {
        const sLeague = inferLeague(s.id, s.league);
        if (sLeague === targetLeague) {
          return { ...s, isCurrent: s.id === targetId };
        }
        return s;
      });

      return updatedSeasons;
    });

    const ok = await batchUpsertSeasonsInSupabase(updatedSeasons);
    if (!ok) {
      setSeasons(previousState);
      setCurrentSeasonId(prevSeasonId);
      setError(`Failed to set season ${targetId} as current`);
      throw new Error(`Failed to set season ${targetId} as current in database.`);
    }
  }, []);

  const reorderSeasons = useCallback(async (newSeasonsOrder: Season[]) => {
    let previousState: Season[] = [];
    setSeasons((prev) => {
      previousState = prev;
      return newSeasonsOrder;
    });

    const ok = await batchUpsertSeasonsInSupabase(newSeasonsOrder);
    if (!ok) {
      setSeasons(previousState);
      setError("Failed to reorder seasons");
      throw new Error("Failed to reorder seasons in database.");
    }
  }, []);

  const importBoxScoreBatch = useCallback(async (batchGames: Game[]) => {
    let previousState: Game[] = [];
    setGames((prev) => {
      previousState = prev;
      const byId = new Map(prev.map((g) => [g.id, g]));
      for (const g of batchGames) byId.set(g.id, g);
      return Array.from(byId.values());
    });

    const ok = await batchUpsertGamesInSupabase(batchGames);
    if (!ok) {
      setGames(previousState);
      setError("Failed to import box score batch");
      throw new Error("Failed to batch import games to database.");
    }
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
