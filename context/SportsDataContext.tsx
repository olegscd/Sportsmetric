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
import type { SupabaseDataResult } from "@/lib/supabase-data";
import { usePathname } from "next/navigation";
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
  requestScope: (query: string) => void;
  seasons: Season[];
  teams: Team[];
  players: Player[];
  games: Game[];
  currentSeasonId: string;
  setCurrentSeasonId: (id: string) => void;
  setSeasonAsCurrent: (id: string) => Promise<void>;
  reorderSeasons: (newSeasonsOrder: Season[]) => Promise<void>;
  loading: boolean;
  /** Query whose data is currently in the store. Null until the first load. */
  loadedScopeQuery: string | null;
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

export function SportsDataProvider({ children, initialData, initialQuery = "metadata=1", initialError }: {
  children: React.ReactNode; initialData?: SupabaseDataResult; initialQuery?: string; initialError?: string;
}) {
  const isHydrated = useSyncExternalStore(emptySubscribe, () => true, () => false);
  const [seasons, setSeasons] = useState<Season[]>(initialData?.seasons ?? []);
  const [teams, setTeams] = useState<Team[]>(initialData?.teams ?? []);
  const [players, setPlayers] = useState<Player[]>(initialData?.players ?? []);
  const [games, setGames] = useState<Game[]>(initialData?.games ?? []);
  const [currentSeasonId, setCurrentSeasonId] = useState<string>(() =>
    initialData?.seasons.find(s => s.league === "UAAP" && s.isCurrent)?.id
    ?? initialData?.seasons.find(s => s.isCurrent)?.id
    ?? initialData?.seasons[0]?.id ?? "2025-26"
  );
  const [loading, setLoading] = useState<boolean>(!initialData && !initialError);
  const [loadedScopeQuery, setLoadedScopeQuery] = useState<string | null>(
    initialData ? initialQuery : null
  );
  const [error, setError] = useState<string | null>(initialError ?? null);

  const pathname = usePathname();
  const [scope, setScope] = useState({ path: pathname, query: initialQuery });
  const scopeQuery = scope.path === pathname ? scope.query : "metadata=1";
  const requestScope = useCallback((query: string) => {
    setScope(prev => prev.path === pathname && prev.query === query ? prev : { path: pathname, query });
  }, [pathname]);
  const loadGeneration = useRef(0);
  const realtimeDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const serverDataUsed = useRef(false);

  const loadDataFromSupabase = useCallback(async (silent = false) => {
    const generation = ++loadGeneration.current;
    const requestedQuery = scopeQuery;
    // Keep a previous load error visible while retrying. The database client
    // can back off for several seconds; hiding it would leave only a spinner.
    if (!silent) setLoading(true);
    try {
      const response = await fetch(`/api/sports?${requestedQuery}`, { cache: "no-store" });
      if (!response.ok) throw new Error("Could not load sports data.");
      const data: SupabaseDataResult = await response.json();
      if (generation !== loadGeneration.current) return;
      setSeasons(data.seasons);
      setTeams(data.teams);
      setPlayers(data.players);
      setGames(data.games);
      setLoadedScopeQuery(requestedQuery);
      setCurrentSeasonId(prev => {
        if (data.seasons.some(s => s.id === prev)) return prev;
        return data.seasons.find(s => s.league === "UAAP" && s.isCurrent)?.id ?? data.seasons[0]?.id ?? prev;
      });
      setError(null);
    } catch (err) {
      if (generation === loadGeneration.current) {
        setError(err instanceof Error ? err.message : "Failed to load data.");
      }
    } finally {
      if (generation === loadGeneration.current) setLoading(false);
    }
  }, [scopeQuery]);

  useEffect(() => {
    if (!serverDataUsed.current && initialData && scopeQuery === initialQuery) {
      serverDataUsed.current = true;
      return;
    }
    // Synchronize the selected server query with the client store.
    void loadDataFromSupabase();
    const generationRef = loadGeneration;
    return () => { generationRef.current++; };
  }, [loadDataFromSupabase, initialData, initialQuery, scopeQuery]);

  const realtimeSeason = new URLSearchParams(scopeQuery).get("season");
  useEffect(() => {
    if (!supabase || scopeQuery === "metadata=1") return;
    const client = supabase;
    let disposed = false;
    let running = false;
    let pending = false;
    const reload = async () => {
      if (running) { pending = true; return; }
      running = true;
      do {
        pending = false;
        await loadDataFromSupabase(true);
      } while (pending && !disposed);
      running = false;
    };
    let channel = client.channel(`sportsmetric:${scopeQuery}`);
    for (const table of ["seasons", "teams", "players", "games"]) {
      channel = channel.on("postgres_changes", {
        event: "*", schema: "public", table,
        ...(table !== "seasons" && realtimeSeason && realtimeSeason !== "lifetime"
          ? { filter: `season_id=eq.${realtimeSeason}` } : {}),
      }, () => {
        if (realtimeDebounceRef.current) clearTimeout(realtimeDebounceRef.current);
        realtimeDebounceRef.current = setTimeout(() => { void reload(); }, 1200);
      });
    }
    channel.subscribe();
    return () => {
      disposed = true;
      if (realtimeDebounceRef.current) clearTimeout(realtimeDebounceRef.current);
      void client.removeChannel(channel);
    };
  }, [loadDataFromSupabase, scopeQuery, realtimeSeason]);


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
    const previousState = seasons;

    const idx = seasons.findIndex((s) => s.id === season.id);
    let nextSeasons =
      idx >= 0
        ? seasons.map((s, i) => (i === idx ? season : s))
        : [...seasons, season];

    if (season.isCurrent) {
      nextSeasons = nextSeasons.map((s) => {
        const l = inferLeague(s.id, s.league);
        return l === sLeague ? { ...s, isCurrent: s.id === season.id } : s;
      });
    }

    setSeasons(nextSeasons);

    await commit(
      { op: "season.batchUpsert", seasons: nextSeasons },
      () => setSeasons(previousState),
      `Could not save season ${season.label}.`
    );
  }, [commit, seasons]);

  const deleteSeason = useCallback(async (id: string) => {
    const previousSeasons = seasons;
    const previousTeams = teams;
    const previousPlayers = players;
    const previousGames = games;
    const prevSeasonId = currentSeasonId;

    const deletedSeason = seasons.find((s) => s.id === id);
    const remaining = seasons.filter((s) => s.id !== id);

    let nextSeasons = remaining;
    if (deletedSeason?.isCurrent) {
      const dLeague = inferLeague(id, deletedSeason.league);
      const replacement = remaining.find(
        (s) => inferLeague(s.id, s.league) === dLeague
      );
      if (replacement) {
        nextSeasons = remaining.map((s) =>
          s.id === replacement.id ? { ...s, isCurrent: true } : s
        );
      }
    }

    let nextCurrentSeasonId = currentSeasonId;
    if (currentSeasonId === id && nextSeasons.length > 0) {
      nextCurrentSeasonId =
        nextSeasons.find((s) => s.isCurrent)?.id ?? nextSeasons[0]?.id ?? currentSeasonId;
    }

    setSeasons(nextSeasons);
    // The server cascades the delete, so drop the season's rows locally too.
    setTeams(teams.filter((t) => t.seasonId !== id));
    setPlayers(players.filter((p) => p.seasonId !== id));
    setGames(games.filter((g) => g.seasonId !== id));
    setCurrentSeasonId(nextCurrentSeasonId);

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
  }, [commit, seasons, teams, players, games, currentSeasonId]);

  const setSeasonAsCurrent = useCallback(async (targetId: string) => {
    const previousState = seasons;
    const prevSeasonId = currentSeasonId;
    const targetSeason = seasons.find((s) => s.id === targetId);
    const targetLeague = inferLeague(targetId, targetSeason?.league);

    const updatedSeasons = seasons.map((s) => {
      const sLeague = inferLeague(s.id, s.league);
      if (sLeague === targetLeague) {
        return { ...s, isCurrent: s.id === targetId };
      }
      return s;
    });

    setSeasons(updatedSeasons);
    setCurrentSeasonId(targetId);

    await commit(
      { op: "season.batchUpsert", seasons: updatedSeasons },
      () => {
        setSeasons(previousState);
        setCurrentSeasonId(prevSeasonId);
      },
      `Could not set season ${targetId} as current.`
    );
  }, [commit, seasons, currentSeasonId]);

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
  // Derived selectors are not cheap: standings scan every game, and player
  // averages scan every box score. Game cards, stat-leader cards, and the
  // player directory all request the same derivations repeatedly, so memoize
  // by input key and invalidate on a data-reference change.
  const standingsCacheRef = useRef(
    new Map<string, { teams: Team[]; games: Game[]; value: DerivedTeamStandings[] }>()
  );
  const statLeadersCacheRef = useRef(
    new Map<
      string,
      { players: Player[]; teams: Team[]; games: Game[]; value: StatLeaderEntry[] }
    >()
  );
  const statRankCacheRef = useRef(
    new Map<
      string,
      { players: Player[]; teams: Team[]; games: Game[]; value: number | undefined }
    >()
  );
  const playerAveragesCacheRef = useRef(
    new Map<string, { games: Game[]; teams: Team[]; players: Player[]; value: SeasonAverages }>()
  );

  // Drop cached derivations when the underlying data is replaced. The keys
  // also compare references, but clearing prevents stale entries from keeping
  // old game/team arrays alive across many realtime reloads.
  useEffect(() => {
    standingsCacheRef.current.clear();
    statLeadersCacheRef.current.clear();
    statRankCacheRef.current.clear();
    playerAveragesCacheRef.current.clear();
  }, [teams, games, players]);

  const getStandingsHandler = useCallback(
    (league: League, seasonId = currentSeasonId) => {
      const key = `${league}|${seasonId}`;
      const cached = standingsCacheRef.current.get(key);
      if (cached && cached.teams === teams && cached.games === games) {
        return cached.value;
      }
      const value = deriveStandings(teams, games, league, seasonId);
      standingsCacheRef.current.set(key, { teams, games, value });
      return value;
    },
    [teams, games, currentSeasonId]
  );

  const getStatLeadersHandler = useCallback(
    (league: League, statKey: keyof SeasonAverages, limit = 5, seasonId = currentSeasonId) => {
      const key = `${league}|${seasonId}|${String(statKey)}|${limit}`;
      const cached = statLeadersCacheRef.current.get(key);
      if (
        cached &&
        cached.players === players &&
        cached.teams === teams &&
        cached.games === games
      ) {
        return cached.value;
      }
      const value = deriveStatLeaders(players, teams, games, league, statKey, seasonId, limit);
      statLeadersCacheRef.current.set(key, { players, teams, games, value });
      return value;
    },
    [players, teams, games, currentSeasonId]
  );

  const getPlayerStatRankHandler = useCallback(
    (playerId: string, statKey: keyof SeasonAverages) => {
      const key = `${playerId}|${String(statKey)}`;
      const cached = statRankCacheRef.current.get(key);
      if (
        cached &&
        cached.players === players &&
        cached.teams === teams &&
        cached.games === games
      ) {
        return cached.value;
      }
      const value = derivePlayerStatRank(playerId, statKey, players, teams, games);
      statRankCacheRef.current.set(key, { players, teams, games, value });
      return value;
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
      const key = `${player.id}|${player.seasonId}`;
      const cached = playerAveragesCacheRef.current.get(key);
      if (
        cached &&
        cached.games === games &&
        cached.teams === teams &&
        cached.players === players
      ) {
        return cached.value;
      }
      const value = derivePlayerAverages(player, games, teams, players);
      playerAveragesCacheRef.current.set(key, { games, teams, players, value });
      return value;
    },
    [games, teams, players]
  );

  // Memoize the entire context value to prevent unnecessary re-renders
  const value = useMemo<SportsDataContextType>(
    () => ({
      requestScope,
      seasons,
      teams,
      players,
      games,
      currentSeasonId,
      setCurrentSeasonId,
      setSeasonAsCurrent,
      reorderSeasons,
      loading,
      loadedScopeQuery,
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
      requestScope, seasons, teams, players, games, currentSeasonId, loading, loadedScopeQuery, error, clearError, isHydrated,
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

/** Ask for one server-side scope; each page owns its selection. */
export function useSportsScope(query: string): { isPending: boolean } {
  const { requestScope, loadedScopeQuery, error } = useSportsData();
  useEffect(() => { requestScope(query); }, [requestScope, query]);
  // The page's selection can change before the scope effect commits. Compare
  // against the query that actually populated the store so the first render
  // after a season switch is a loading state, not a false empty state.
  return { isPending: !error && loadedScopeQuery !== query };
}
