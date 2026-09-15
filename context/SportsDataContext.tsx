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
import { adminMutate, type AdminMutation } from "@/lib/admin-api";
import { fetchAllSupabaseData } from "@/lib/supabase-data";
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
  clearError: () => void;
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
  deleteAllPlayers: (seasonId: string) => Promise<void>;
  batchSavePlayers: (players: Player[]) => Promise<void>;
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

  const loadDataFromSupabase = useCallback(async (silent = false) => {
    if (!silent) {
      setLoading(true);
      setError(null);
    }
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
        setError(null);
      }
    } catch (err) {
      console.warn("[SportsDataContext] Load error:", err);
      if (!silent) setError("Failed to load data from Supabase.");
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
            void loadDataFromSupabase(true);
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

  const clearError = useCallback(() => setError(null), []);

  /**
   * Sends a mutation to the authenticated admin endpoint, rolling the
   * optimistic local update back and surfacing the server's message if it
   * fails. Re-throws so callers can keep their own error handling.
   */
  const commit = useCallback(
    async (mutation: AdminMutation, rollback: () => void, context: string) => {
      try {
        await adminMutate(mutation);
        setError(null);
      } catch (err) {
        rollback();
        const detail = err instanceof Error ? err.message : "Unknown error.";
        setError(`${context} ${detail}`);
        throw err;
      }
    },
    []
  );

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

    await commit(
      { op: "game.upsert", game },
      () => setGames(previousState),
      `Could not save game ${game.id}.`
    );
  }, [commit]);

  const deleteGame = useCallback(async (id: string) => {
    let previousState: Game[] = [];
    setGames((prev) => {
      previousState = prev;
      return prev.filter((g) => g.id !== id);
    });

    await commit(
      { op: "game.delete", id },
      () => setGames(previousState),
      `Could not delete game ${id}.`
    );
  }, [commit]);

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
      await commit(
        { op: "game.upsert", game: updatedGame },
        () => setGames(previousState),
        `Could not update the score for game ${id}.`
      );
    }
  }, [commit]);

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
      await commit(
        { op: "game.upsert", game: updatedGame },
        () => setGames(previousState),
        `Could not update the box score for game ${id}.`
      );
    }
  }, [commit]);

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

    await commit(
      { op: "team.upsert", team },
      () => setTeams(previousState),
      `Could not save team ${team.name}.`
    );
  }, [commit]);

  const deleteTeam = useCallback(async (id: string) => {
    let previousTeams: Team[] = [];
    let previousPlayers: Player[] = [];
    setTeams((prev) => {
      previousTeams = prev;
      return prev.filter((t) => t.id !== id);
    });
    setPlayers((prev) => {
      previousPlayers = prev;
      return prev.filter((p) => p.teamId !== id);
    });

    await commit(
      { op: "team.delete", id },
      () => {
        setTeams(previousTeams);
        setPlayers(previousPlayers);
      },
      `Could not delete team ${id}.`
    );
  }, [commit]);

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

    await commit(
      { op: "player.upsert", player },
      () => setPlayers(previousState),
      `Could not save player ${player.name}.`
    );
  }, [commit]);

  const deletePlayer = useCallback(async (id: string) => {
    let previousState: Player[] = [];
    setPlayers((prev) => {
      previousState = prev;
      return prev.filter((p) => p.id !== id);
    });

    await commit(
      { op: "player.delete", id },
      () => setPlayers(previousState),
      `Could not delete player ${id}.`
    );
  }, [commit]);

  const deleteAllPlayers = useCallback(async (seasonId: string) => {
    let previousState: Player[] = [];
    setPlayers((prev) => {
      previousState = prev;
      return prev.filter((p) => p.seasonId !== seasonId);
    });

    await commit(
      { op: "player.deleteAll", seasonId },
      () => setPlayers(previousState),
      `Could not clear the roster for ${seasonId}.`
    );
  }, [commit]);

  const batchSavePlayers = useCallback(async (incoming: Player[]) => {
    if (incoming.length === 0) return;
    let previousState: Player[] = [];
    setPlayers((prev) => {
      previousState = prev;
      const byId = new Map(prev.map((p) => [p.id, p]));
      for (const player of incoming) byId.set(player.id, player);
      return Array.from(byId.values());
    });

    await commit(
      { op: "player.batchUpsert", players: incoming },
      () => setPlayers(previousState),
      "Could not import the player batch."
    );
  }, [commit]);

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

    await commit(
      { op: "season.batchUpsert", seasons: nextSeasons },
      () => setSeasons(previousState),
      `Could not save season ${season.label}.`
    );
  }, [commit]);

  const deleteSeason = useCallback(async (id: string) => {
    let previousSeasons: Season[] = [];
    let previousTeams: Team[] = [];
    let previousPlayers: Player[] = [];
    let previousGames: Game[] = [];
    let prevSeasonId = "";
    let nextSeasons: Season[] = [];

    setSeasons((prev) => {
      previousSeasons = prev;
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

    // The server cascades the delete, so drop the season's rows locally too.
    setTeams((prev) => { previousTeams = prev; return prev.filter((t) => t.seasonId !== id); });
    setPlayers((prev) => { previousPlayers = prev; return prev.filter((p) => p.seasonId !== id); });
    setGames((prev) => { previousGames = prev; return prev.filter((g) => g.seasonId !== id); });

    setCurrentSeasonId((prev) => {
      prevSeasonId = prev;
      if (prev === id && nextSeasons.length > 0) {
        const replacement = nextSeasons.find((s) => s.isCurrent);
        return replacement?.id ?? nextSeasons[0]?.id ?? prev;
      }
      return prev;
    });

    await commit({ op: "season.delete", id }, () => {
      setSeasons(previousSeasons);
      setTeams(previousTeams);
      setPlayers(previousPlayers);
      setGames(previousGames);
      setCurrentSeasonId(prevSeasonId);
    }, `Could not delete season ${id}.`);

    if (nextSeasons.length > 0) {
      await adminMutate({ op: "season.batchUpsert", seasons: nextSeasons }).catch((err) => {
        console.error("[SportsDataContext] Failed to persist season list after delete:", err);
      });
    }
  }, [commit]);

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

    await commit(
      { op: "season.batchUpsert", seasons: updatedSeasons },
      () => {
        setSeasons(previousState);
        setCurrentSeasonId(prevSeasonId);
      },
      `Could not set season ${targetId} as current.`
    );
  }, [commit]);

  const reorderSeasons = useCallback(async (newSeasonsOrder: Season[]) => {
    // Stamp the new positions so the order survives a reload; reads sort by
    // sortOrder, not by the array position we happen to hold in memory.
    const renumbered = newSeasonsOrder.map((season, index) => ({
      ...season,
      sortOrder: index + 1,
    }));

    let previousState: Season[] = [];
    setSeasons((prev) => {
      previousState = prev;
      return renumbered;
    });

    await commit(
      { op: "season.batchUpsert", seasons: renumbered },
      () => setSeasons(previousState),
      "Could not reorder seasons."
    );
  }, [commit]);

  const importBoxScoreBatch = useCallback(async (batchGames: Game[]) => {
    let previousState: Game[] = [];
    setGames((prev) => {
      previousState = prev;
      const byId = new Map(prev.map((g) => [g.id, g]));
      for (const g of batchGames) byId.set(g.id, g);
      return Array.from(byId.values());
    });

    await commit(
      { op: "game.batchUpsert", games: batchGames },
      () => setGames(previousState),
      "Could not import the box score batch."
    );
  }, [commit]);


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
      clearError,
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
      batchSavePlayers,
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
      seasons, teams, players, games, currentSeasonId, loading, error, clearError, isHydrated,
      loadDataFromSupabase, resetToDefaults,
      saveGame, deleteGame, updateGameScore, updateGameBoxScore,
      saveTeam, deleteTeam, savePlayer, deletePlayer, deleteAllPlayers, batchSavePlayers,
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
