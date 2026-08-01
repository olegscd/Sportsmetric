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
import React, { createContext, useCallback, useContext, useEffect, useState } from "react";

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
        const curr = data.seasons.find((s) => s.isCurrent)?.id;
        if (curr) setCurrentSeasonId(curr);
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
          void loadDataFromSupabase();
        }
      )
      .subscribe();

    return () => {
      if (supabase) {
        void supabase.removeChannel(channel);
      }
    };
  }, [loadDataFromSupabase]);

  // Action Handlers
  const saveGame = async (game: Game) => {
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
  };

  const deleteGame = async (id: string) => {
    setGames((prev) => prev.filter((g) => g.id !== id));
    await deleteGameInSupabase(id);
  };

  const updateGameScore = async (
    id: string,
    homeScore: number,
    awayScore: number,
    status: GameStatus,
    quarterOrSet: number,
    timeRemaining: string | null,
    playByPlay?: PlayByPlayEvent[]
  ) => {
    let updatedGame: Game | null = null;
    setGames((prev) =>
      prev.map((g) => {
        if (g.id === id) {
          updatedGame = {
            ...g,
            homeScore,
            awayScore,
            status,
            quarterOrSet,
            timeRemaining,
            playByPlay: playByPlay ?? g.playByPlay,
          };
          return updatedGame;
        }
        return g;
      })
    );
    if (updatedGame) {
      await upsertGameInSupabase(updatedGame);
    }
  };

  const updateGameBoxScore = async (id: string, side: "home" | "away", items: BoxScoreItem[]) => {
    let updatedGame: Game | null = null;
    setGames((prev) =>
      prev.map((g) => {
        if (g.id === id) {
          const currentBox = g.boxScore ?? { home: [], away: [] };
          updatedGame = {
            ...g,
            boxScore: {
              ...currentBox,
              [side]: items,
            },
          };
          return updatedGame;
        }
        return g;
      })
    );
    if (updatedGame) {
      await upsertGameInSupabase(updatedGame);
    }
  };

  const saveTeam = async (team: Team) => {
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
  };

  const deleteTeam = async (id: string) => {
    setTeams((prev) => prev.filter((t) => t.id !== id));
    await deleteTeamInSupabase(id);
  };

  const savePlayer = async (player: Player) => {
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
  };

  const deletePlayer = async (id: string) => {
    setPlayers((prev) => prev.filter((p) => p.id !== id));
    await deletePlayerInSupabase(id);
  };

  const deleteAllPlayers = async () => {
    setPlayers([]);
    await deleteAllPlayersInSupabase();
  };

  const saveSeason = async (season: Season) => {
    let nextSeasons: Season[] = [];
    const sLeague = season.league ?? (season.id.startsWith("pba") ? "PBA" : season.id.startsWith("pvl") ? "PVL" : "UAAP");

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
          const l = s.league ?? (s.id.startsWith("pba") ? "PBA" : s.id.startsWith("pvl") ? "PVL" : "UAAP");
          if (l === sLeague) {
            return { ...s, isCurrent: s.id === season.id };
          }
          return s;
        });
      }
      nextSeasons = updatedList;
      return updatedList;
    });

    if (season.isCurrent) {
      await batchUpsertSeasonsInSupabase(nextSeasons);
    } else {
      await upsertSeasonInSupabase(season);
    }
  };

  const deleteSeason = async (id: string) => {
    let nextSeasons: Season[] = [];

    setSeasons((prev) => {
      const deletedSeason = prev.find((s) => s.id === id);
      const remaining = prev.filter((s) => s.id !== id);

      if (deletedSeason?.isCurrent) {
        const dLeague = deletedSeason.league ?? (id.startsWith("pba") ? "PBA" : id.startsWith("pvl") ? "PVL" : "UAAP");
        const remainingInLeague = remaining.filter(
          (s) => (s.league ?? (s.id.startsWith("pba") ? "PBA" : s.id.startsWith("pvl") ? "PVL" : "UAAP")) === dLeague
        );
        if (remainingInLeague.length > 0) {
          remainingInLeague[0].isCurrent = true;
          if (currentSeasonId === id) {
            setCurrentSeasonId(remainingInLeague[0].id);
          }
        }
      }
      nextSeasons = remaining;
      return remaining;
    });

    await deleteSeasonInSupabase(id);
    if (nextSeasons.length > 0) {
      await batchUpsertSeasonsInSupabase(nextSeasons);
    }
  };

  const setSeasonAsCurrent = async (targetId: string) => {
    const targetSeason = seasons.find((s) => s.id === targetId);
    const targetLeague = targetSeason?.league ?? (targetId.startsWith("pba") ? "PBA" : targetId.startsWith("pvl") ? "PVL" : "UAAP");

    setCurrentSeasonId(targetId);

    const updatedSeasons = seasons.map((s) => {
      const sLeague = s.league ?? (s.id.startsWith("pba") ? "PBA" : s.id.startsWith("pvl") ? "PVL" : "UAAP");
      if (sLeague === targetLeague) {
        return { ...s, isCurrent: s.id === targetId };
      }
      return s;
    });

    setSeasons(updatedSeasons);
    await batchUpsertSeasonsInSupabase(updatedSeasons);
  };

  const reorderSeasons = async (newSeasonsOrder: Season[]) => {
    setSeasons(newSeasonsOrder);
    await batchUpsertSeasonsInSupabase(newSeasonsOrder);
  };

  const importBoxScoreBatch = async (batchGames: Game[]) => {
    setGames((prev) => {
      const byId = new Map(prev.map((g) => [g.id, g]));
      for (const g of batchGames) byId.set(g.id, g);
      return Array.from(byId.values());
    });
    await batchUpsertGamesInSupabase(batchGames);
  };

  // Selectors
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

  return (
    <SportsDataContext.Provider
      value={{
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
      }}
    >
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
